#!/usr/bin/env bash
# Copy this machine's live Neon City files back into the repo, to commit changes
# made in Herdr. The reverse of install.sh.
set -euo pipefail

repo="$(cd "$(dirname "$0")" && pwd)"
dest="$repo/neon-city"
herdr="${HERDR_APP_HOME:-$HOME/.config/herdr-app}"
mods=(neon-agents neon-pane neon-tabs islands-spaces islands-workspace-chrome islands-workspace-status)

for f in cyberpunk.json neon-islands.json neon-islands.svg; do
  cp "$herdr/layouts/$f" "$dest/layouts/"
done
cp "$herdr/themes/neon-city.json" "$dest/themes/"
cp "$herdr"/backgrounds/neon-* "$dest/backgrounds/"
for mod in "${mods[@]}"; do
  rm -rf "$dest/mods/$mod"
  mkdir -p "$dest/mods/$mod"
  for f in "$herdr/mods/$mod"/*; do
    case "$(basename "$f")" in
      gpui-kit.d.ts | jsconfig.json) ;; # editor typings Herdr writes; not part of the look
      *) cp "$f" "$dest/mods/$mod/" ;;
    esac
  done
done
git -C "$repo" status --short
