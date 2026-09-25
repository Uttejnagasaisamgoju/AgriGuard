from fastapi import APIRouter, HTTPException, Query, Body, Depends
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.models.translation import TranslationMemory
from app.services.translation_service import translation_service, SUPPORTED_LANGUAGES, AGRICULTURE_GLOSSARY

router = APIRouter(prefix="/api/translation", tags=["Translation"])


class TranslateRequest(BaseModel):
    text: Optional[str] = None
    texts: Optional[List[str]] = None
    target_lang: Optional[str] = None
    target_language: Optional[str] = None
    source_lang: Optional[str] = None
    source_language: Optional[str] = None


class TranslateResponse(BaseModel):
    target_lang: str
    source_lang: str
    translations: List[str]
    translated_text: Optional[str] = None
    original_text: Optional[str] = None


class AddMemoryRequest(BaseModel):
    source_text: str
    translated_text: str
    target_lang: str
    source_lang: Optional[str] = "en"
    service: Optional[str] = "human_verified"


class ExtractBatchRequest(BaseModel):
    texts: List[str]
    target_languages: Optional[List[str]] = None
    source_lang: Optional[str] = "en"


@router.get("/languages")
async def get_supported_languages():
    """Return all 11 supported languages with ISO codes, native scripts and regional info"""
    return [
        {
            "code": code,
            "name": info["name"],
            "native": info["native"],
            "script": info["script"]
        }
        for code, info in SUPPORTED_LANGUAGES.items()
    ]


@router.get("/glossary")
async def get_agriculture_glossary(
    lang: Optional[str] = Query(None),
    language: Optional[str] = Query(None)
):
    """Return the Agriculture Terminology Glossary for domain-specific consistency"""
    target = lang or language
    if target and target in SUPPORTED_LANGUAGES:
        terms = {term: trans.get(target, term) for term, trans in AGRICULTURE_GLOSSARY.items()}
        return {"language": target, "glossary": terms, "count": len(terms)}
    return {"glossary": AGRICULTURE_GLOSSARY, "count": len(AGRICULTURE_GLOSSARY)}


@router.post("/translate", response_model=TranslateResponse)
async def translate(req: TranslateRequest):
    """Translate dynamic user-facing text via Google Cloud Translation service or persistent TM"""
    target = req.target_language or req.target_lang or "te"
    source = req.source_language or req.source_lang or "en"

    items_to_translate = []
    if req.texts:
        items_to_translate = req.texts
    elif req.text:
        items_to_translate = [req.text]
    else:
        raise HTTPException(status_code=400, detail="Either 'text' or 'texts' must be provided.")

    try:
        translated_list = await translation_service.translate_batch(
            texts=items_to_translate,
            target_lang=target,
            source_lang=source,
        )
        first_trans = translated_list[0] if translated_list else ""
        first_orig = items_to_translate[0] if items_to_translate else ""
        return TranslateResponse(
            target_lang=target,
            source_lang=source,
            translations=translated_list,
            translated_text=first_trans,
            original_text=first_orig,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Translation error: {str(e)}")


@router.get("/memory")
async def get_translation_memory(
    target_lang: Optional[str] = None,
    limit: int = 50,
    db: Session = Depends(get_db)
):
    """View stored translation memory entries and usage analytics"""
    query = db.query(TranslationMemory)
    if target_lang:
        query = query.filter(TranslationMemory.target_lang == target_lang)
    
    total = query.count()
    entries = query.order_by(TranslationMemory.usage_count.desc(), TranslationMemory.updated_at.desc()).limit(limit).all()
    
    return {
        "total_cached": total,
        "returned": len(entries),
        "entries": [
            {
                "id": str(e.id),
                "source_text": e.source_text,
                "translated_text": e.translated_text,
                "source_lang": e.source_lang,
                "target_lang": e.target_lang,
                "service": e.service,
                "usage_count": e.usage_count,
                "updated_at": e.updated_at.isoformat() if e.updated_at else None
            }
            for e in entries
        ]
    }


@router.post("/memory")
async def add_or_update_translation_memory(
    req: AddMemoryRequest,
    db: Session = Depends(get_db)
):
    """Manually add or edit a human-verified translation in persistent TM"""
    shash = translation_service._hash_text(req.source_text)
    entry = db.query(TranslationMemory).filter(
        TranslationMemory.source_hash == shash,
        TranslationMemory.target_lang == req.target_lang,
        TranslationMemory.source_lang == req.source_lang
    ).first()

    if not entry:
        entry = TranslationMemory(
            source_lang=req.source_lang,
            target_lang=req.target_lang,
            source_hash=shash,
            source_text=req.source_text.strip(),
            translated_text=req.translated_text.strip(),
            service=req.service or "human_verified",
            usage_count=1
        )
        db.add(entry)
    else:
        entry.translated_text = req.translated_text.strip()
        entry.service = req.service or "human_verified"
        entry.usage_count += 1

    db.commit()
    # Invalidate in-memory cache
    cache_key = f"{req.source_lang}:{req.target_lang}:{req.source_text.strip()}"
    translation_service._cache[cache_key] = req.translated_text.strip()

    return {"message": "Translation memory updated successfully.", "id": str(entry.id)}


@router.post("/extract")
async def batch_extract_translations(req: ExtractBatchRequest):
    """Batch translate dynamic texts to multiple languages for pre-caching"""
    targets = req.target_languages or [c for c in SUPPORTED_LANGUAGES.keys() if c != req.source_lang]
    matrix = {}

    for tgt in targets:
        try:
            trans = await translation_service.translate_batch(
                texts=req.texts,
                target_lang=tgt,
                source_lang=req.source_lang or "en"
            )
            matrix[tgt] = trans
        except Exception as e:
            matrix[tgt] = [f"Error: {e}"] * len(req.texts)

    return {
        "source_texts": req.texts,
        "source_lang": req.source_lang,
        "translations_by_language": matrix
    }
