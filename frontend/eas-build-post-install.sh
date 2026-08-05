#!/bin/bash

# EAS Build Hook: eas-build-post-install
# Runs AFTER npm/yarn install to patch react-native-screens for iOS 18.3+

set -e

echo "🔧 [eas-build-post-install] Applying iOS 18.3+ crash fix to react-native-screens..."

# Path to RNSScreen.mm in node_modules
RNSCREEN_PATH="node_modules/react-native-screens/ios/RNSScreen.mm"

if [ ! -f "$RNSCREEN_PATH" ]; then
    echo "⚠️ RNSScreen.mm not found at $RNSCREEN_PATH"
    exit 0
fi

echo "📄 Found RNSScreen.mm"

# Check if already patched
if grep -q "PATCHED_IOS18_FIX" "$RNSCREEN_PATH"; then
    echo "✅ Already patched, skipping..."
    exit 0
fi

# Create backup
cp "$RNSCREEN_PATH" "$RNSCREEN_PATH.backup"

# Use Python to patch - make setViewToSnapshot a no-op to completely avoid the crash
python3 << 'PYSCRIPT'
import re

file_path = "node_modules/react-native-screens/ios/RNSScreen.mm"

with open(file_path, 'r') as f:
    content = f.read()

patched = False

# Find the setViewToSnapshot method and make it a complete no-op
# This approach completely skips the snapshot feature instead of trying to work around it

# Pattern for the method signature - covers all versions
patterns_to_replace = [
    # Pattern 1: Method with Fabric check
    (
        r'(- \(void\)setViewToSnapshot\s*\{\s*#ifdef RCT_NEW_ARCH_ENABLED)',
        r'''- (void)setViewToSnapshot
{
  // PATCHED_IOS18_FIX: Complete no-op to prevent iOS 18+ crash
  // The snapshot feature is disabled - this may cause minor visual glitches during transitions
  // but prevents the SIGABRT/SIGSEGV crashes
  return;
#ifdef RCT_NEW_ARCH_ENABLED_DISABLED_BY_PATCH'''
    ),
    # Pattern 2: Method without Fabric check
    (
        r'(- \(void\)setViewToSnapshot\s*\{\s*UIView \*snapshotView)',
        r'''- (void)setViewToSnapshot
{
  // PATCHED_IOS18_FIX: Complete no-op to prevent iOS 18+ crash
  return;
  UIView *snapshotView'''
    )
]

for pattern, replacement in patterns_to_replace:
    new_content, count = re.subn(pattern, replacement, content, count=1)
    if count > 0:
        content = new_content
        patched = True
        print(f"✅ Applied patch pattern")
        break

if patched:
    with open(file_path, 'w') as f:
        f.write(content)
    print("🎉 Patch applied - setViewToSnapshot is now a no-op")
else:
    # Fallback: Try to find and completely replace the method
    if "- (void)setViewToSnapshot" in content:
        # Find the method and add early return
        content = content.replace(
            "- (void)setViewToSnapshot\n{",
            "- (void)setViewToSnapshot\n{\n  // PATCHED_IOS18_FIX: Early return to prevent crash\n  return;"
        )
        with open(file_path, 'w') as f:
            f.write(content)
        print("✅ Applied fallback patch - added early return")
    else:
        print("⚠️ Could not find setViewToSnapshot method")
PYSCRIPT

echo "🎉 iOS 18.3+ crash fix script completed!"
