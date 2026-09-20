#!/usr/bin/env bash
# Compile IrisChat.swift and deploy to ~/Applications/irischat.app
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
APP="$HOME/Applications/irischat.app"

echo "→ Compiling IrisChat.swift..."
swiftc -framework AppKit -framework Foundation \
  -o "$HOME/bin/iris-chat-app" \
  "$SCRIPT_DIR/apps/irischat/IrisChat.swift"

echo "→ Deploying to $APP..."
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
cp "$HOME/bin/iris-chat-app" "$APP/Contents/MacOS/irischat"
chmod +x "$APP/Contents/MacOS/irischat"

# Rebuild icon from favicon
ICONSET="/tmp/irischat.iconset"
mkdir -p "$ICONSET"
for SIZE in 16 32 64 128 256 512; do
  sips -z $SIZE $SIZE "$SCRIPT_DIR/website/favicon.png" --out "$ICONSET/icon_${SIZE}x${SIZE}.png" 2>/dev/null
  sips -z $((SIZE*2)) $((SIZE*2)) "$SCRIPT_DIR/website/favicon.png" --out "$ICONSET/icon_${SIZE}x${SIZE}@2x.png" 2>/dev/null
done
iconutil -c icns "$ICONSET" -o "$APP/Contents/Resources/irischat.icns"
touch "$APP"

echo "✅ Done. Run: open ~/Applications/irischat.app"
