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
PACKAGE_NAME="e2e-tester"

print_usage() {
    cat << EOF
${BLUE}E2E Tester Package Builder${NC} v${VERSION}

${CYAN}Usage:${NC}
    bash scripts/package.sh [options]

${CYAN}Options:${NC}
    --output <dir>   Output directory (default: $REPO_DIR/dist)
    --format <fmt>   Package format: tar.gz (default), zip
    --version <ver>  Override version (default: from package.json)
    --help           Show this help

${CYAN}Examples:${NC}
    bash scripts/package.sh                               # Build dist/e2e-tester-v1.0.0.tar.gz
    bash scripts/package.sh --format zip                  # Build .zip instead
    bash scripts/package.sh --output /tmp/releases        # Custom output directory
EOF
}

print_step() { echo -e "${BLUE}==>${NC} $1"; }
print_ok()   { echo -e "  ${GREEN}✓${NC} $1"; }
print_err()  { echo -e "  ${RED}✗${NC} $1"; }

# Parse arguments
OUTPUT_DIR="$REPO_DIR/dist"
FORMAT="tar.gz"

while [[ $# -gt 0 ]]; do
    case "$1" in
        --output) OUTPUT_DIR="$2"; shift 2 ;;
        --format) FORMAT="$2"; shift 2 ;;
        --version) VERSION="$2"; shift 2 ;;
        --help) print_usage; exit 0 ;;
        *) print_err "Unknown option: $1"; print_usage; exit 1 ;;
    esac
done

FILENAME="${PACKAGE_NAME}-v${VERSION}"
OUTPUT_DIR="$(cd "$OUTPUT_DIR" 2>/dev/null && pwd || mkdir -p "$OUTPUT_DIR" && cd "$OUTPUT_DIR" && pwd)"

print_step "Building ${PACKAGE_NAME} v${VERSION}"
echo ""
echo "  Source:      $REPO_DIR"
echo "  Output:      $OUTPUT_DIR/${FILENAME}.${FORMAT}"
echo "  Format:      ${FORMAT}"
echo ""

# Check git status
if git -C "$REPO_DIR" rev-parse --git-dir > /dev/null 2>&1; then
    GIT_STATUS=$(git -C "$REPO_DIR" status --porcelain)
    if [ -n "$GIT_STATUS" ]; then
        echo -e "  ${YELLOW}⚠ Warning: Working tree is not clean${NC}"
        echo "  Uncommitted changes will be included in the package."
        echo ""
    fi
    GIT_REV=$(git -C "$REPO_DIR" rev-parse --short HEAD)
    echo "  Git rev:     $GIT_REV"
    echo ""
fi

# Build the package
print_step "Creating package..."

BUILD_DIR=$(mktemp -d)
trap "rm -rf '$BUILD_DIR'" EXIT

# Create package structure
PACKAGE_DIR="$BUILD_DIR/$FILENAME"
mkdir -p "$PACKAGE_DIR"/{primitive,scripts,references,workflows,tests}

# Copy files
cp "$REPO_DIR/README.md" "$PACKAGE_DIR/"
cp "$REPO_DIR/LICENSE" "$PACKAGE_DIR/"
cp "$REPO_DIR/package.json" "$PACKAGE_DIR/"
cp "$REPO_DIR/.gitignore" "$PACKAGE_DIR/" 2>/dev/null || true

cp "$REPO_DIR/primitive/e2e-tester.json" "$PACKAGE_DIR/primitive/"
cp "$REPO_DIR/scripts/e2e-plan-manager.ts" "$PACKAGE_DIR/scripts/"
cp "$REPO_DIR/scripts/install.sh" "$PACKAGE_DIR/scripts/"
cp "$REPO_DIR/references/e2e-execution-guide.md" "$PACKAGE_DIR/references/"
cp "$REPO_DIR/workflows/e2e-test-workflow.json" "$PACKAGE_DIR/workflows/"

# Make scripts executable
chmod +x "$PACKAGE_DIR/scripts/install.sh"
chmod +x "$PACKAGE_DIR/scripts/e2e-plan-manager.ts"

print_ok "Files staged at $BUILD_DIR/$FILENAME"

# Create archive
mkdir -p "$OUTPUT_DIR"

case "$FORMAT" in
    tar.gz)
        tar -C "$BUILD_DIR" -czf "$OUTPUT_DIR/$FILENAME.tar.gz" "$FILENAME"
        print_ok "Created $OUTPUT_DIR/$FILENAME.tar.gz"
        ;;
    zip)
        (cd "$BUILD_DIR" && zip -r "$OUTPUT_DIR/$FILENAME.zip" "$FILENAME" > /dev/null)
        print_ok "Created $OUTPUT_DIR/$FILENAME.zip"
        ;;
    *)
        print_err "Unsupported format: $FORMAT"
        exit 1
        ;;
esac

# Calculate checksum
if command -v sha256sum &> /dev/null; then
    CHECKSUM=$(sha256sum "$OUTPUT_DIR/$FILENAME.$FORMAT" | cut -d' ' -f1)
    echo "$CHECKSUM" > "$OUTPUT_DIR/$FILENAME.$FORMAT.sha256"
    print_ok "Checksum: $CHECKSUM"
fi

# Package size
SIZE=$(du -h "$OUTPUT_DIR/$FILENAME.$FORMAT" | cut -f1)
echo ""
echo -e "${GREEN}Package ready:${NC}"
echo "  File:  $OUTPUT_DIR/$FILENAME.$FORMAT"
echo "  Size:  $SIZE"
echo ""

# List contents
print_step "Package contents:"
tar -tzf "$OUTPUT_DIR/$FILENAME.$FORMAT" 2>/dev/null | sed 's/^/  /' || \
    unzip -l "$OUTPUT_DIR/$FILENAME.$FORMAT" 2>/dev/null | head -30 | sed 's/^/  /'
echo ""
