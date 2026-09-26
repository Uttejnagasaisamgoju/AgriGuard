const fs = require('fs');
const path = require('path');

const LOCALES_DIR = path.join(__dirname, '../frontend/src/locales');
const langs = ['en', 'hi', 'te', 'ta', 'kn', 'ml', 'mr', 'tcy', 'kok', 'kfa', 'bgy', 'bfq'];

function loadLocale(lang) {
  const file = path.join(LOCALES_DIR, `${lang}.ts`);
  const content = fs.readFileSync(file, 'utf8');
  const exportIdx = content.indexOf('export const');
  const start = content.indexOf('{', exportIdx);
  const end = content.lastIndexOf('};');
  const jsonStr = content.slice(start, end + 1).replace(/,\s*([}\]])/g, '$1');
  return eval('(' + jsonStr + ')');
}

const en = loadLocale('en');

let allPassed = true;

for (const lang of langs) {
  const loc = loadLocale(lang);
  let missing = [];
  for (const sec of Object.keys(en)) {
    if (!loc[sec]) {
      missing.push(`Entire section [${sec}]`);
      continue;
    }
    for (const key of Object.keys(en[sec])) {
      if (loc[sec][key] === undefined || loc[sec][key] === '') {
        missing.push(`${sec}.${key}`);
      }
    }
  }

  if (missing.length === 0) {
    console.log(`[PASS] ${lang}: 0 missing keys. Total sections: ${Object.keys(loc).length}`);
  } else {
    allPassed = false;
    console.log(`[FAIL] ${lang}: ${missing.length} missing keys:`, missing.slice(0, 5));
  }
}

if (allPassed) {
  console.log('\nALL 12 LANGUAGES PASS VALIDATION (100% KEY COVERAGE)!');
} else {
  process.exit(1);
}
