"""
Chat API Routes - Refactored Version
"""
from fastapi import APIRouter, HTTPException, File, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from dataclasses import dataclass
from typing import List, Optional, Tuple
import json
import asyncio
import uuid
import logging

from app.services.ollama_service import OllamaService
from app.services.document_service import DocumentService
from app.services.context_service import ContextService
from app.database import AsyncSessionLocal
from app.models import ChatSession, ChatMessage
from sqlalchemy import select

# ============================================================
# 설정 및 초기화
# ============================================================


# ============================================================

router = APIRouter()
logger = logging.getLogger(__name__)

ollama_service = OllamaService()
document_service = DocumentService()

# 모델 타입 매핑 (설정 파일로 분리 권장)
MODEL_TYPE_MAP = {
    "deepseek-r1:32b": "deepqwen",
    "llama3.3:70b-instruct-q3_K_M": "llama",
    "gemma:2b": "gemma",
    "exaone4.0:32b": "exaone"
}


# ============================================================
# Pydantic 모델
# ============================================================

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


# ============================================================
# 데이터 클래스
# ============================================================

@dataclass
class SessionContext:
    """세션 관련 정보를 담는 컨텍스트 객체"""
    session_id: str
    is_new: bool
    model_type: str
    history: List[dict]


@dataclass
class ParsedResponse:
    """파싱된 어시스턴트 응답"""
    content: str
    reasoning: Optional[str]


# ============================================================
# 유틸리티 함수
# ============================================================

def infer_model_type(model: str) -> str:
    """모델 문자열에서 타입 추론"""
    return MODEL_TYPE_MAP.get(model, model.split(":")[0])


def determine_assistant_role(model_type: str, model: str) -> str:
    """debate 모드 등에서 어시스턴트 역할 결정"""
    if model_type != "debate":
        return "assistant"
    
    if "deepseek-r1" in model:
        return "deepqwen"
    elif "exaone" in model:
        return "exaone"
    return "assistant"


def parse_thinking_tags(content: str) -> ParsedResponse:
    """<think> 태그에서 reasoning 분리"""
    if "<think>" not in content:
        return ParsedResponse(content=content, reasoning=None)
    
    # </think> 닫힘 태그가 있는 정상 케이스
    if "</think>" in content:
        parts = content.split("</think>", 1)
        reasoning = parts[0].replace("<think>", "").strip()
        final_content = parts[1].strip() if len(parts) > 1 else ""
        return ParsedResponse(content=final_content, reasoning=reasoning)
    
    # <think>만 있고 닫히지 않은 경우 (스트리밍 중단 등)
    if content.strip().startswith("<think>"):
        return ParsedResponse(
            content="",
            reasoning=content.replace("<think>", "").strip()
        )
    
    return ParsedResponse(content=content, reasoning=None)


def extract_content_from_sse(chunk: str) -> str:
    """SSE 청크에서 content 추출"""
    extracted = ""
    
    for line in chunk.split('\n'):
        if not line.startswith('data: '):
            continue
        
        data_str = line[6:]
        if data_str == '[DONE]':
            continue
        
        try:
            data = json.loads(data_str)
            extracted += data.get('content', '')
        except json.JSONDecodeError as e:
            logger.debug(f"SSE JSON 파싱 스킵: {e}")
    
    return extracted


# ============================================================
# 세션 관리
# ============================================================

async def prepare_session_context(
    session_id: Optional[str],
    model: str
) -> SessionContext:
    """
    세션 컨텍스트를 준비합니다.
    - 새 세션: UUID 생성, DB 조회 없음
    - 기존 세션: DB에서 세션 정보 + 히스토리 로드
    """
    model_type = infer_model_type(model)
    
    # 새 세션
    if not session_id:
        return SessionContext(
            session_id=str(uuid.uuid4()),
            is_new=True,
            model_type=model_type,
            history=[]
        )
    
    # 기존 세션 조회
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(ChatSession).where(ChatSession.id == session_id)
        )
        session = result.scalar_one_or_none()
        
        # 세션 ID는 있지만 DB에 없는 경우
        if not session:
            logger.info(f"세션 ID {session_id}가 DB에 없음. 새 세션으로 처리")
            return SessionContext(
                session_id=session_id,
                is_new=True,
                model_type=model_type,
                history=[]
            )
        
        # 기존 세션 - 히스토리도 로드
        history = await ContextService.get_chat_history(session_id)
        
        return SessionContext(
            session_id=session_id,
            is_new=False,
            model_type=session.model_type,
            history=history
        )


# ============================================================
# 타이틀 생성
# ============================================================

async def generate_title_safe(
    user_content: str,
    assistant_content: str,
    model: str
) -> str:
    """타이틀 생성 (실패 시 기본값 반환)"""
    try:
        title = await ollama_service.generate_title(
            user_content=user_content,
            assistant_content=assistant_content or "...",
            model=model
        )
        return title or "New Chat"
    except Exception as e:
        logger.warning(f"타이틀 생성 실패: {e}")
        return "New Chat"


# ============================================================
# 대화 저장 (핵심 로직)
# ============================================================

async def save_conversation(
    session_id: str,
    is_new_session: bool,
    user_msg: Message,
    assistant_content: str,
    model_type: str,
    request: ChatRequest
) -> None:
    """
    스트리밍 완료 후 대화를 저장합니다.
    
    Lazy Persistence:
    - 새 세션: 세션 생성 + 유저 메시지 + 어시스턴트 메시지 (한 트랜잭션)
    - 기존 세션: 유저 메시지 + 어시스턴트 메시지 (한 트랜잭션)
    """
    # 응답 파싱
    parsed = parse_thinking_tags(assistant_content)
    
    if not parsed.content and not parsed.reasoning:
        logger.warning(f"저장할 내용 없음: session={session_id}")
        return
    
    assistant_role = determine_assistant_role(model_type, request.model)
    
    async def do_save():
        async with AsyncSessionLocal() as db:
            try:
                # 새 세션인 경우 세션 레코드 생성
                if is_new_session:
                    title = await generate_title_safe(
                        user_msg.content,
                        parsed.content,
                        request.model
                    )
                    
                    new_session = ChatSession(
                        id=session_id,
                        model_type=model_type,
                        title=title
                    )
                    db.add(new_session)
                    await db.flush()
                    logger.debug(f"새 세션 생성 및 플러시: {session_id}, title={title}")
    
                    # 유저 메시지 저장 (새 세션일 때만 - 기존 세션은 별도 처리)
                    if is_new_session:
                        user_message = ChatMessage(
                            session_id=session_id,
                            role="user",
                            content=user_msg.content,
                            attached_file_name=request.attached_file_name,
                            attached_file_context=request.document_context
                        )
                        db.add(user_message)
                
                # 어시스턴트 메시지 저장
                assistant_message = ChatMessage(
                    session_id=session_id,
                    role=assistant_role,
                    content=parsed.content,
                    reasoning=parsed.reasoning
                )
                db.add(assistant_message)
                
                await db.commit()
                logger.info(f"대화 저장 완료: session={session_id}, new={is_new_session}")
                
            except Exception as e:
                logger.error(f"대화 저장 실패: {e}", exc_info=True)
                await db.rollback()
                raise
    
    # asyncio.shield로 클라이언트 연결 끊김에도 저장 보장
    try:
        await asyncio.shield(do_save())
    except asyncio.CancelledError:
        logger.info(f"저장 작업이 shield로 보호됨: session={session_id}")
    except Exception as e:
        logger.error(f"저장 중 예외: {e}")


async def save_user_message_for_existing_session(
    session_id: str,
    user_msg: Message,
    request: ChatRequest
) -> None:
    """기존 세션에 유저 메시지만 저장 (스트리밍 시작 전)"""
    async with AsyncSessionLocal() as db:
        try:
            message = ChatMessage(
                session_id=session_id,
                role="user",
                content=user_msg.content,
                attached_file_name=request.attached_file_name,
                attached_file_context=request.document_context
            )
            db.add(message)
            await db.commit()
            logger.debug(f"유저 메시지 저장 (기존 세션): session={session_id}")
        except Exception as e:
            logger.error(f"유저 메시지 저장 실패: {e}")
            await db.rollback()


# ============================================================
# 스트리밍 제너레이터
# ============================================================

async def stream_and_save(
    ctx: SessionContext,
    user_msg: Message,
    messages_payload: List[dict],
    request: ChatRequest
):
    """
    Ollama 스트리밍 응답을 전달하고, 완료 후 DB에 저장합니다.
    
    SSE 형식:
    - 새 세션: 첫 번째로 session_id 전송
    - 이후: Ollama 응답 청크 그대로 전달
    """
    # 새 세션이면 session_id를 먼저 전송
    if ctx.is_new:
        yield f"data: {json.dumps({'session_id': ctx.session_id})}\n\n"
    
    full_content = ""
    stream_error = None
    
    try:
        async for chunk in ollama_service.chat_stream(
            messages=messages_payload,
            model=request.model
        ):
            if not chunk.strip():
                continue
            
            yield chunk
            full_content += extract_content_from_sse(chunk)
            
    except asyncio.CancelledError:
        logger.info(f"클라이언트 연결 끊김: session={ctx.session_id}")
        # 부분 저장을 위해 에러를 기록하지만 finally로 진행
        raise
        
    except Exception as e:
        logger.error(f"스트리밍 에러: {e}", exc_info=True)
        stream_error = str(e)
        yield f"data: {json.dumps({'error': stream_error})}\n\n"
        
    finally:
        # 저장할 내용이 있으면 저장
        if full_content:
            await save_conversation(
                session_id=ctx.session_id,
                is_new_session=ctx.is_new,
                user_msg=user_msg,
                assistant_content=full_content,
                model_type=ctx.model_type,
                request=request
            )
        else:
            logger.warning(f"저장할 응답 없음: session={ctx.session_id}")


# ============================================================
# API 엔드포인트
# ============================================================

@router.post("/upload", response_model=UploadResponse)
async def upload_document(file: UploadFile = File(...)):
    """문서 업로드 및 파싱 (PDF, TXT, DOCX)"""
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
    채팅 스트리밍 엔드포인트
    
    Lazy Persistence 구현:
    - 새 세션: 응답 완료 후에만 세션 + 메시지 저장
    - 기존 세션: 유저 메시지 즉시 저장, 어시스턴트 응답은 완료 후 저장
    """
    # 입력 검증
    if not request.messages:
        raise HTTPException(status_code=400, detail="Messages cannot be empty")
    
    user_msg = request.messages[-1]
    
    # 1. 세션 컨텍스트 준비
    ctx = await prepare_session_context(request.session_id, request.model)
    logger.info(f"세션 준비: id={ctx.session_id}, new={ctx.is_new}, model_type={ctx.model_type}")
    
    # 2. 기존 세션이면 유저 메시지 먼저 저장
    if not ctx.is_new and user_msg.role == "user":
        await save_user_message_for_existing_session(ctx.session_id, user_msg, request)
    
    # 3. 메시지 페이로드 구성
    # 기존 세션: 히스토리에서 마지막 메시지 제외 (방금 저장한 유저 메시지와 중복 방지)
    history_for_context = ctx.history[:-1] if ctx.history and not ctx.is_new else ctx.history
    
    messages_payload = ContextService.build_context_messages(
        history=history_for_context,
        new_message={"role": "user", "content": user_msg.content},
        document_context=request.document_context,
        model=request.model
    )
    
    # 4. 스트리밍 응답 반환
    return StreamingResponse(
        stream_and_save(ctx, user_msg, messages_payload, request),
        media_type="text/event-stream"
    )
