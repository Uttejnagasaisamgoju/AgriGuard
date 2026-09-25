import os
import re
import json

def parse_ts_locale(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Extract the object content between outer { and };
    start = content.find('{')
    end = content.rfind('};')
    if start == -1 or end == -1:
        return {}
    
    # We can parse using regular expressions for sections and keys
    sections = {}
    current_sec = None
    
    for line in content.splitlines():
        line = line.strip()
        # section start: e.g. "common: {"
        sec_match = re.match(r"^([a-zA-Z0-9_]+)\s*:\s*\{", line)
        if sec_match:
            current_sec = sec_match.group(1)
            sections[current_sec] = {}
            continue
        
        if line.startswith('},') or line.startswith('}'):
            current_sec = None
            continue
            
        if current_sec:
            # key-value match: e.g. "save: 'భద్రపరచు'," or 'save': "..."
            kv_match = re.match(r"^['\"]?([a-zA-Z0-9_]+)['\"]?\s*:\s*['\"](.*)['\"],?$", line)
            if kv_match:
                k, v = kv_match.group(1), kv_match.group(2)
                # Unescape if needed
                sections[current_sec][k] = v
                
    return sections

# Test on te.ts
parsed = parse_ts_locale(r"c:\sih3\frontend\src\locales\te.ts")
print(f"Parsed te.ts sections: {list(parsed.keys())}")
print(f"Total keys in te: {sum(len(v) for v in parsed.values())}")
print(f"Sample common.save: {parsed.get('common', {}).get('save')}")
