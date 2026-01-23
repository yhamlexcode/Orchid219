"""
Orchid219 Backend - FastAPI Application
Local LLM Translation using TranslateGemma 12B
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes import translation, chat, history
from app.database import init_db

app = FastAPI(
    title="Orchid219 Translation API",
    description="Local LLM-powered translation using TranslateGemma 12B",
    version="1.0.0"
)

# Initialize Database on Startup
@app.on_event("startup")
async def on_startup():
    await init_db()

# CORS configuration for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routes
app.include_router(translation.router, prefix="/api", tags=["translation"])
app.include_router(chat.router, prefix="/api/chat", tags=["chat"])
app.include_router(history.router, prefix="/api/history", tags=["history"])


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
