#!/bin/sh
# Builds the seekable film project from the current game source. Usage: video/build-film.sh <seconds>
set -e
cd "$(dirname "$0")/.."
npx vite build --base ./ --outDir video/film/game --emptyOutDir >/dev/null
ENTRY=$(sed -n 's#.*src="\./\(assets/[^"]*\.js\)".*#\1#p' video/film/game/index.html | head -1)
sed -e "s#__DUR__#$1#" -e "s#__ENTRY__#$ENTRY#" video/film/index.html.tpl > video/film/index.html
echo "$ENTRY"
