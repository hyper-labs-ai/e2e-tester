#!/usr/bin/env bash
set -euo pipefail

# E2E Tester — one-command installer
#   curl -fsSL https://raw.githubusercontent.com/hyper-labs-ai/e2e-tester/main/install.sh | bash
#   curl -fsSL https://raw.githubusercontent.com/hyper-labs-ai/e2e-tester/main/install.sh | bash -s -- --symlink

REPO="hyper-labs-ai/e2e-tester"
BRANCH="${BRANCH:-main}"
TMP_DIR=$(mktemp -d)
VERSION=""
CLEANUP=1

trap 'rm -rf "$TMP_DIR"' EXIT

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

print_step() { echo -e "${BLUE}==>${NC} $1"; }
print_ok()   { echo -e "  ${GREEN}✓${NC} $1"; }
print_err()  { echo -e "  ${RED}✗${NC} $1"; }

usage() {
    cat << EOF
${BLUE}E2E Tester Installer${NC}

${CYAN}Usage:${NC}
    curl -fsSL https://raw.githubusercontent.com/${REPO}/${BRANCH}/install.sh | bash
    curl -fsSL https://raw.githubusercontent.com/${REPO}/${BRANCH}/install.sh | bash -s -- --symlink
    curl -fsSL https://raw.githubusercontent.com/${REPO}/${BRANCH}/install.sh | bash -s -- --prefix ~/custom

${CYAN}Options:${NC}
    --symlink     Symlink for development (Linux/macOS)
    --prefix <d>  Custom install prefix (default: ~/.agents/agents.d/e2e-tester)
    --agents <d>  Agent builder directory (default: ~/.agents)
EOF
    exit 0
}

# Parse args
SYMLINK=""
PREFIX=""
AGENTS=""

while [[ $# -gt 0 ]]; do
    case "$1" in
        --symlink) SYMLINK="--symlink"; shift ;;
        --prefix) PREFIX="--prefix $2"; shift 2 ;;
        --agents) AGENTS="--agents $2"; shift 2 ;;
        --help|-h) usage ;;
        *) print_err "Unknown option: $1"; usage ;;
    esac
done

# Detect platform
ARCH=$(uname -m)
OS=$(uname -s | tr '[:upper:]' '[:lower:]')
case "$OS" in
    linux)   ;;
    darwin)  ;;
    mingw*|msys*|cygwin*)
        print_err "Windows detected. Use Git Bash or WSL, or run:
  npx tsx scripts/e2e-plan-manager.ts install"
        exit 1
        ;;
    *) print_err "Unsupported OS: $OS"; exit 1 ;;
esac

print_step "Downloading E2E Tester from ${REPO} (${BRANCH})"

# Try GitHub archive first, fall back to raw file download
if command -v curl &>/dev/null; then
    DL="curl -fsSL"
elif command -v wget &>/dev/null; then
    DL="wget -qO-"
else
    print_err "Neither curl nor wget found. Install one of them and retry."
    exit 1
fi

# Download as tarball from GitHub
ARCHIVE_URL="https://github.com/${REPO}/archive/refs/heads/${BRANCH}.tar.gz"
$DL "$ARCHIVE_URL" | tar -xz -C "$TMP_DIR" 2>/dev/null || {
    print_err "Failed to download from ${ARCHIVE_URL}"
    print_err "Check that the repository and branch exist."
    exit 1
}

# The archive extracts to e2e-tester-<branch>
SRC_DIR="$TMP_DIR/e2e-tester-${BRANCH}"
if [ ! -d "$SRC_DIR" ]; then
    # GitHub sometimes strips the ref: try matching pattern
    SRC_DIR=$(find "$TMP_DIR" -maxdepth 1 -type d -name "e2e-tester*" | head -1)
fi

if [ ! -d "$SRC_DIR" ]; then
    print_err "Extracted source not found."
    exit 1
fi

cd "$SRC_DIR"

print_step "Installing..."
echo ""

# Prefer the Node.js install command (cross-platform); fall back to bash script
if command -v npx &>/dev/null; then
    npx tsx scripts/e2e-plan-manager.ts install $SYMLINK $PREFIX $AGENTS
else
    # Fallback to bash script
    bash scripts/install.sh $SYMLINK $PREFIX $AGENTS
fi

echo ""
print_ok "Installation complete!"
echo ""
echo "  ${CYAN}Next steps:${NC}"
echo "  ${CYAN}  - Install the e2e-test-plan skill for CREATE mode:${NC}"
echo "      git clone https://github.com/hyper-labs-ai/e2e-test-plan ~/.agents/skills/e2e-test-plan"
echo "  ${CYAN}  - Verify installation:${NC}"
echo "      npx tsx scripts/e2e-plan-manager.ts list"
echo "  ${CYAN}  - Or check the agent system:${NC}"
echo "      agent-compose list"
echo ""
