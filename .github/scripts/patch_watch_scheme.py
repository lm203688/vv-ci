#!/usr/bin/env python3
"""把自建的 watch target 塞进主 App 的 scheme BuildAction。

xcode 库的 addTarget(name,'watch2_app') 会在主 target 里补 Embed Watch Content 拷贝阶段和 target 依赖，
但 xcodebuild 走的是 scheme：scheme 的 BuildAction 不含 watch target 时，它会跳过编译，
拷贝阶段就报 "VehicleVaultWatch.app couldn't be opened because there is no such file"。
这里直接改 xcshareddata 里的 scheme，幂等。
"""
import glob
import os
import re
import sys

TARGET = 'VehicleVaultWatch'
PRODUCT = TARGET + '.app'

def target_uuid(pbx):
    m = re.search(r'([0-9A-F]{24}) /* %s */ = {\n\t\tisa = PBXNativeTarget;' % TARGET, pbx)
    if not m:
        m = re.search(r'([0-9A-F]{24}) /* %s */' % TARGET, pbx)
    if m:
        return m.group(1)
    m = re.search(r'[0-9A-F]{24}.*isa = PBXNativeTarget;.*?name = "%s";' % TARGET, pbx, re.S)
    return m.group(0)[:24] if m else None

def main():
    projects = glob.glob('ios/*.xcodeproj')
    if not projects:
        print('no xcodeproj')
        return 1
    pbx_path = os.path.join(projects[0], 'project.pbxproj')
    pbx = open(pbx_path, encoding='utf-8').read()
    uid = target_uuid(pbx)
    if not uid:
        print('FAIL: watch target not found in pbxproj')
        return 1
    print('watch target %s = %s' % (TARGET, uid))

    schemes = glob.glob(os.path.join(projects[0], 'xcshareddata', 'xcschemes', '*.xcscheme'))
    if not schemes:
        print('FAIL: no shared scheme')
        return 1
    changed = 0
    for path in schemes:
        s = open(path, encoding='utf-8').read()
        if TARGET in s:
            print('scheme already lists %s: %s' % (TARGET, path))
            continue
        container = os.path.basename(projects[0])
        entry = f'''         <BuildActionEntry
            buildForTesting = "YES"
            buildForRunning = "YES"
            buildForProfiling = "YES"
            buildForArchiving = "YES"
            buildForAnalyzing = "YES">
            <BuildableReference
               BuildableIdentifier = "primary"
               BlueprintIdentifier = "{uid}"
               BuildableName = "{PRODUCT}"
               BlueprintName = "{TARGET}"
               ReferencedContainer = "container:{container}">
            </BuildableReference>
         </BuildActionEntry>
'''
        if '</BuildActionEntries>' not in s:
            print('FAIL: no BuildActionEntries in %s' % path)
            continue
        s = s.replace('      </BuildActionEntries>', entry + '      </BuildActionEntries>', 1)
        open(path, 'w', encoding='utf-8').write(s)
        changed += 1
        print('scheme patched: %s' % path)
    return 0 if changed or schemes else 1

if __name__ == '__main__':
    sys.exit(main())
