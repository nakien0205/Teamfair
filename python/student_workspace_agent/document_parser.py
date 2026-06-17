"""Document parsing utilities for extracting text content from PDF, DOCX, MD, and TXT files."""

from __future__ import annotations

import io
from pypdf import PdfReader
from docx import Document


def extract_text_from_bytes(file_bytes: bytes, file_name: str, max_chars: int = 5000) -> str:
    """
    Extracts text content from a document represented as raw bytes based on the file extension.
    Truncates text to `max_chars` to remain token-efficient.
    """
    ext = file_name.split(".")[-1].lower()
    text = ""

    try:
        if ext == "pdf":
            reader = PdfReader(io.BytesIO(file_bytes))
            pages_text = []
            for i, page in enumerate(reader.pages):
                page_content = page.extract_text()
                if page_content:
                    pages_text.append(page_content)
                # Check character budget to avoid reading the whole file if it's huge
                if sum(len(p) for p in pages_text) > max_chars:
                    break
            text = "\n".join(pages_text)

        elif ext == "docx":
            doc = Document(io.BytesIO(file_bytes))
            paragraphs_text = []
            for p in doc.paragraphs:
                if p.text:
                    paragraphs_text.append(p.text)
                if sum(len(pt) for pt in paragraphs_text) > max_chars:
                    break
            text = "\n".join(paragraphs_text)

        elif ext in ("txt", "md"):
            try:
                text = file_bytes.decode("utf-8")
            except UnicodeDecodeError:
                text = file_bytes.decode("latin-1", errors="replace")

        else:
            text = f"[Unsupported file type .{ext}]"

    except Exception as e:
        text = f"[Error parsing document {file_name}: {e}]"

    # Truncate and add indicator if truncated
    if len(text) > max_chars:
        return text[:max_chars] + f"\n... (Đã lược bớt nội dung dài, tổng độ dài file: {len(text)} ký tự)"
    return text
