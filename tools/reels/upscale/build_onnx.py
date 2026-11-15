"""Builds an ONNX model of Real-ESRGAN's SRVGGNetCompact (realesr-general-x4v3) from the .pth,
without PyTorch. The .pth is read with a restricted unpickler that only knows how to rebuild
tensors, so a pickle that tries anything else fails instead of running code.

    python -I build_onnx.py <weights.pth> <out.onnx> [<wdn weights.pth> <denoise strength 0..1>]
"""
import io, pickle, sys, zipfile
import numpy as np
import onnx
from onnx import helper, numpy_helper, TensorProto

DTYPES = {'FloatStorage': np.float32, 'HalfStorage': np.float16, 'LongStorage': np.int64}


def load_state(path):
    z = zipfile.ZipFile(path)
    root = z.namelist()[0].split('/')[0]

    class Storage:
        def __init__(self, dtype, key):
            self.arr = np.frombuffer(z.read(f'{root}/data/{key}'), dtype=dtype)

    def rebuild(storage, offset, size, stride, *rest):
        a = storage.arr
        if not size:
            return a[offset:offset + 1].reshape(())
        item = a.itemsize
        return np.lib.stride_tricks.as_strided(a[offset:], shape=tuple(size),
                                               strides=tuple(s * item for s in stride)).copy()

    class U(pickle.Unpickler):
        def find_class(self, mod, name):
            if mod == 'collections' and name == 'OrderedDict':
                import collections
                return collections.OrderedDict
            if mod == 'torch._utils' and name == '_rebuild_tensor_v2':
                return rebuild
            if mod == 'torch' and name in DTYPES:
                return name
            raise pickle.UnpicklingError(f'refused {mod}.{name}')

        def persistent_load(self, pid):
            _, stype, key, _loc, _numel = pid
            return Storage(DTYPES[stype], key)

    return U(io.BytesIO(z.read(f'{root}/data.pkl'))).load()


def main(src, dst, wdn=None, dn=1.0):
    sd = load_state(src)
    sd = sd.get('params_ema') or sd.get('params') or sd
    if wdn:  # Real-ESRGAN's denoise strength: interpolate weights, dn of the default model, 1 - dn of wdn
        sw = load_state(wdn)
        sw = sw.get('params_ema') or sw.get('params') or sw
        dn = float(dn)
        sd = {k: dn * sd[k].astype(np.float32) + (1 - dn) * sw[k].astype(np.float32) for k in sd}
    convs = sorted({int(k.split('.')[1]) for k in sd if k.endswith('.bias') and sd[k.replace('bias', 'weight')].ndim == 4})
    nodes, inits = [], []
    x = 'input'
    for i in convs:
        w, b = f'w{i}', f'b{i}'
        inits += [numpy_helper.from_array(sd[f'body.{i}.weight'].astype(np.float32), w),
                  numpy_helper.from_array(sd[f'body.{i}.bias'].astype(np.float32), b)]
        nodes.append(helper.make_node('Conv', [x, w, b], [f'c{i}'], pads=[1, 1, 1, 1], kernel_shape=[3, 3]))
        x = f'c{i}'
        act = f'body.{i + 1}.weight'
        if act in sd and sd[act].ndim == 1:
            s = f's{i}'
            inits.append(numpy_helper.from_array(sd[act].astype(np.float32).reshape(-1, 1, 1), s))
            nodes.append(helper.make_node('PRelu', [x, s], [f'p{i}']))
            x = f'p{i}'
    nodes.append(helper.make_node('DepthToSpace', [x], ['up'], blocksize=4, mode='CRD'))
    inits.append(numpy_helper.from_array(np.array([1, 1, 4, 4], dtype=np.float32), 'scales'))
    nodes.append(helper.make_node('Resize', ['input', '', 'scales'], ['base'], mode='nearest'))
    nodes.append(helper.make_node('Add', ['up', 'base'], ['output']))
    g = helper.make_graph(nodes, 'srvgg', [helper.make_tensor_value_info('input', TensorProto.FLOAT, [1, 3, None, None])],
                          [helper.make_tensor_value_info('output', TensorProto.FLOAT, [1, 3, None, None])], inits)
    m = helper.make_model(g, opset_imports=[helper.make_opsetid('', 17)])
    onnx.checker.check_model(m)
    onnx.save(m, dst)
    print(f'{len(convs)} convs, {sum(v.size for v in sd.values())} params -> {dst}')


if __name__ == '__main__':
    main(*sys.argv[1:5])
