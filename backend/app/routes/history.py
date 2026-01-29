from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, desc
from sqlalchemy.orm import selectinload
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime
import uuid

from app.database import get_db
from app.models import ChatSession, ChatMessage

router = APIRouter()

# --- Pydantic Models for Response ---
class MessageResponse(BaseModel):
    id: str
    role: str
    content: str
    reasoning: Optional[str] = None
    attached_file_name: Optional[str] = None
    attached_file_context: Optional[str] = None
    created_at: datetime

class SessionResponse(BaseModel):
    id: str
    model_type: str
    title: str
    created_at: datetime
    updated_at: datetime

class SessionDetailResponse(SessionResponse):
    messages: List[MessageResponse]

class CreateSessionRequest(BaseModel):
    model_type: str
    title: str

class UpdateTitleRequest(BaseModel):
    title: str

# --- Endpoints ---

@router.get("/{model_type}", response_model=List[SessionResponse])
async def get_sessions(model_type: str, db: AsyncSession = Depends(get_db)):
    """Get all chat sessions for a specific model type"""
    query = select(ChatSession).where(ChatSession.model_type == model_type).order_by(desc(ChatSession.updated_at))
    result = await db.execute(query)
    sessions = result.scalars().all()
    
    return [
        SessionResponse(
            id=str(s.id),
            model_type=s.model_type,
            title=s.title,
            created_at=s.created_at,
            updated_at=s.updated_at
        ) for s in sessions
    ]

@router.get("/session/{session_id}", response_model=SessionDetailResponse)
async def get_session_detail(session_id: str, db: AsyncSession = Depends(get_db)):
    """Get a specific session with all its messages"""
    try:
        uuid_id = uuid.UUID(session_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid UUID format")

    # query = select(ChatSession).where(ChatSession.id == uuid_id).options(selectinload(ChatSession.messages))
    # Note: We need relationship in models.py for selectinload, adding it below implicitly or manually querying messages
    # Let's manually query to avoid circular dependency or complex model setup for now if relationship is missing
    # Actually checking models.py -> relationship is missing. Let's fix models.py first or query separately.
    # Querying separately is safer for now.
    
    session_result = await db.execute(select(ChatSession).where(ChatSession.id == uuid_id))
    session = session_result.scalar_one_or_none()
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    messages_result = await db.execute(
        select(ChatMessage).where(ChatMessage.session_id == uuid_id).order_by(ChatMessage.created_at)
    )
    messages = messages_result.scalars().all()

    return SessionDetailResponse(
        id=str(session.id),
        model_type=session.model_type,
        title=session.title,
        created_at=session.created_at,
        updated_at=session.updated_at,
        messages=[
            MessageResponse(
                id=str(m.id),
                role=m.role,
                content=m.content,
                reasoning=m.reasoning,
                attached_file_name=m.attached_file_name,
                attached_file_context=m.attached_file_context,
                created_at=m.created_at
            ) for m in messages
        ]
    )

@router.post("/session", response_model=SessionResponse)
async def create_session(request: CreateSessionRequest, db: AsyncSession = Depends(get_db)):
    """Create a new chat session"""
    new_session = ChatSession(
        model_type=request.model_type,
        title=request.title
    )
    db.add(new_session)
    await db.commit()
    await db.refresh(new_session)
    
    return SessionResponse(
        id=str(new_session.id),
        model_type=new_session.model_type,
        title=new_session.title,
        created_at=new_session.created_at,
        updated_at=new_session.updated_at
    )

@router.delete("/session/{session_id}")
async def delete_session(session_id: str, db: AsyncSession = Depends(get_db)):
    """Delete a session"""
    try:
        uuid_id = uuid.UUID(session_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid UUID format")
        
    query = select(ChatSession).where(ChatSession.id == uuid_id)
    result = await db.execute(query)
    session = result.scalar_one_or_none()
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
        
    await db.delete(session)
    await db.commit()
    
    return {"success": True, "message": "Session deleted"}

@router.patch("/session/{session_id}/title")
async def update_session_title(session_id: str, request: UpdateTitleRequest, db: AsyncSession = Depends(get_db)):
    """Update session title"""
    try:
        uuid_id = uuid.UUID(session_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid UUID format")
        
    query = select(ChatSession).where(ChatSession.id == uuid_id)
    result = await db.execute(query)
    session = result.scalar_one_or_none()
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session.title = request.title
    await db.commit()
    await db.refresh(session)
    
    return {"success": True, "title": session.title}
