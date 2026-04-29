#!/bin/bash
# MarkLight installer for macOS
# Run: chmod +x install.sh && ./install.sh MarkLight.dmg

set -e

DMG_FILE="$1"

if [ -z "$DMG_FILE" ]; then
  # Try to find the .dmg in the current directory
  DMG_FILE=$(ls -1 MarkLight*.dmg 2>/dev/null | head -1)
fi

if [ -z "$DMG_FILE" ] || [ ! -f "$DMG_FILE" ]; then
  echo "Usage: $0 <MarkLight.dmg>"
  echo "Or run this script from the same directory as the downloaded .dmg file."
  exit 1
fi

echo "Mounting $DMG_FILE..."
MOUNT_POINT=$(hdiutil attach "$DMG_FILE" -nobrowse -noautoopen | grep -o '/Volumes/.*' | head -1)

if [ -z "$MOUNT_POINT" ]; then
  echo "Failed to mount disk image."
  exit 1
fi

APP_NAME=$(basename "$MOUNT_POINT"/*.app 2>/dev/null | head -1)

if [ -z "$APP_NAME" ]; then
  echo "No .app bundle found in disk image."
  hdiutil detach "$MOUNT_POINT"
  exit 1
fi

echo "Installing $APP_NAME to /Applications..."
cp -R "$MOUNT_POINT/$APP_NAME" /Applications/

echo "Removing quarantine attribute..."
xattr -cr "/Applications/$APP_NAME"

echo "Detaching disk image..."
hdiutil detach "$MOUNT_POINT"

echo ""
echo "MarkLight has been installed to /Applications/"
echo "You can now launch it from Applications or Spotlight."
