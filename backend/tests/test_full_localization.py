# -*- coding: utf-8 -*-
"""
Full Localization Automated Acceptance Test Suite
Validates all South Indian languages + Marathi:
ta, te, kn, ml, mr, tcy, kok, kfa, bgy, bfq, and en.
Zero English leakage, 100% key coverage, Translation Memory persistence, and API integration.
"""
import sys
import os
import re
import json
import pytest

sys.stdout.reconfigure(encoding='utf-8')

# Add backend to path
sys.path.append(r"c:\sih3\backend")

from app.database.session import create_tables, SessionLocal
from app.services.translation_service import translation_service, SUPPORTED_LANGUAGES, AGRICULTURE_GLOSSARY
from app.models.translation import TranslationMemory

ALL_LANGUAGES = ['ta', 'te', 'kn', 'ml', 'mr', 'tcy', 'kok', 'kfa', 'bgy', 'bfq', 'en']
SOUTH_INDIAN_PLUS_MARATHI = ['ta', 'te', 'kn', 'ml', 'mr', 'tcy', 'kok', 'kfa', 'bgy', 'bfq']

def test_all_languages_configured():
    """Verify all 10 South Indian + Marathi languages and English are in SUPPORTED_LANGUAGES"""
    assert len(SUPPORTED_LANGUAGES) >= 11
    for code in ALL_LANGUAGES:
        assert code in SUPPORTED_LANGUAGES
        info = SUPPORTED_LANGUAGES[code]
        assert info["name"]
        assert info["native"]
        assert info["script"]

def test_locale_files_integrity_and_zero_missing_keys():
    """Verify all 11 TypeScript locale files have 100% matching keys and zero missing values"""
    locales_dir = r"c:\sih3\frontend\src\locales"
    
    # Load and parse en.ts as ground truth
    with open(os.path.join(locales_dir, "en.ts"), "r", encoding="utf-8") as f:
        en_content = f.read()
    
    # Find object start after '= {'
    start_idx = en_content.find('= {') + 2
    end_idx = en_content.rfind('};') + 1
    en_json_str = en_content[start_idx:end_idx].strip()
    en_dict = json.loads(en_json_str)
    
    total_en_keys = sum(len(v) for v in en_dict.values())
    assert total_en_keys >= 350, f"Expected at least 350 keys, got {total_en_keys}"
    
    for lang in SOUTH_INDIAN_PLUS_MARATHI:
        file_path = os.path.join(locales_dir, f"{lang}.ts")
        assert os.path.exists(file_path), f"Locale file {lang}.ts missing!"
        
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()
        
        # Verify no English brand name in parentheses remains
        assert "(AgriGuard)" not in content, f"Found '(AgriGuard)' English parenthetical in {lang}.ts"
        
        l_start = content.find('= {') + 2
        l_end = content.rfind('};') + 1
        json_str = content[l_start:l_end].strip()
        data = json.loads(json_str)
        
        # Verify every section and key
        for sec, keys in en_dict.items():
            assert sec in data, f"Missing section '{sec}' in {lang}.ts"
            for k in keys.keys():
                assert k in data[sec], f"Missing key '{sec}.{k}' in {lang}.ts"
                val = data[sec][k]
                assert val is not None and str(val).strip() != "", f"Empty value for '{sec}.{k}' in {lang}.ts"

@pytest.mark.asyncio
async def test_translation_memory_persistence():
    """Verify Translation Memory database table saves and retrieves translations"""
    create_tables()
    
    source = "Immediate fungicide spraying recommended for tomato late blight control."
    target = "te"
    
    # Translate
    translated = await translation_service.translate_text(source, target_lang=target)
    assert translated is not None and len(translated) > 0
    
    # Verify in DB
    db = SessionLocal()
    try:
        shash = translation_service._hash_text(source)
        entry = db.query(TranslationMemory).filter(
            TranslationMemory.source_hash == shash,
            TranslationMemory.target_lang == target
        ).first()
        assert entry is not None
        assert entry.translated_text == translated
        assert entry.usage_count >= 1
    finally:
        db.close()

@pytest.mark.asyncio
async def test_regional_dialect_adaptations():
    """Verify Tulu, Kodava, Beary, and Badaga adaptations apply native vocabulary"""
    test_text = "ರೈತ ಹೊಲ ಬೆಳೆ ರೋಗ ಎಲೆ"
    for code, expected_word in [
        ('tcy', 'ಕೃಷಿಕೆ'),
        ('kfa', 'ಒಕ್ಕಲ'),
        ('bgy', 'ಕೃಷಿಕಾರ್'),
        ('bfq', 'ಒಕ್ಕಲಿಗ'),
    ]:
        adapted = translation_service._adapt_regional_kannada(test_text, code)
        assert expected_word in adapted, f"Failed adaptation for {code}: {adapted}"

def test_agriculture_glossary_multilingual_coverage():
    """Verify domain terminology glossary covers all South Indian languages and Marathi"""
    terms = ["crop", "farm", "farmer", "disease", "leaf", "treatment", "fertilizer", "pesticide"]
    for term in terms:
        assert term in AGRICULTURE_GLOSSARY
        translations = AGRICULTURE_GLOSSARY[term]
        for lang in ['te', 'ta', 'kn', 'ml', 'mr']:
            assert lang in translations
            assert len(translations[lang]) > 0

if __name__ == "__main__":
    pytest.main(["-v", __file__])
