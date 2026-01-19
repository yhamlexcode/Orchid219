"""
Translation API Routes
"""

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional

from app.services.ollama_service import OllamaService

router = APIRouter()
ollama_service = OllamaService()


class TranslationRequest(BaseModel):
    text: str
    source_lang: str = "auto"
    target_lang: str = "en"


class TranslationResponse(BaseModel):
    original: str
    translated: str
    source_lang: str
    target_lang: str


# Supported languages
SUPPORTED_LANGUAGES = {
    "ko": "Korean",
    "en": "English",
    "ja": "Japanese",
    "zh": "Chinese",
    "es": "Spanish",
    "fr": "French",
    "de": "German",
    "pt": "Portuguese",
    "ru": "Russian",
    "ar": "Arabic",
    "hi": "Hindi",
    "vi": "Vietnamese",
    "th": "Thai",
    "id": "Indonesian",
    "auto": "Auto-detect"
}


@router.get("/languages")
async def get_languages():
    """Get list of supported languages"""
    return {"languages": SUPPORTED_LANGUAGES}


@router.post("/translate")
async def translate(request: TranslationRequest):
    """
    Translate text using TranslateGemma 12B
    """
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty")
    
    if request.target_lang not in SUPPORTED_LANGUAGES:
        raise HTTPException(
            status_code=400, 
            detail=f"Unsupported target language: {request.target_lang}"
        )
    
    try:
        translated = await ollama_service.translate(
            text=request.text,
            source_lang=request.source_lang,
            target_lang=request.target_lang
        )
        
        return TranslationResponse(
            original=request.text,
            translated=translated,
            source_lang=request.source_lang,
            target_lang=request.target_lang
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/translate/stream")
async def translate_stream(request: TranslationRequest):
    """
    Stream translation response using TranslateGemma 12B
    """
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty")
    
    async def generate():
        async for chunk in ollama_service.translate_stream(
            text=request.text,
            source_lang=request.source_lang,
            target_lang=request.target_lang
        ):
            yield chunk
    
    return StreamingResponse(generate(), media_type="text/event-stream")
