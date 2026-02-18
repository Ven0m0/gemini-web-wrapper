"""Open WebUI compatibility API endpoints.

This module contains endpoints inspired by Open WebUI functionality
for compatibility and feature parity.
"""

from typing import Any, Dict

from fastapi import APIRouter

from models import (
    ChatHistoryItem,
    DocumentUploadReq,
    Tool,
)

router = APIRouter(prefix="/api", tags=["openwebui"])


@router.get("/config")
async def get_config() -> Dict[str, Any]:
    """Get Open WebUI-like configuration."""
    return {
        "version": "0.7.2",
        "theme": "dark",
        "ui": {
            "announcement": "",
            "name": "Gemini Web Wrapper",
            "logo": "/icon-192.png",
            "default_locale": "en-US",
            "sync": True,
        },
    }


@router.get("/models")
async def get_models() -> Dict[str, Any]:
    """Get available models, similar to Open WebUI."""
    return {
        "data": [
            {
                "id": "gemini-2.5-flash",
                "name": "Gemini 2.5 Flash",
                "object": "model",
                "created": 1677610602,
                "owned_by": "google",
                "meta": {"requirements": []},
                "info": {},
                "preset": True,
            },
            {
                "id": "gemini-2.5-pro",
                "name": "Gemini 2.5 Pro",
                "object": "model",
                "created": 1677610602,
                "owned_by": "google",
                "meta": {"requirements": []},
                "info": {},
                "preset": True,
            },
            {
                "id": "gemini-3.0-pro",
                "name": "Gemini 3.0 Pro",
                "object": "model",
                "created": 1677610602,
                "owned_by": "google",
                "meta": {"requirements": []},
                "info": {},
                "preset": True,
            },
        ]
    }


@router.get("/version")
async def get_version() -> Dict[str, str]:
    """Get version info, similar to Open WebUI."""
    return {"version": "0.7.2"}


@router.get("/user")
async def get_user_info() -> Dict[str, str]:
    """Get user info, similar to Open WebUI."""
    return {
        "id": "default-user",
        "email": "user@example.com",
        "name": "Default User",
        "role": "user",
        "profile_image_url": "/icon-192.png",
    }


@router.post("/chat/history")
async def save_chat_history(chat_data: Dict[str, Any]) -> Dict[str, bool]:
    """Save chat history, similar to Open WebUI."""
    # In a real implementation, this would save to a database
    # For now, we'll just return success
    return {"status": True, "message": "Chat history saved successfully"}


@router.get("/chat/history")
async def get_chat_history() -> Dict[str, Any]:
    """Get chat history, similar to Open WebUI."""
    # In a real implementation, this would fetch from a database
    # For now, we'll return an empty history
    return {"history": [], "count": 0}


@router.delete("/chat/history/{chat_id}")
async def delete_chat_history(chat_id: str) -> Dict[str, bool]:
    """Delete specific chat history, similar to Open WebUI."""
    # In a real implementation, this would delete from a database
    return {"status": True, "message": f"Chat history {chat_id} deleted successfully"}


@router.post("/document/upload")
async def upload_document(doc_req: DocumentUploadReq) -> Dict[str, Any]:
    """Upload a document for RAG, similar to Open WebUI."""
    # In a real implementation, this would store the document in a vector DB
    return {
        "status": True,
        "filename": doc_req.filename,
        "message": f"Document {doc_req.filename} uploaded successfully",
    }


@router.get("/documents")
async def get_documents() -> Dict[str, Any]:
    """Get list of documents, similar to Open WebUI."""
    # In a real implementation, this would fetch from a vector DB
    return {"documents": [], "count": 0}


@router.delete("/document/{doc_id}")
async def delete_document(doc_id: str) -> Dict[str, bool]:
    """Delete a document, similar to Open WebUI."""
    return {"status": True, "message": f"Document {doc_id} deleted successfully"}


@router.get("/tools")
async def get_tools() -> Dict[str, Any]:
    """Get available tools, similar to Open WebUI."""
    return {"tools": [], "count": 0}


@router.post("/tool")
async def create_tool(tool: Tool) -> Dict[str, bool]:
    """Create a new tool, similar to Open WebUI."""
    return {
        "status": True,
        "message": f"Tool {tool.name} created successfully",
    }