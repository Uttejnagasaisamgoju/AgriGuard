import os
import re

components_dir = r'c:\sih3\frontend\src\components'
app_tsx = r'c:\sih3\frontend\src\App.tsx'

files_to_check = [app_tsx] + [os.path.join(components_dir, f) for f in os.listdir(components_dir) if f.endswith('.tsx')]

jsx_text_pattern = re.compile(r'>\s*([A-Za-z][A-Za-z0-9 ,.!\?\'\-\:\/]{2,})\s*<')
attr_pattern = re.compile(r'\b(placeholder|title|aria-label)=["\']([A-Za-z][A-Za-z0-9 ,.!\?\'\-\:\/]{2,})["\']')

results = {}

for path in files_to_check:
    fname = os.path.basename(path)
    with open(path, 'r', encoding='utf-8', errors='ignore') as fp:
        lines = fp.readlines()

    hardcoded = []
    for line_no, line in enumerate(lines, 1):
        # Skip comments or imports
        stripped = line.strip()
        if stripped.startswith('//') or stripped.startswith('/*') or stripped.startswith('*') or stripped.startswith('import ') or stripped.startswith('console.'):
            continue
        
        # Check text within tags
        for m in jsx_text_pattern.finditer(line):
            text = m.group(1).strip()
            # Ignore purely CSS or curly brace placeholders
            if text and not text.startswith('{') and not text.endswith('}') and not text in ['px', 'rem', 'em', 'vh', 'vw']:
                hardcoded.append((line_no, 'TEXT', text))
        
        # Check attributes
        for m in attr_pattern.finditer(line):
            attr, text = m.group(1), m.group(2).strip()
            hardcoded.append((line_no, f'ATTR:{attr}', text))

    if hardcoded:
        results[fname] = hardcoded

print(f"Components with hardcoded English strings: {len(results)}")
total_instances = sum(len(v) for v in results.values())
print(f"Total hardcoded string instances: {total_instances}")
for fname, strings in sorted(results.items(), key=lambda x: len(x[1]), reverse=True)[:15]:
    print(f"\n{fname}: {len(strings)} strings")
    for lno, typ, txt in strings[:5]:
        print(f"   Line {lno} [{typ}]: {txt}")
