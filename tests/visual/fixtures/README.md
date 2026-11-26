# Synthetic playback fixture

`loop-with-audio.mp4` is a six-second green square with a quiet 220 Hz tone.
It contains no user content. Browser tests serve it locally through intercepted
media requests to exercise real H.264/AAC playback and mute behavior offline.

Regenerate with FFmpeg:

```sh
ffmpeg -f lavfi -i color=c=0x0B483C:s=480x480:r=15:d=6 \
  -f lavfi -i sine=frequency=220:sample_rate=44100:duration=6 \
  -af volume=0.03 -c:v libx264 -pix_fmt yuv420p -c:a aac -b:a 32k \
  -movflags +faststart -shortest tests/visual/fixtures/loop-with-audio.mp4
```
