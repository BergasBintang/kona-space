#!/bin/bash
# Rebuilds the whole design file in FigCraft (FigCraft must be running with --control 7979).
cd "$(dirname "$0")"

for s in build-cleanup build-tokens build-parts build-parts2 build-parts3 build-components build-screens2a build-screens2b build-screens2c build-brain build-flow build-scroll build-wire build-rail; do
  echo "== $s"
  node $s.mjs 2>&1 | grep -v "MCP server" || true
done
echo ALL DONE
