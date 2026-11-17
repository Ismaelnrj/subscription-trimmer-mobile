# speech-segments.py <video>: split speech on silence and transcribe each piece with Whisper base.en.
# Model: sherpa-onnx-whisper-base.en (k2-fsa/sherpa-onnx release asr-models), unpacked under /tmp/asr/base. README item 23.
import sys, subprocess, re, wave, numpy as np, sherpa_onnx, imageio_ffmpeg, tempfile, os
FF = imageio_ffmpeg.get_ffmpeg_exe()
src = sys.argv[1]
M = '/tmp/asr/base/sherpa-onnx-whisper-base.en/'
rec = sherpa_onnx.OfflineRecognizer.from_whisper(encoder=M+'base.en-encoder.int8.onnx', decoder=M+'base.en-decoder.int8.onnx', tokens=M+'base.en-tokens.txt', language='en', task='transcribe')
wav = tempfile.mktemp(suffix='.wav')
subprocess.run([FF,'-v','error','-y','-i',src,'-ac','1','-ar','16000',wav],check=True)
out = subprocess.run([FF,'-i',wav,'-af','silencedetect=noise=-32dB:d=0.25','-f','null','-'],capture_output=True,text=True).stderr
starts=[float(x) for x in re.findall(r'silence_start: ([\d.]+)',out)]; ends=[float(x) for x in re.findall(r'silence_end: ([\d.]+)',out)]
w=wave.open(wav); n=w.getnframes(); a=np.frombuffer(w.readframes(n),dtype=np.int16).astype(np.float32)/32768; dur=n/16000
# speech = gaps between silences
segs=[]; t=0.0
for s,e in zip(starts, ends+[dur]*(len(starts)-len(ends))):
    if s-t>0.15: segs.append((t,s))
    t=e
if dur-t>0.15: segs.append((t,dur))
for s,e in segs:
    st=rec.create_stream(); st.accept_waveform(16000,a[int(s*16000):int(e*16000)]); rec.decode_stream(st)
    print(f'{s:6.2f} {e:6.2f}  {st.result.text.strip()}')
os.remove(wav)
