"""
Context Service for managing conversation history and context window limits.

This service handles:
1. Fetching chat history from the database by session_id.
2. Pruning messages to fit within model-specific context window limits.
3. Estimating token counts with Korean text support.
"""

from typing import List, Dict, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal
from app.models import ChatMessage


# Model-specific context window limits (in tokens)
# Using conservative estimates to leave room for response
MODEL_CONTEXT_LIMITS = {
    "deepseek-r1:32b": 24000,      # 32K window, reserve 8K for response
    "llama3.3:70b-instruct-q3_K_M": 6000,  # 8K window, reserve 2K for response
    "exaone4.0:32b": 24000,        # 32K window, reserve 8K for response
    "default": 4000                 # Fallback for unknown models
}

# Default System Prompts by Model
DEFAULT_SYSTEM_PROMPTS = {
    "deepseek-r1:32b": """You are a helpful assistant.
Please answer in the same language as the user's question. (사용자의 질문과 같은 언어로 답변해 주세요).
When answering in Korean, use Hangul primarily.
However, you may use Chinese characters (Hanja) in parentheses if it helps clarify meanings or is appropriate for the context (e.g. idioms, technical terms).
(한국어로 답변할 때는 주로 한글을 사용하되, 의미 명확화가 필요하거나 문맥상 적절한 경우(예: 사자성어, 전문용어)에는 괄호 안에 한자를 병기할 수 있습니다.)"""
}

# Token estimation ratios (chars per token)
# Korean text averages ~1.5-2 chars per token, English ~4 chars per token
KOREAN_CHARS_PER_TOKEN = 1.8
ENGLISH_CHARS_PER_TOKEN = 4.0


def estimate_tokens(text: str) -> int:
    """
    Estimate token count for mixed Korean/English text.
    Uses a weighted average based on character type detection.
    """
    if not text:
        return 0
    
    korean_chars = sum(1 for c in text if '\uac00' <= c <= '\ud7a3' or '\u3131' <= c <= '\u318e')
    total_chars = len(text)
    english_chars = total_chars - korean_chars
    
    korean_tokens = korean_chars / KOREAN_CHARS_PER_TOKEN
    english_tokens = english_chars / ENGLISH_CHARS_PER_TOKEN
    
    return int(korean_tokens + english_tokens) + 1  # +1 for safety margin


def estimate_messages_tokens(messages: List[Dict]) -> int:
    """Estimate total tokens for a list of messages."""
    total = 0
    for msg in messages:
        # Add overhead for role and message structure (~4 tokens per message)
        total += 4
        total += estimate_tokens(msg.get("content", ""))
    return total


class ContextService:
    """Service for managing conversation context."""
    
    @staticmethod
    async def get_chat_history(session_id: str) -> List[Dict]:
        """
        Fetch chat history from the database for a given session.
        Returns messages in chronological order.
        """
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(ChatMessage)
                .where(ChatMessage.session_id == session_id)
                .order_by(ChatMessage.created_at.asc())
            )
            messages = result.scalars().all()
            
            return [
                {
                    "role": msg.role,
                    "content": msg.content,
                    "reasoning": msg.reasoning,
                    "attached_file_name": msg.attached_file_name,
                    "attached_file_context": msg.attached_file_context
                }
                for msg in messages
            ]
    
    @staticmethod
    def get_context_limit(model: str) -> int:
        """Get the context window limit for a specific model."""
        return MODEL_CONTEXT_LIMITS.get(model, MODEL_CONTEXT_LIMITS["default"])
    
    @staticmethod
    def build_context_messages(
        history: List[Dict],
        new_message: Dict,
        document_context: Optional[str] = None,
        model: str = "default"
    ) -> List[Dict]:
        """
        Build the final message list for the LLM, respecting context limits.
        
        Strategy:
        1. Always include the system message (if document_context exists).
        2. Always include the new user message.
        3. Include as many recent history messages as possible.
        4. Drop oldest messages first if limit is exceeded.
        """
        max_tokens = ContextService.get_context_limit(model)
        
        # 1. Build system message if document context exists
        system_message = None
        system_tokens = 0
        system_content = ""

        if document_context:
            system_content = f"""다음은 사용자가 첨부한 문서의 내용입니다. 이 문서를 참고하여 질문에 답변해주세요.
--- 첨부 문서 시작 ---
{document_context}
--- 첨부 문서 끝 ---
위 문서 내용을 바탕으로 사용자의 질문에 정확하고 도움이 되는 답변을 제공해주세요."""
        else:
             # Try to find the most recent document context from history
             for msg in reversed(history):
                 if msg.get("attached_file_context"):
                     file_context = msg["attached_file_context"]
                     file_name = msg.get("attached_file_name", "Unknown File")
                     system_content = f"""(이전 대화에서 첨부된 문서 '{file_name}')
다음은 사용자가 이전에 첨부한 문서({file_name})의 내용입니다. 계속해서 이 문서를 참고하여 답변해주세요.
--- 첨부 문서 시작 ({file_name}) ---
{file_context}
--- 첨부 문서 끝 ---
"""
                     break
        
        # Append language instruction if configured for the model
        language_instruction = DEFAULT_SYSTEM_PROMPTS.get(model)
        if language_instruction:
            if system_content:
                system_content += f"\n\n{language_instruction}"
            else:
                system_content = language_instruction

        if system_content:
            system_message = {
                "role": "system",
                "content": system_content
            }
            system_tokens = estimate_messages_tokens([system_message])
        
        # 2. Estimate tokens for the new message
        new_message_tokens = estimate_messages_tokens([new_message])
        
        # 3. Calculate remaining budget for history
        remaining_budget = max_tokens - system_tokens - new_message_tokens
        
        if remaining_budget <= 0:
            # Only system + new message fit
            result = []
            if system_message:
                result.append(system_message)
            result.append(new_message)
            return result
        
        # 4. Add history messages from most recent, working backwards
        # Convert history to simple role/content format for LLM
        history_for_llm = [
            {"role": msg["role"], "content": msg["content"]}
            for msg in history
            if msg["role"] in ("user", "assistant")  # Only include user/assistant, not system/debug roles
        ]
        
        selected_history = []
        current_tokens = 0
        
        # Iterate from most recent to oldest
        for msg in reversed(history_for_llm):
            msg_tokens = estimate_messages_tokens([msg])
            if current_tokens + msg_tokens <= remaining_budget:
                selected_history.insert(0, msg)  # Insert at beginning to maintain order
                current_tokens += msg_tokens
            else:
                break  # Stop when budget exceeded
        
        # 5. Build final message list
        result = []
        if system_message:
            result.append(system_message)
        result.extend(selected_history)
        result.append(new_message)
        
        return result
