#!/usr/bin/env bash
set -e

echo "Downloading Viktor Script..."

OS="$(uname -s)"
ARCH="$(uname -m)"

if [ "$OS" == "Linux" ]; then
    RELEASE="vks-linux-x64.tar.gz"
elif [ "$OS" == "Darwin" ]; then
    RELEASE="vks-macos-x64.tar.gz"
else
    echo "Unsupported OS: $OS"
    exit 1
fi

if [ "$ARCH" != "x86_64" ] && [ "$ARCH" != "amd64" ]; then
    echo "Unsupported Architecture: $ARCH. Only x86_64 is currently supported."
    # We could support arm64 macos eventually but sticking to x64 for MVP
fi

INSTALL_DIR="$HOME/.vks"
DOWNLOAD_URL="https://github.com/viktor/vks/releases/latest/download/$RELEASE"

echo "Fetching $DOWNLOAD_URL"
mkdir -p "$INSTALL_DIR"
cd "$INSTALL_DIR"

curl -sL "$DOWNLOAD_URL" -o "$RELEASE" || { echo "Failed to download release from $DOWNLOAD_URL"; exit 1; }
tar -xzf "$RELEASE"
rm "$RELEASE"

echo "Viktor Script has been installed to $INSTALL_DIR"

PROFILE=""
if [ -f "$HOME/.bashrc" ]; then
    PROFILE="$HOME/.bashrc"
elif [ -f "$HOME/.zshrc" ]; then
    PROFILE="$HOME/.zshrc"
elif [ -f "$HOME/.profile" ]; then
    PROFILE="$HOME/.profile"
fi

if [ -n "$PROFILE" ]; then
    if ! grep -q "VKS_HOME" "$PROFILE"; then
        echo "" >> "$PROFILE"
        echo "export VKS_HOME=\"$INSTALL_DIR\"" >> "$PROFILE"
        echo "export PATH=\"\$VKS_HOME/bin:\$PATH\"" >> "$PROFILE"
        echo "Added VKS to $PROFILE. Please restart your terminal or run: source $PROFILE"
    else
        echo "VKS_HOME already exists in $PROFILE"
    fi
else
    echo "Could not automatically add to PATH."
    echo "Please add the following to your shell profile manually:"
    echo "export VKS_HOME=\"$INSTALL_DIR\""
    echo "export PATH=\"\$VKS_HOME/bin:\$PATH\""
fi

echo "Installation Complete! Try running 'vks'"
