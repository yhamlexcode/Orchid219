"""
Chat API Routes
"""

from fastapi import APIRouter, HTTPException, File, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional

from app.services.ollama_service import OllamaService
from app.services.document_service import DocumentService

router = APIRouter()
ollama_service = OllamaService()
document_service = DocumentService()


class Message(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: List[Message]
    model: str = "deepseek-r1:32b"
    document_context: Optional[str] = None


class UploadResponse(BaseModel):
    success: bool
    filename: str
    content: str
    char_count: int


@router.post("/upload", response_model=UploadResponse)
async def upload_document(file: UploadFile = File(...)):
    """
    Upload and parse a document (PDF, TXT, DOCX)
    Returns the extracted text content
    """
    result = await document_service.parse_document(file)
    return UploadResponse(
        success=True,
        filename=result["filename"],
        content=result["content"],
        char_count=result["char_count"]
    )


@router.post("/stream")
async def chat_stream(request: ChatRequest):
    """
    Stream chat response using DeepSeek-R1 (or specified model)
    Optionally includes document context in system prompt
    """
    if not request.messages:
        raise HTTPException(status_code=400, detail="Messages cannot be empty")
    
    # Convert Pydantic models to dicts for Ollama
    messages_payload = [msg.dict() for msg in request.messages]
    
    # If document context is provided, prepend system message
    if request.document_context:
        system_message = {
            "role": "system",
            "content": f"""다음은 사용자가 첨부한 문서의 내용입니다. 이 문서를 참고하여 질문에 답변해주세요.

--- 첨부 문서 시작 ---
{request.document_context}
--- 첨부 문서 끝 ---

위 문서 내용을 바탕으로 사용자의 질문에 정확하고 도움이 되는 답변을 제공해주세요."""
        }
        messages_payload = [system_message] + messages_payload

    async def generate():
        async for chunk in ollama_service.chat_stream(
            messages=messages_payload,
            model=request.model
        ):
            yield chunk
    
    return StreamingResponse(generate(), media_type="text/event-stream")

