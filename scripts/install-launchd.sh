#!/bin/zsh
set -euo pipefail

PLIST_NAME="com.fangbao.hkipo.refresh.plist"
SRC="/Users/fangbao/hk-ipo-site/launchd/$PLIST_NAME"
DST="/Users/fangbao/Library/LaunchAgents/$PLIST_NAME"

plutil -lint "$SRC"
cp "$SRC" "$DST"
launchctl bootout "gui/$(id -u)" "$DST" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$DST"
launchctl enable "gui/$(id -u)/com.fangbao.hkipo.refresh"
launchctl kickstart -k "gui/$(id -u)/com.fangbao.hkipo.refresh"
launchctl print "gui/$(id -u)/com.fangbao.hkipo.refresh"
