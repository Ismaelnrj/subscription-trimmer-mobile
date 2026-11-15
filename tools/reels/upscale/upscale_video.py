"""Upscales a video x4 with the ONNX Real-ESRGAN model on CPU, then scales to the target size.
Frames stream through ffmpeg pipes, so nothing large lands on disk. Audio is copied as is.

    python -I upscale_video.py <model.onnx> <ffmpeg> <in.mp4> <out.mp4> [W H] [--frames N] [--png first.png]
"""
import subprocess, sys, time
import numpy as np
import onnxruntime as ort
from PIL import Image

args = sys.argv[1:]
model, ff, src, dst = args[:4]
W, H = (int(args[4]), int(args[5])) if len(args) > 5 and not args[4].startswith('--') else (1080, 1920)
limit = int(args[args.index('--frames') + 1]) if '--frames' in args else None
png = args[args.index('--png') + 1] if '--png' in args else None

probe = subprocess.run([ff, '-hide_banner', '-i', src], capture_output=True, text=True).stderr
import re
w, h = map(int, re.search(r'Video:.*?, (\d{2,5})x(\d{2,5})', probe).groups())
fps = re.search(r'(\d+(?:\.\d+)?) fps', probe).group(1)

so = ort.SessionOptions()
so.intra_op_num_threads = 4
sess = ort.InferenceSession(model, so, providers=['CPUExecutionProvider'])

dec = subprocess.Popen([ff, '-v', 'error', '-i', src, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], stdout=subprocess.PIPE)
enc = None
if not png:
    enc = subprocess.Popen([ff, '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', fps, '-i', '-',
                            '-i', src, '-map', '0:v', '-map', '1:a?', '-c:v', 'libx264', '-crf', '12', '-preset', 'slow',
                            '-pix_fmt', 'yuv420p', '-c:a', 'copy', '-shortest', dst], stdin=subprocess.PIPE)
n, t0 = 0, time.time()
while True:
    buf = dec.stdout.read(w * h * 3)
    if len(buf) < w * h * 3:
        break
    x = np.frombuffer(buf, np.uint8).reshape(h, w, 3).astype(np.float32).transpose(2, 0, 1)[None] / 255.0
    y = sess.run(None, {'input': x})[0][0]
    y = (np.clip(y, 0, 1).transpose(1, 2, 0) * 255.0 + 0.5).astype(np.uint8)
    im = Image.fromarray(y).resize((W, H), Image.LANCZOS)
    n += 1
    if png:
        im.save(png)
        Image.fromarray(np.frombuffer(buf, np.uint8).reshape(h, w, 3)).resize((W, H), Image.LANCZOS).save(png.replace('.png', '-lanczos.png'))
        print(f'frame 1 in {time.time() - t0:.1f}s, out {y.shape}')
        break
    enc.stdin.write(im.tobytes())
    if n % 24 == 0:
        print(f'{n} frames, {(time.time() - t0) / n:.2f}s/frame', flush=True)
    if limit and n >= limit:
        break
dec.kill()
if enc:
    enc.stdin.close()
    enc.wait()
print(f'done: {n} frames in {time.time() - t0:.0f}s -> {dst}')
