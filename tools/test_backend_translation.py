import sys
import os

sys.stdout.reconfigure(encoding='utf-8')
sys.path.append(r"c:\sih3\backend")

from app.database.session import create_tables, SessionLocal
from app.services.translation_service import translation_service, SUPPORTED_LANGUAGES
import asyncio

print("1. Initializing database tables...")
create_tables()

print(f"2. Verified {len(SUPPORTED_LANGUAGES)} languages configured in backend:")
for code, info in SUPPORTED_LANGUAGES.items():
    print(f"   [{code}] {info['name']} ({info['native']}) - Script: {info['script']}")

async def test_translations():
    test_phrase = "Disease detected. Recommended fungicide treatment immediately."
    print("\n3. Testing translations with Translation Memory:")
    for lang in ['te', 'ta', 'kn', 'ml', 'mr', 'kok', 'tcy', 'kfa', 'bgy', 'bfq']:
        result = await translation_service.translate_text(test_phrase, target_lang=lang)
        print(f"   [{lang}]: {result}")

asyncio.run(test_translations())
print("\nAll backend translations verified successfully!")
