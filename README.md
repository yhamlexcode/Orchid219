# Orchid219 - Local LLM Translation App

**Private & Offline Translation** powered by TranslateGemma 12B

## Overview

Orchid219는 로컬 환경에서 실행되는 AI 번역 애플리케이션입니다. 모든 번역이 사용자의 기기에서 직접 수행되므로 데이터 프라이버시가 보장됩니다.

### Features

- 🔒 **완전한 프라이버시** - 번역 데이터가 외부로 전송되지 않음
- 🌐 **55개 언어 지원** - TranslateGemma의 다국어 번역 기능
- ⚡ **실시간 스트리밍** - 번역 결과를 실시간으로 확인
- 🖥️ **오프라인 지원** - 인터넷 연결 없이 사용 가능

## Tech Stack

| Component | Technology |
|-----------|------------|
| Frontend | Next.js 14 (React, TypeScript) |
| Backend | FastAPI (Python) |
| AI Engine | Ollama |
| Model | TranslateGemma 12B |

## Prerequisites

- **macOS** with Apple Silicon (M1/M2/M3)
- **Node.js** 20+ 
- **Python** 3.9+
- **Ollama** ([Download here](https://ollama.com/download))

## Quick Start

### 1. Install Ollama

Download and install Ollama from [ollama.com/download](https://ollama.com/download)

### 2. Download TranslateGemma 12B

```bash
ollama pull translategemma:12b
```

> ⚠️ This will download approximately 8GB. Ensure you have sufficient disk space.

### 3. Start the Backend

```bash
cd backend

# Create virtual environment (optional but recommended)
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run the server
uvicorn app.main:app --reload --port 8000
```

### 4. Start the Frontend

```bash
cd frontend

# Install dependencies
npm install

# Run development server
npm run dev
```

### 5. Open the App

Navigate to [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
Orchid219/
├── frontend/                 # Next.js application
│   ├── src/
│   │   └── app/
│   │       ├── globals.css   # Global styles
│   │       ├── layout.tsx    # Root layout
│   │       └── page.tsx      # Main translation UI
│   └── package.json
├── backend/                  # FastAPI application
│   ├── app/
│   │   ├── main.py          # FastAPI app
│   │   ├── routes/
│   │   │   └── translation.py  # Translation API
│   │   └── services/
│   │       └── ollama_service.py  # Ollama integration
│   └── requirements.txt
└── README.md
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Health check |
| GET | `/api/languages` | Get supported languages |
| POST | `/api/translate` | Translate text |
| POST | `/api/translate/stream` | Stream translation |

### Example Request

```bash
curl -X POST http://localhost:8000/api/translate \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello, world!", "source_lang": "en", "target_lang": "ko"}'
```

## Supported Languages

Korean, English, Japanese, Chinese, Spanish, French, German, Portuguese, Russian, Arabic, Hindi, Vietnamese, Thai, Indonesian, and more.

## System Requirements

For optimal performance with TranslateGemma 12B:

- **RAM**: 16GB minimum (24GB recommended)
- **Storage**: 10GB free space for model
- **GPU**: Apple Silicon Metal acceleration

## License

MIT License
