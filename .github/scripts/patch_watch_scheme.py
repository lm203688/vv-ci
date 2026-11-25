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


def native_targets(pbx):
    """解析所有 PBXNativeTarget 的 uuid / name。"""
    out = []
    for m in re.finditer(r'([0-9A-Fa-f]{24})\s*(?:/\*.*?\*/)?\s*=\s*\{', pbx):
        body = pbx[m.end():m.end() + 2000]
        if 'isa = PBXNativeTarget' not in body[:400]:
            continue
        name = re.search(r'\bname = "?(.*?)"?;', body)
        out.append((m.group(1), name.group(1) if name else ''))
    return out


def main():
    projects = glob.glob('ios/*.xcodeproj')
    if not projects:
        print('FAIL: no xcodeproj')
        return 1
    project = projects[0]
    pbx = open(os.path.join(project, 'project.pbxproj'), encoding='utf-8').read()
    targets = native_targets(pbx)
    print('native targets: %s' % targets)
    uid = next((u for u, n in targets if n.strip('"') == TARGET), None)
    if not uid:
        print('FAIL: watch target not found in pbxproj')
        for hit in re.finditer('VehicleVaultWatch', pbx):
            print(pbx[max(0, hit.start() - 140):hit.start() + 40].replace('\n', ' | '))
        return 1
    print('watch target %s = %s' % (TARGET, uid))

    schemes = glob.glob(os.path.join(project, 'xcshareddata', 'xcschemes', '*.xcscheme'))
    if not schemes:
        print('FAIL: no shared scheme')
        return 1
    changed = 0
    for path in schemes:
        s = open(path, encoding='utf-8').read()
        if TARGET in s:
            print('scheme already lists %s: %s' % (TARGET, path))
            continue
        container = os.path.basename(project)
        entry = f'''         <BuildActionEntry
            buildForTesting = "YES"
            buildForRunning = "YES"
            buildForProfiling = "YES"
            buildForArchiving = "NO"
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
        s = s.replace('</BuildActionEntries>', entry + '      </BuildActionEntries>', 1)
        open(path, 'w', encoding='utf-8').write(s)
        changed += 1
        print('scheme patched: %s' % path)
    return 0


if __name__ == '__main__':
    sys.exit(main())
