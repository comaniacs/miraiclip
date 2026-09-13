#!/usr/bin/env bash
# Generates the (uncommitted, ~too-big-for-git) 4K30 fixture for the optional
# 4K→1080p throughput benchmark. Fast, low-quality encode on purpose — the
# benchmark measures OUR pipeline, not libvpx aesthetics.
set -euo pipefail
cd "$(dirname "$0")/../public"
ffmpeg -hide_banner -y \
  -f lavfi -i "testsrc2=size=3840x2160:rate=30:duration=60" \
  -c:v libvpx-vp9 -deadline realtime -cpu-used 8 -b:v 12M \
  -auto-alt-ref 0 -lag-in-frames 0 -g 30 -pix_fmt yuv420p \
  e2e-4k.webm
echo "wrote $(pwd)/e2e-4k.webm"
