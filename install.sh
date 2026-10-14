#!/bin/bash
set -e

EXTENSION_UUID="zabbix-monitor@loginone"
INSTALL_DIR="$HOME/.local/share/gnome-shell/extensions/$EXTENSION_UUID"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🚀 Installing/Updating GNOME Extension: $EXTENSION_UUID"

# 1. Compile GSettings schemas
glib-compile-schemas "$SCRIPT_DIR/schemas/"

# 2. Create extension directory if it doesn't exist
mkdir -p "$INSTALL_DIR"

# 3. Copy source files
cp "$SCRIPT_DIR/metadata.json" "$INSTALL_DIR/"
cp "$SCRIPT_DIR/extension.js" "$INSTALL_DIR/"
cp "$SCRIPT_DIR/indicator.js" "$INSTALL_DIR/"
cp "$SCRIPT_DIR/zabbixApi.js" "$INSTALL_DIR/"
cp "$SCRIPT_DIR/prefs.js" "$INSTALL_DIR/"
cp "$SCRIPT_DIR/stylesheet.css" "$INSTALL_DIR/"
cp "$SCRIPT_DIR/LICENSE" "$INSTALL_DIR/"
cp -r "$SCRIPT_DIR/schemas" "$INSTALL_DIR/"

echo "📁 Files copied to $INSTALL_DIR"

# 4. Create zip bundle for distribution
gnome-extensions pack -f \
    --extra-source=indicator.js \
    --extra-source=zabbixApi.js \
    --extra-source=stylesheet.css \
    --extra-source=LICENSE \
    --schema=schemas/org.gnome.shell.extensions.zabbix-monitor.gschema.xml \
    -o "$SCRIPT_DIR/" 2>/dev/null || true
echo "📦 Extension zip package rebuilt!"

# 5. Enable extension in GNOME settings
if command -v gnome-extensions &> /dev/null; then
    gnome-extensions enable "$EXTENSION_UUID" 2>/dev/null || true
fi

echo "✅ Success! To apply changes immediately:"
echo "   - On X11: Press Alt+F2, type 'r' and press Enter."
echo "   - On Wayland: Log out and log back in."
