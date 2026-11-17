# who-speaks.py him.wav her.wav media s e [s e ...]: cosine similarity of each span to his and her voice.
# Model: wespeaker_en_voxceleb_resnet34.onnx (k2-fsa/sherpa-onnx release speaker-recongition-models) at /tmp/asr/spk. README item 23.
import sys, subprocess, numpy as np, imageio_ffmpeg, sherpa_onnx
FF=imageio_ffmpeg.get_ffmpeg_exe()
cfg=sherpa_onnx.SpeakerEmbeddingExtractorConfig(model='/tmp/asr/spk/wespeaker_en_voxceleb_resnet34.onnx')
ex=sherpa_onnx.SpeakerEmbeddingExtractor(cfg)
def load(p):
    raw=subprocess.run([FF,'-v','error','-i',p,'-ac','1','-ar','16000','-f','s16le','-'],capture_output=True).stdout
    return np.frombuffer(raw,dtype=np.int16).astype(np.float32)/32768
def emb(x):
    s=ex.create_stream(); s.accept_waveform(16000,x); s.input_finished(); e=np.array(ex.compute(s)); return e/np.linalg.norm(e)
him=emb(load(sys.argv[1])); her=emb(load(sys.argv[2])); a=load(sys.argv[3])
print(f'refs him~her {him@her:.2f}')
sp=list(map(float,sys.argv[4:]))
for s,e in zip(sp[::2],sp[1::2]):
    v=emb(a[int(s*16000):int(e*16000)]); h,w=v@him,v@her
    print(f'{s:5.2f}-{e:5.2f}  him {h:.2f}  her {w:.2f}  -> {"HIM" if h>w else "HER"}')
