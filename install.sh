#!/usr/bin/env bash
# Install the Neon City look into Herdr desktop on this machine.
# Safe to re-run after pulling: it overwrites only the Neon City files. The first
# run also switches Herdr to the neon-islands layout; later runs leave your
# current layout alone.
set -euo pipefail

repo="$(cd "$(dirname "$0")" && pwd)"
src="$repo/neon-city"
herdr="${HERDR_APP_HOME:-$HOME/.config/herdr-app}"
mods=(neon-agents neon-pane neon-tabs islands-spaces islands-workspace-chrome islands-workspace-status)

if [ ! -d "$herdr" ]; then
  echo "No Herdr home at $herdr. Open Herdr once, then run this again." >&2
  exit 1
fi
first=true
[ -f "$herdr/layouts/neon-islands.json" ] && first=false

echo "Herdr: $herdr"
mkdir -p "$herdr"/{layouts,themes,mods,backgrounds}
cp "$src"/layouts/* "$herdr/layouts/"
cp "$src"/themes/*.json "$herdr/themes/"
cp "$src"/backgrounds/* "$herdr/backgrounds/"
for mod in "${mods[@]}"; do
  mkdir -p "$herdr/mods/$mod"
  cp "$src/mods/$mod"/* "$herdr/mods/$mod/"
done

if $first; then
  if command -v herdr-app >/dev/null 2>&1 && herdr-app status >/dev/null 2>&1; then
    if herdr-app do layout.switch --name neon-islands >/dev/null; then
      echo "Herdr: switched to the neon-islands layout."
    else
      echo "Herdr: couldn't switch layouts; pick neon-islands with Cmd/Ctrl-Shift-L." >&2
    fi
  else
    echo "Herdr isn't running: open it and pick the neon-islands layout (Cmd/Ctrl-Shift-L cycles layouts)."
  fi
else
  echo "Updated. Your current layout is unchanged."
fi
