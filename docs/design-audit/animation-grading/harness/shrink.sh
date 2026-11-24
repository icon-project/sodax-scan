#!/bin/zsh
# downscale any filmstrip PNG over 1.4 MB
D=${1:-/Users/david/Github/sodax-scan/docs/design-audit/animation-grading}
for f in $D/*.png; do
  while [ $(stat -f%z "$f") -gt 1468006 ]; do
    /opt/homebrew/bin/ffmpeg -y -loglevel error -i "$f" -vf "scale=iw*0.8:-1" -update 1 "$f.tmp.png" && mv "$f.tmp.png" "$f"
  done
done
