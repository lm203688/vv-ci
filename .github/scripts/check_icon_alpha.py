"""Fail the build if the exported App Store icon carries an alpha channel.

ITMS-90717: "The large app icon in the asset catalog cannot be transparent or contain an alpha
channel." Xcode happily compiles an RGBA PNG, so this has to be checked before upload.
Runs inside the repo after `expo prebuild`, where the icons live under ios/.../AppIcon.appiconset.
"""
import glob
import struct
import sys

paths = [p for p in glob.glob("ios/**/*.png", recursive=True)
         if "AppIcon" in p or "App-Icon" in p or "AppIcon.appiconset" in p]
if not paths:
    sys.exit("FAIL: no AppIcon PNG found under ios/ (prebuild must run first)")

bad = []
for path in paths:
    with open(path, "rb") as fh:
        data = fh.read()
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        print(f"skip (not PNG): {path}")
        continue
    width, height = struct.unpack(">II", data[16:24])
    colour_type = data[25]
    has_alpha = colour_type in (4, 6) or b"tRNS" in data
    print(f"{path}: {width}x{height} colour_type={colour_type} alpha={'YES' if has_alpha else 'no'}")
    if has_alpha:
        bad.append(path)

if bad:
    sys.exit("FAIL (ITMS-90717): icon has an alpha channel / transparency -> " + ", ".join(bad))
print("OK: every AppIcon PNG is opaque")
