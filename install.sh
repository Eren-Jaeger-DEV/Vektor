#!/usr/bin/env bash
# ============================================================
# Vektor — Standalone One-Line Installer (Linux & macOS)
# ============================================================
set -e

echo "🚀 Installing Vektor Programming Language..."

OS="$(uname -s)"
ARCH="$(uname -m)"

INSTALL_DIR="$HOME/.vektor"
BIN_DIR="$INSTALL_DIR/bin"
STDLIB_DIR="$INSTALL_DIR/stdlib"

mkdir -p "$BIN_DIR"
mkdir -p "$STDLIB_DIR"

IS_LOCAL=0
if [ "$1" == "--local" ]; then
    IS_LOCAL=1
fi

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ $IS_LOCAL -eq 1 ]; then
    echo "  📦 Installing from local repository ($REPO_ROOT)..."
    
    if [ -f "$REPO_ROOT/vektor" ]; then
        cp "$REPO_ROOT/vektor" "$BIN_DIR/vektor"
        chmod +x "$BIN_DIR/vektor"
    else
        mkdir -p "$INSTALL_DIR/src"
        cp -r "$REPO_ROOT/src/"* "$INSTALL_DIR/src/" 2>/dev/null || true
        [ -f "$REPO_ROOT/compiler.vkb" ] && cp "$REPO_ROOT/compiler.vkb" "$INSTALL_DIR/" 2>/dev/null || true
        [ -f "$REPO_ROOT/package.json" ] && cp "$REPO_ROOT/package.json" "$INSTALL_DIR/" 2>/dev/null || true
        [ -f "$REPO_ROOT/runtime.c" ] && cp "$REPO_ROOT/runtime.c" "$INSTALL_DIR/" 2>/dev/null || true
        [ -f "$REPO_ROOT/thread_posix.c" ] && cp "$REPO_ROOT/thread_posix.c" "$INSTALL_DIR/" 2>/dev/null || true
        [ -f "$REPO_ROOT/vektor_runtime_ext.c" ] && cp "$REPO_ROOT/vektor_runtime_ext.c" "$INSTALL_DIR/" 2>/dev/null || true
        
        cat << 'EOF' > "$BIN_DIR/vektor"
#!/usr/bin/env bash
VEKTOR_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
exec npx tsx "$VEKTOR_DIR/src/main.ts" "$@"
EOF
        chmod +x "$BIN_DIR/vektor"
    fi
    
    if [ -d "$REPO_ROOT/stdlib" ]; then
        cp -r "$REPO_ROOT/stdlib/"* "$STDLIB_DIR/" 2>/dev/null || true
    fi
    echo "  ✓ Local binaries and stdlib installed to $INSTALL_DIR"
else
    RELEASE=""
    if [ "$OS" == "Linux" ]; then
        RELEASE="vektor-linux-x64.tar.gz"
    elif [ "$OS" == "Darwin" ]; then
        RELEASE="vektor-macos-x64.tar.gz"
    else
        echo "✗ Unsupported OS: $OS"
        exit 1
    fi

    DOWNLOAD_URL="https://github.com/Eren-Jaeger-DEV/VKS/releases/latest/download/$RELEASE"
    TMP_FILE="$(mktemp)"

    echo "  ↓ Fetching $DOWNLOAD_URL..."
    if curl -fsSL "$DOWNLOAD_URL" -o "$TMP_FILE" 2>/dev/null; then
        tar -xzf "$TMP_FILE" -C "$INSTALL_DIR"
        rm -f "$TMP_FILE"
        echo "  ✓ Downloaded and unpacked release to $INSTALL_DIR"
    else
        echo "  ℹ Prebuilt release binary not online yet. Installing CLI wrapper..."
        mkdir -p "$INSTALL_DIR/src"
        cp -r "$REPO_ROOT/src/"* "$INSTALL_DIR/src/" 2>/dev/null || true
        [ -f "$REPO_ROOT/compiler.vkb" ] && cp "$REPO_ROOT/compiler.vkb" "$INSTALL_DIR/" 2>/dev/null || true
        
        cat << 'EOF' > "$BIN_DIR/vektor"
#!/usr/bin/env bash
VEKTOR_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
exec npx tsx "$VEKTOR_DIR/src/main.ts" "$@"
EOF
        chmod +x "$BIN_DIR/vektor"
        echo "  ✓ Installed CLI wrapper to $BIN_DIR/vektor"
    fi
fi

# Setup Environment & Shell Profiles
PROFILES=("$HOME/.bashrc" "$HOME/.zshrc" "$HOME/.profile" "$HOME/.config/fish/config.fish")

for PROFILE in "${PROFILES[@]}"; do
    if [ -f "$PROFILE" ]; then
        if ! grep -q "VEKTOR_HOME" "$PROFILE"; then
            echo "" >> "$PROFILE"
            echo "export VEKTOR_HOME=\"$INSTALL_DIR\"" >> "$PROFILE"
            echo "export PATH=\"\$VEKTOR_HOME/bin:\$PATH\"" >> "$PROFILE"
            echo "  ✓ Added VEKTOR_HOME to $PROFILE"
        fi
    fi
done

echo ""
echo "🎉 Vektor installation complete!"
echo "   Directory: $INSTALL_DIR"
echo "   Run 'vektor --version' or restart your terminal to get started."
