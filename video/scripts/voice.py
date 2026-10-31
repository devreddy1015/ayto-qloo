"""Writes one Kokoro voice clip per line of lines.json: python voice.py <model-dir> <dir-with-lines.json> <voice> [speed] [only-id]

The model files (kokoro-v1.0.onnx, voices-v1.0.bin) come from github.com/thewh1teagle/kokoro-onnx releases. Needs
PHONEMIZER_ESPEAK_LIBRARY=/usr/lib/libespeak-ng.so: the bundled espeak data path breaks on long paths.
"""
import sys, json, soundfile as sf
from kokoro_onnx import Kokoro, EspeakConfig
models, out, voice = sys.argv[1], sys.argv[2], sys.argv[3]
speed = float(sys.argv[4]) if len(sys.argv) > 4 else 1.0
only = sys.argv[5] if len(sys.argv) > 5 else None
k = Kokoro(f"{models}/kokoro-v1.0.onnx", f"{models}/voices-v1.0.bin", espeak_config=EspeakConfig(data_path="/usr/share/espeak-ng-data"))
lines = json.load(open(f"{out}/lines.json"))
durs = {}
for sid, text in lines.items():
    if only and sid != only: continue
    samples, sr = k.create(text, voice=voice, speed=speed, lang="en-us")
    sf.write(f"{out}/{sid}.wav", samples, sr)
    durs[sid] = round(len(samples) / sr, 2)
print(json.dumps(durs))
