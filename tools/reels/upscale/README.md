# Free upscaling of generated takes (Real-ESRGAN on CPU)

Higgsfield charges 16 credits a second to finish a Seedance draft at 720p or
1080p (336 for the story reel's two takes). This sharpens the 480p drafts for
nothing, on a cloud session's processor, with Real-ESRGAN's small video model
(`realesr-general-x4v3`, BSD-3-Clause, 1.2 million weights).

No PyTorch: it cannot be installed from a sandbox (download.pytorch.org is
refused and PyPI's wheels pull several GB of CUDA). `build_onnx.py` rebuilds the
network in ONNX from the published `.pth`, reading it with a restricted
unpickler that only rebuilds tensors, and ONNX Runtime runs it.

```
python3 -m venv /tmp/esr/venv && /tmp/esr/venv/bin/pip install onnx onnxruntime numpy pillow
cd /tmp/esr
curl -sSLO https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.5.0/realesr-general-x4v3.pth
curl -sSLO https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.5.0/realesr-general-wdn-x4v3.pth
venv/bin/python -I build_onnx.py realesr-general-x4v3.pth srvgg-dn05.onnx realesr-general-wdn-x4v3.pth 0.5
venv/bin/python -I upscale_video.py srvgg-dn05.onnx <ffmpeg> take.mp4 take-esr.mp4      # 1080x1920, audio copied
```

(`<ffmpeg>` is `python3 -c "import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())"`.)
The upscaled take then goes through the reel's assembler in place of the draft.

- **Denoise strength 0.5, Real-ESRGAN's own default.** The plain model (1.0)
  smooths skin, beard and sofa fabric into a waxy look; 0.5 interpolates its
  weights with the light-denoise model and keeps that texture while still
  sharpening eyes, hair edges and knit. Compared on the same frame first.
- **About 3 s a frame on 4 cores**, so a 10 s take at 24 fps is about 13
  minutes. Frames stream through ffmpeg pipes; nothing large lands on disk.
- **What it cannot do:** it sharpens what is there, it does not redraw. A
  finished Seedance take re-renders the scene at high resolution, which may
  add real detail; this was not compared, because that costs the credits this
  exists to save.
