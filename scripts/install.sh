#!/usr/bin/env bash
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
VERSION="$(grep '"version"' "$REPO_DIR/package.json" | head -1 | sed 's/.*"version": "\(.*\)".*/\1/')"

# Default install locations
AGENTS_DIR="${AGENTS_DIR:-$HOME/.agents}"
PREFIX="${AGENTS_DIR}/agents.d/e2e-tester"
BUILDER_DIR="${AGENTS_DIR}/skills/agent-builder"
MODE="copy"

print_usage() {
    cat << EOF
${BLUE}E2E Tester Installer${NC} v${VERSION}

${CYAN}Usage:${NC}
    bash scripts/install.sh [options]

${CYAN}Options:${NC}
    --prefix <dir>     Install to a custom prefix (default: ~/.agents/agents.d/e2e-tester)
    --agents <dir>     Agent builder directory (default: ~/.agents)
    --symlink          Use symlinks instead of copies (for development)
    --dry-run          Show what would be done without doing it
    --uninstall        Remove installed files
    --help             Show this help

${CYAN}Examples:${NC}
    bash scripts/install.sh                          # Default install
    bash scripts/install.sh --symlink                 # Dev install with symlinks
    bash scripts/install.sh --prefix ~/custom/path    # Custom location
    bash scripts/install.sh --uninstall              # Remove from system
EOF
}

print_step() { echo -e "${BLUE}==>${NC} $1"; }
print_ok()   { echo -e "  ${GREEN}✓${NC} $1"; }
print_skip() { echo -e "  ${YELLOW}→${NC} $1"; }
print_err()  { echo -e "  ${RED}✗${NC} $1"; }

do_install() {
    if [ "$MODE" = "dry-run" ]; then
        print_step "[DRY RUN] Would install E2E Tester v${VERSION} to ${PREFIX}"
        echo ""
        echo "  Files to install:"
        for src in "${!FILES[@]}"; do
            echo "    ${src} → ${FILES[$src]}"
        done
        for src in "${!SELFCONTAINED[@]}"; do
            echo "    ${src} → ${SELFCONTAINED[$src]}"
        done
        echo ""
        print_ok "Dry run complete — no changes made"
        return
    fi

    print_step "Installing E2E Tester v${VERSION} to ${PREFIX}"

    # Create target directories
    mkdir -p "$PREFIX"/{primitive,scripts,references,workflows}
    mkdir -p "$BUILDER_DIR"/primitives/definitions
    mkdir -p "$BUILDER_DIR"/scripts
    mkdir -p "$BUILDER_DIR"/references
    mkdir -p "$BUILDER_DIR"/composer/examples

    # Files to deploy
    declare -A FILES=(
        ["primitive/e2e-tester.json"]="$BUILDER_DIR/primitives/definitions/e2e-tester.json"
        ["scripts/e2e-plan-manager.ts"]="$BUILDER_DIR/scripts/e2e-plan-manager.ts"
        ["references/e2e-execution-guide.md"]="$BUILDER_DIR/references/e2e-execution-guide.md"
        ["workflows/e2e-test-workflow.json"]="$BUILDER_DIR/composer/examples/e2e-test-workflow.json"
    )

    # Also deploy to self-contained directory
    declare -A SELFCONTAINED=(
        ["install.sh"]="$PREFIX/install.sh"
        ["primitive/e2e-tester.json"]="$PREFIX/primitive/e2e-tester.json"
        ["scripts/e2e-plan-manager.ts"]="$PREFIX/scripts/e2e-plan-manager.ts"
        ["references/e2e-execution-guide.md"]="$PREFIX/references/e2e-execution-guide.md"
        ["workflows/e2e-test-workflow.json"]="$PREFIX/workflows/e2e-test-workflow.json"
        ["README.md"]="$PREFIX/README.md"
        ["LICENSE"]="$PREFIX/LICENSE"
        ["package.json"]="$PREFIX/package.json"
    )

    # Deploy to agent-builder integration points
    for src in "${!FILES[@]}"; do
        local dst="${FILES[$src]}"
        local src_path="$REPO_DIR/$src"

        if [ ! -f "$src_path" ]; then
            print_err "Source not found: $src_path"
            continue
        fi

        if [ "$MODE" = "symlink" ]; then
            ln -sf "$src_path" "$dst"
            print_ok "Symlinked $src → ${dst#$AGENTS_DIR/}"
        else
            cp "$src_path" "$dst"
            print_ok "Copied ${src#$PREFIX/} → ${dst#$AGENTS_DIR/}"
        fi
    done

    # Deploy to self-contained directory
    for src in "${!SELFCONTAINED[@]}"; do
        local dst="${SELFCONTAINED[$src]}"
        local src_path="$REPO_DIR/$src"

        if [ ! -f "$src_path" ]; then
            print_skip "Source not found: $src_path (not critical)"
            continue
        fi

        mkdir -p "$(dirname "$dst")"
        if [ "$MODE" = "symlink" ]; then
            ln -sf "$src_path" "$dst"
        else
            cp "$src_path" "$dst"
        fi
    done

    # Make scripts executable
    chmod +x "$PREFIX/install.sh" 2>/dev/null || true
    chmod +x "$PREFIX/scripts/e2e-plan-manager.ts" 2>/dev/null || true
    chmod +x "$BUILDER_DIR/scripts/e2e-plan-manager.ts" 2>/dev/null || true

    # Create results/screenshots directories
    mkdir -p "$PREFIX/results" "$PREFIX/screenshots"

    print_ok "Installation complete"

    # Verify
    if [ -f "$BUILDER_DIR/primitives/definitions/e2e-tester.json" ]; then
        print_ok "Primitive registered: e2e-tester (v${VERSION})"
    else
        print_err "Primitive registration failed"
    fi

    echo ""
    echo -e "  ${CYAN}Run${NC} ${GREEN}agent-compose list${NC} ${CYAN}to verify installation${NC}"
    echo -e "  ${CYAN}Run${NC} ${GREEN}agent-compose show e2e-tester${NC} ${CYAN}to see primitive details${NC}"
}

do_uninstall() {
    print_step "Uninstalling E2E Tester"

    local files_removed=0

    # Remove from agent-builder integration points
    local targets=(
        "$BUILDER_DIR/primitives/definitions/e2e-tester.json"
        "$BUILDER_DIR/scripts/e2e-plan-manager.ts"
        "$BUILDER_DIR/references/e2e-execution-guide.md"
        "$BUILDER_DIR/composer/examples/e2e-test-workflow.json"
    )

    for f in "${targets[@]}"; do
        if [ -f "$f" ] || [ -L "$f" ]; then
            rm -f "$f"
            print_ok "Removed ${f#$AGENTS_DIR/}"
            ((files_removed++))
        fi
    done

    # Remove self-contained directory
    if [ -d "$PREFIX" ]; then
        rm -rf "$PREFIX"
        print_ok "Removed $PREFIX"
        ((files_removed++))
    fi

    if [ "$files_removed" -eq 0 ]; then
        print_skip "No files to remove — E2E Tester not installed"
    else
        print_ok "Uninstall complete ($files_removed items removed)"
    fi
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case "$1" in
        --prefix) PREFIX="$2"; shift 2 ;;
        --agents) AGENTS_DIR="$2"; BUILDER_DIR="$AGENTS_DIR/skills/agent-builder"; shift 2 ;;
        --symlink) MODE="symlink"; shift ;;
        --dry-run) MODE="dry-run"; shift ;;
        --uninstall) ACTION="uninstall"; shift ;;
        --help) print_usage; exit 0 ;;
        *) print_err "Unknown option: $1"; print_usage; exit 1 ;;
    esac
done

case "${ACTION:-install}" in
    install)
        do_install
        ;;
    uninstall)
        do_uninstall
        ;;
esac
