#!/usr/bin/env bash
# Corpus fixtures, generated with ffmpeg (committed once — small and deterministic):
#
#   corpus-sync.webm  8s, 320×180@30 VP9 + Opus. Video: every frame's index is
#                     its color (same formula as e2e-frames.webm — the pixel
#                     oracle). Audio: a 20ms 880Hz burst starting exactly at
#                     each whole second, silence elsewhere — decoded burst
#                     positions vs frame timestamps measure A/V offset at any
#                     point in a file, so drift = offset(end) − offset(start).
#
#   corpus-bars.png   SMPTE color bars still — catches range/matrix errors
#                     (bt601 vs 709, full vs limited) that the frame-index
#                     tolerance can absorb.
#
# Regenerate: bash packages/server-export/corpus/make-fixtures.sh
set -euo pipefail
DIR="$(cd "$(dirname "$0")/../../../apps/playground/public" && pwd)"

ffmpeg -y -f lavfi -i "color=c=black:size=320x180:rate=30:duration=8" \
  -f lavfi -i "aevalsrc=0.5*sin(2*PI*880*t)*lt(mod(t\,1)\,0.02):s=48000:d=8" \
  -vf "geq=r='mod(floor(N)*16,256)':g='16*floor(floor(N)/16)':b=128" \
  -c:v libvpx-vp9 -pix_fmt yuv420p -b:v 1M -auto-alt-ref 0 -lag-in-frames 0 \
  -c:a libopus -b:a 96k \
  "$DIR/corpus-sync.webm"

ffmpeg -y -f lavfi -i "smptebars=size=320x180:rate=1:duration=1" -frames:v 1 \
  "$DIR/corpus-bars.png"

echo "wrote $DIR/corpus-sync.webm and $DIR/corpus-bars.png"
