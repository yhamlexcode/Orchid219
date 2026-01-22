"""
Ollama Service for TranslateGemma 12B Integration
"""

import httpx
import json
from typing import AsyncGenerator


class OllamaService:
    """Service for interacting with Ollama API running TranslateGemma 12B"""
    
    def __init__(self, base_url: str = "http://localhost:11434"):
        self.base_url = base_url
        self.model = "translategemma:12b"
    
    def _build_prompt(self, text: str, source_lang: str, target_lang: str) -> str:
        """Build translation prompt for TranslateGemma"""
        lang_names = {
            "ko": "Korean", "en": "English", "ja": "Japanese",
            "zh": "Chinese", "es": "Spanish", "fr": "French",
            "de": "German", "pt": "Portuguese", "ru": "Russian",
            "ar": "Arabic", "hi": "Hindi", "vi": "Vietnamese",
            "th": "Thai", "id": "Indonesian", "auto": "auto-detected language"
        }
        
        source = lang_names.get(source_lang, source_lang)
        target = lang_names.get(target_lang, target_lang)
        
        if source_lang == "auto":
            return f"Translate the following text to {target}:\n\n{text}"
        else:
            return f"Translate the following text from {source} to {target}:\n\n{text}"
    
    async def translate(self, text: str, source_lang: str, target_lang: str) -> str:
        """
        Perform translation using TranslateGemma 12B
        """
        prompt = self._build_prompt(text, source_lang, target_lang)
        
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                f"{self.base_url}/api/generate",
                json={
                    "model": self.model,
                    "prompt": prompt,
                    "stream": False,
                    "options": {
                        "temperature": 0.3,
                        "top_p": 0.9,
                    }
                }
            )
            response.raise_for_status()
            result = response.json()
            return result.get("response", "").strip()
    
    async def translate_stream(
        self, text: str, source_lang: str, target_lang: str
    ) -> AsyncGenerator[str, None]:
        """
        Stream translation response for real-time display
        """
        prompt = self._build_prompt(text, source_lang, target_lang)
        
        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream(
                "POST",
                f"{self.base_url}/api/generate",
                json={
                    "model": self.model,
                    "prompt": prompt,
                    "stream": True,
                    "options": {
                        "temperature": 0.3,
                        "top_p": 0.9,
                    }
                }
            ) as response:
                async for line in response.aiter_lines():
                    if line:
                        try:
                            data = json.loads(line)
                            if "response" in data:
                                yield f"data: {json.dumps({'text': data['response']})}\n\n"
                            if data.get("done", False):
                                yield "data: [DONE]\n\n"
                        except json.JSONDecodeError:
                            continue
    
    async def check_model_available(self) -> bool:
        """Check if TranslateGemma model is available"""
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(f"{self.base_url}/api/tags")
                if response.status_code == 200:
                    models = response.json().get("models", [])
                    return any(self.model in m.get("name", "") for m in models)
        except Exception:
            pass
        return False

    async def chat_stream(self, messages: list, model: str = None) -> AsyncGenerator[str, None]:
        """
        Stream chat response using specified model (default: DeepSeek-R1)
        """
        target_model = model or "deepseek-r1:32b"
        
        async with httpx.AsyncClient(timeout=300.0) as client:
            async with client.stream(
                "POST",
                f"{self.base_url}/api/chat",
                json={
                    "model": target_model,
                    "messages": messages,
                    "stream": True,
                    "options": {
                        "temperature": 0.6,  # Slightly higher for creativity in chat
                    }
                }
            ) as response:
                async for line in response.aiter_lines():
                    if line:
                        # print(f"DEBUG: Received line: {line[:100]}...") # Uncomment for verbose debug
                        try:
                            data = json.loads(line)
                            if "message" in data and "content" in data["message"]:
                                content = data["message"]["content"]
                                if content:
                                    yield f"data: {json.dumps({'content': content})}\n\n"
                            
                            # Handle done status
                            if data.get("done", False):
                                yield "data: [DONE]\n\n"
                                
                        except json.JSONDecodeError:
                            print(f"JSON Decode Error for line: {line}")
                            continue
                        except Exception as e:
                            print(f"Error processing chunk: {e}")
                            continue
