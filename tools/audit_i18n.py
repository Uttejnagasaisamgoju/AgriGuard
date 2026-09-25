import os
import re

frontend_src = r'c:\sih3\frontend\src'
components_dir = os.path.join(frontend_src, 'components')
app_tsx = os.path.join(frontend_src, 'App.tsx')
files = [app_tsx] + [os.path.join(components_dir, f) for f in os.listdir(components_dir) if f.endswith('.tsx')]

pattern = re.compile(r"""\bt\(\s*['"]([a-zA-Z0-9_\.]+)['"]""")
keys_by_file = {}
for path in files:
    fname = os.path.basename(path)
    with open(path, 'r', encoding='utf-8', errors='ignore') as fp:
        content = fp.read()
    matches = pattern.findall(content)
    if matches:
        keys_by_file[fname] = matches

all_keys = set()
for f, ks in keys_by_file.items():
    all_keys.update(ks)

print(f"Total distinct keys used across all files: {len(all_keys)}")
sections = {}
for k in sorted(all_keys):
    parts = k.split('.')
    prefix = parts[0]
    sections.setdefault(prefix, []).append(k)

for sec, ks in sorted(sections.items()):
    print(f"\n[{sec}] ({len(ks)} keys):")
    for k in ks:
        print(f"  {k}")
