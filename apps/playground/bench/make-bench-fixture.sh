#!/usr/bin/env bash
# 1080p30 frame-index fixture for the device benchmark's Standard workload —
# 60s, every frame's color encodes its index. Extends the e2e formula with
# high bits in BLUE (128 + 16·⌊N/256⌋): the r/g encoding saturates at frame
# 256 (~8.5s), blue carries ⌊N/256⌋ up to 2048 frames (68s).
# ~10-20MB: generated locally, never committed (bench skips its 1080p
# scenarios when absent and falls back to the small fixture with a note).
#
#   bash apps/playground/bench/make-bench-fixture.sh
set -euo pipefail
DIR="$(cd "$(dirname "$0")/../public" && pwd)"

# The RGB→YUV conversion is pinned to bt709 limited range AND tagged in the
# stream. Untagged HD video makes every decoder GUESS the matrix, and they
# disagree: a hardware decoder (VideoToolbox) and Chromium's software VP9 can
# recover colors ~8-15 apart on the same file — enough to flip a 16-step
# quantum and make the pixel oracle read frame N+272 for frame N (seen on a
# real device: seeks completed but "never" matched). Tagged, they all agree.
ffmpeg -y -f lavfi -i "color=c=black:size=1920x1080:rate=30:duration=60" \
  -vf "geq=r='mod(floor(N)*16,256)':g='mod(16*floor(floor(N)/16),256)':b='128+16*floor(floor(N)/256)',scale=out_color_matrix=bt709:out_range=tv,format=yuv420p" \
  -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv \
  -c:v libvpx-vp9 -b:v 6M -auto-alt-ref 0 -lag-in-frames 0 \
  -g 30 -deadline realtime -cpu-used 8 \
  "$DIR/bench-1080.webm"

echo "wrote $DIR/bench-1080.webm"
