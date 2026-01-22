"""
Document Parsing Service for Chat Context
Supports PDF, TXT, and DOCX files
"""

import io
from typing import Optional
from fastapi import UploadFile, HTTPException
import fitz  # PyMuPDF
from docx import Document


class DocumentService:
    """Service for parsing documents and extracting text content"""
    
    MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
    ALLOWED_EXTENSIONS = {"pdf", "txt", "docx"}
    
    def __init__(self):
        pass
    
    def _get_extension(self, filename: str) -> str:
        """Extract file extension from filename"""
        if "." not in filename:
            return ""
        return filename.rsplit(".", 1)[1].lower()
    
    def _validate_file(self, file: UploadFile, content: bytes) -> None:
        """Validate file type and size"""
        extension = self._get_extension(file.filename or "")
        
        if extension not in self.ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=400,
                detail=f"지원하지 않는 파일 형식입니다. 지원 형식: {', '.join(self.ALLOWED_EXTENSIONS)}"
            )
        
        if len(content) > self.MAX_FILE_SIZE:
            raise HTTPException(
                status_code=400,
                detail=f"파일 크기가 너무 큽니다. 최대 {self.MAX_FILE_SIZE // (1024 * 1024)}MB까지 지원됩니다."
            )
    
    def _parse_pdf(self, content: bytes) -> str:
        """Extract text from PDF file"""
        text_parts = []
        try:
            with fitz.open(stream=content, filetype="pdf") as doc:
                for page_num, page in enumerate(doc, 1):
                    page_text = page.get_text()
                    if page_text.strip():
                        text_parts.append(f"[Page {page_num}]\n{page_text}")
        except Exception as e:
            raise HTTPException(
                status_code=400,
                detail=f"PDF 파일을 읽는 중 오류가 발생했습니다: {str(e)}"
            )
        
        return "\n\n".join(text_parts)
    
    def _parse_docx(self, content: bytes) -> str:
        """Extract text from DOCX file"""
        try:
            doc = Document(io.BytesIO(content))
            paragraphs = [para.text for para in doc.paragraphs if para.text.strip()]
            return "\n\n".join(paragraphs)
        except Exception as e:
            raise HTTPException(
                status_code=400,
                detail=f"DOCX 파일을 읽는 중 오류가 발생했습니다: {str(e)}"
            )
    
    def _parse_txt(self, content: bytes) -> str:
        """Extract text from TXT file"""
        try:
            # Try UTF-8 first, then fallback to other encodings
            for encoding in ["utf-8", "utf-16", "cp949", "euc-kr", "latin-1"]:
                try:
                    return content.decode(encoding)
                except UnicodeDecodeError:
                    continue
            raise HTTPException(
                status_code=400,
                detail="텍스트 파일 인코딩을 인식할 수 없습니다."
            )
        except Exception as e:
            raise HTTPException(
                status_code=400,
                detail=f"TXT 파일을 읽는 중 오류가 발생했습니다: {str(e)}"
            )
    
    async def parse_document(self, file: UploadFile) -> dict:
        """
        Parse uploaded document and extract text content
        
        Returns:
            dict: {
                "filename": str,
                "content": str,
                "char_count": int
            }
        """
        # Read file content
        content = await file.read()
        
        # Validate file
        self._validate_file(file, content)
        
        # Get extension and parse accordingly
        extension = self._get_extension(file.filename or "")
        
        if extension == "pdf":
            text = self._parse_pdf(content)
        elif extension == "docx":
            text = self._parse_docx(content)
        elif extension == "txt":
            text = self._parse_txt(content)
        else:
            text = ""
        
        # Truncate very long documents to prevent context overflow
        max_chars = 50000  # ~12,500 tokens approximately
        if len(text) > max_chars:
            text = text[:max_chars] + "\n\n[... 문서가 너무 길어 일부만 표시됩니다 ...]"
        
        return {
            "filename": file.filename,
            "content": text.strip(),
            "char_count": len(text)
        }
