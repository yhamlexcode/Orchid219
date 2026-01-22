"""
Orchid219 Backend - FastAPI Application
Local LLM Translation using TranslateGemma 12B
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes import translation, chat

app = FastAPI(
    title="Orchid219 Translation API",
    description="Local LLM-powered translation using TranslateGemma 12B",
    version="1.0.0"
)

# CORS configuration for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routes
app.include_router(translation.router, prefix="/api", tags=["translation"])
app.include_router(chat.router, prefix="/api/chat", tags=["chat"])


@app.get("/")
async def root():
    return {
        "message": "Orchid219 Translation API",
        "model": "TranslateGemma 12B",
        "status": "running"
    }


@app.get("/health")
async def health_check():
    return {"status": "healthy"}
