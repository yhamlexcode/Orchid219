"""
Chat API Routes
"""

from fastapi import APIRouter, HTTPException, File, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional
import json
import asyncio

from app.services.ollama_service import OllamaService
from app.services.document_service import DocumentService
from app.database import AsyncSessionLocal
from app.models import ChatSession, ChatMessage
from sqlalchemy import select

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
    session_id: Optional[str] = None
    attached_file_name: Optional[str] = None


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


async def save_message(session_id: str, role: str, content: str, reasoning: str = None, attached_file_name: str = None, attached_file_context: str = None):
    """Helper to save message to DB using a fresh session"""
    async with AsyncSessionLocal() as db:
        try:
            msg = ChatMessage(
                session_id=session_id,
                role=role,
                content=content,
                reasoning=reasoning,
                attached_file_name=attached_file_name,
                attached_file_context=attached_file_context
            )
            db.add(msg)
            await db.commit()
            return msg.id
        except Exception as e:
            print(f"Error saving message: {e}")
            await db.rollback()


@router.post("/stream")
async def chat_stream(request: ChatRequest):
    """
    Stream chat response and save history.
    """
    print(f"DEBUG input: model={request.model}, messages_len={len(request.messages)}")
    if not request.messages:
        raise HTTPException(status_code=400, detail="Messages cannot be empty")
    
    # 1. Handle Session (Create if new or Retrieve existing)
    session_id = request.session_id
    is_new_session = False
    session_model_type = None
    
    async with AsyncSessionLocal() as db:
        if session_id:
            # Fetch existing session to check model_type
            result = await db.execute(select(ChatSession).where(ChatSession.id == session_id))
            session = result.scalar_one_or_none()
            if session:
                session_model_type = session.model_type
        else:
            # Create new session
            first_msg_content = request.messages[-1].content if request.messages else "New Chat"
            title = first_msg_content[:30] + "..." if len(first_msg_content) > 30 else first_msg_content
            
            # Model type normalization (e.g. deepseek-r1:32b -> deepqwen)
            # This mapping should ideally match the frontend tab IDs
            model_map = {
                "deepseek-r1:32b": "deepqwen",
                "llama3.3:70b-instruct-q3_K_M": "llama",
                "gemma:2b": "gemma", # example
                "exaone4.0:32b": "exaone"
            }
            # Fallback to pure string if not in map, or use simple split
            model_type_inferred = model_map.get(request.model, request.model.split(":")[0])
            
            # Special logic: If we are in the debate interface, the frontend might not pass a session_id initially,
            # but we want to know if it's a debate.
            # However, for now, if the frontend intends to start a debate, it should probably create the session first 
            # OR we infer it. Since deepqwen/exaone are also used for individual chats, `model_type` here would be 'deepqwen' or 'exaone'.
            # To support "debate", the frontend should probably create the session explicitly using the POST /session endpoint,
            # OR we can add a field to ChatRequest.
            # For simplicity, if the frontend works as designed in the plan, it might rely on us returning a session.
            # But the plan said: "Call API to create a new session (POST `/api/history/session`) with `model_type='debate'`"
            # So `chat_stream` might receive a session_id for debate.
            
            # If we DO get here without a session_id, we assume standard chat based on the model.
            new_session = ChatSession(model_type=model_type_inferred, title=title)
            db.add(new_session)
            await db.commit()
            await db.refresh(new_session)
            session_id = str(new_session.id)
            session_model_type = model_type_inferred
            is_new_session = True
    
    # 2. Save User Message
    user_msg = request.messages[-1]
    # Check if last message is indeed user (validity check)
    if user_msg.role == "user":
        await save_message(
            session_id=session_id,
            role="user",
            content=user_msg.content,
            attached_file_name=request.attached_file_name,
            attached_file_context=request.document_context
        )

    # Prepare Payload
    messages_payload = [msg.dict() for msg in request.messages]
    if request.document_context:
        system_message = {
            "role": "system",
            "content": f"""다음은 사용자가 첨부한 문서의 내용입니다. 이 문서를 참고하여 질문에 답변해주세요.
\n--- 첨부 문서 시작 ---\n{request.document_context}\n--- 첨부 문서 끝 ---\n
위 문서 내용을 바탕으로 사용자의 질문에 정확하고 도움이 되는 답변을 제공해주세요."""
        }
        messages_payload = [system_message] + messages_payload
    
    async def generate():
        # First yield session ID if it's new
        if is_new_session:
             yield f"data: {json.dumps({'session_id': session_id})}\n\n"

        full_content = ""
        full_reasoning = ""
        
        async for chunk in ollama_service.chat_stream(
            messages=messages_payload,
            model=request.model
        ):
            # For saving, we capture pure chunks.
            if chunk.strip():
                 # Send chunk to client
                 yield chunk
                 
                 # Extract content for saving
                 try:
                     # chunk format: "data: {json}\n\n"
                     lines = chunk.split('\n')
                     for line in lines:
                         if line.startswith('data: '):
                             data_str = line[6:]
                             if data_str == '[DONE]':
                                 continue
                             data = json.loads(data_str)
                             if 'content' in data:
                                 full_content += data['content']
                 except:
                     pass

        # 3. Save Assistant Message after streaming
        # Determine Role Based on Session Type
        assistant_role = "assistant"
        if session_model_type == "debate":
            if "deepseek-r1" in request.model:
                assistant_role = "deepqwen"
            elif "exaone" in request.model:
                assistant_role = "exaone"
        
        # Extract <think> content if present
        final_content = full_content
        final_reasoning = None
        
        if "<think>" in full_content:
            parts = full_content.split("</think>")
            if len(parts) > 1:
                final_reasoning = parts[0].replace("<think>", "").strip()
                final_content = parts[1].strip()
            # If no closing tag, it might be incomplete thinking, but we save what we have.
            else:
                 # Check if it starts with think
                 if full_content.strip().startswith("<think>"):
                     final_reasoning = full_content.replace("<think>", "").strip()
                     final_content = ""
                 else:
                     final_content = full_content

        if final_content or final_reasoning:
            await save_message(
                session_id=session_id,
                role=assistant_role,
                content=final_content,
                reasoning=final_reasoning
            )

    return StreamingResponse(generate(), media_type="text/event-stream")
