#!/usr/bin/env bash
# ============================================================
# Vektor — Test Installer Script
# ============================================================
set -e

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"

echo "🧪 Testing Vektor One-Line Installer..."

./install.sh --local

VEKTOR_BIN="$HOME/.vektor/bin/vektor"

if [ -f "$VEKTOR_BIN" ]; then
    echo "  ✓ Installer created binary at $VEKTOR_BIN"
    "$VEKTOR_BIN" --version 2>/dev/null || "$VEKTOR_BIN" examples/hello.vk --run
    echo "  🎉 SUCCESS: Installer test passed cleanly!"
else
    echo "  ✗ ERROR: $VEKTOR_BIN was not created."
    exit 1
fi
