from pathlib import Path

import numpy as np
import sounddevice as sd
import soundfile as sf


def record_wav(output_path: str, duration_sec: int = 10, sample_rate: int = 16000) -> str:
    """
    Records from the default laptop microphone.
    Works only when FastAPI runs on the same machine as the mic.
    """
    if duration_sec < 1 or duration_sec > 120:
        raise ValueError("duration_sec must be between 1 and 120")

    path = Path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)

    frames = int(duration_sec * sample_rate)
    audio = sd.rec(frames, samplerate=sample_rate, channels=1, dtype="float32")
    sd.wait()

    # soundfile expects shape (samples, channels)
    if audio.ndim == 1:
        audio = audio.reshape(-1, 1)

    sf.write(str(path), audio, sample_rate)
    return str(path)