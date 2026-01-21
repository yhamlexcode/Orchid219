"""
Language Detection Service
"""

from langdetect import detect, DetectorFactory
from fastapi import HTTPException

# Enforce deterministic results
DetectorFactory.seed = 0

class DetectionService:
    """Service for identifying language from text"""
    
    def detect_language(self, text: str) -> str:
        """
        Detect language of the given text
        Returns ISO 639-1 language code (e.g., 'en', 'ko')
        """
        if not text or len(text.strip()) < 3:
            return "auto"
            
        try:
            detected = detect(text)
            return detected
        except Exception:
            return "auto"
