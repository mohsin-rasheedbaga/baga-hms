#!/bin/bash
# ============================================================
# BAGA HMS - Safe Version Bump Script
# ============================================================
# USAGE: ./bump-version.sh [patch|minor|major]
#   patch: 3.5.3 → 3.5.4
#   minor: 3.5.3 → 3.6.0
#   major: 3.5.3 → 4.0.0
#
# This script:
# 1. Reads current version from package.json
# 2. Validates it's not lower than latest git tag
# 3. Bumps the version correctly
# 4. Updates package.json
# 5. Creates and pushes the git tag
# ============================================================

set -e

BUMP_TYPE="${1:-patch}"
REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
PKG_FILE="$REPO_DIR/package.json"

# Read current version
CURRENT=$(python3 -c "import json; print(json.load(open('$PKG_FILE'))['version'])")
echo "Current version: $CURRENT"

# Get latest git tag version
LATEST_TAG=$(cd "$REPO_DIR" && git tag -l 'v*' | sort -V | tail -1 | sed 's/^v//')
if [ -z "$LATEST_TAG" ]; then
  LATEST_TAG="0.0.0"
fi
echo "Latest git tag:  v$LATEST_TAG"

# Validate: current version in package.json should match or be newer than latest tag
compare_versions() {
  python3 -c "
a = [int(x) for x in '$1'.split('.')]
b = [int(x) for x in '$2'.split('.')]
for i in range(3):
    na = a[i] if i < len(a) else 0
    nb = b[i] if i < len(b) else 0
    if na > nb: print(1); exit()
    if na < nb: print(-1); exit()
print(0)
"
}

COMP=$(compare_versions "$CURRENT" "$LATEST_TAG")
if [ "$COMP" -lt 0 ]; then
  echo "ERROR: package.json version ($CURRENT) is LOWER than latest git tag (v$LATEST_TAG)!"
  echo "This would create a backwards version. Aborting."
  echo "Fix: Set package.json version to at least $LATEST_TAG before bumping."
  exit 1
fi

# Calculate new version
IFS='.' read -ra PARTS <<< "$CURRENT"
MAJOR=${PARTS[0]}
MINOR=${PARTS[1]}
PATCH=${PARTS[2]}

case "$BUMP_TYPE" in
  patch)
    PATCH=$((PATCH + 1))
    ;;
  minor)
    MINOR=$((MINOR + 1))
    PATCH=0
    ;;
  major)
    MAJOR=$((MAJOR + 1))
    MINOR=0
    PATCH=0
    ;;
  *)
    echo "Usage: $0 [patch|minor|major]"
    exit 1
    ;;
esac

NEW_VERSION="$MAJOR.$MINOR.$PATCH"
echo "New version:     $NEW_VERSION"

# Update package.json
python3 -c "
import json
with open('$PKG_FILE', 'r') as f:
    data = json.load(f)
data['version'] = '$NEW_VERSION'
with open('$PKG_FILE', 'w') as f:
    json.dump(data, f, indent=2)
    f.write('\n')
"

echo "✅ package.json updated to $NEW_VERSION"
echo ""
echo "Next steps:"
echo "  1. Make your code changes"
echo "  2. git add . && git commit -m 'v$NEW_VERSION: your change description'"
echo "  3. git tag v$NEW_VERSION"
echo "  4. git push origin main --tags"