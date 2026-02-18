"""Session management API endpoints.

This module contains endpoints for creating and querying sessions.
"""

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status

from dependencies import get_session_manager
from models import SessionQueryReq
from session_manager import SessionManager

router = APIRouter(prefix="/memory", tags=["sessions"])


@router.post("/session/new")
async def create_new_session(
    user_id: str | None = None,
    session_mgr: SessionManager = Depends(get_session_manager),
) -> dict[str, str]:
    """Create a new session for a user.

    Args:
        user_id: Optional user identifier for the session.
        session_mgr: Injected SessionManager dependency.

    Returns:
        Dict with 'status', 'message', and 'session_id'.

    Raises:
        HTTPException: 503 if session manager not initialized, 500 on failure.
    """
    try:
        session_mgr.attribution(
            entity_id=user_id or "default_user",
            process_id="gemini-chatbot",
        )
        session_id = session_mgr.new_session()
        return {
            "status": "success",
            "message": "New session created",
            "session_id": session_id,
        }
    except (RuntimeError, ValueError, AttributeError) as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Session creation failed: {e}",
        ) from e


@router.post("/query")
async def query_sessions(
    r: SessionQueryReq,
    session_mgr: SessionManager = Depends(get_session_manager),
) -> dict[str, Any]:
    """Query active sessions for a user.

    Returns all active (non-expired) sessions for a given user.

    Args:
        r: SessionQueryReq containing user_id.
        session_mgr: Injected SessionManager dependency.

    Returns:
        Dict with 'sessions' list containing session details.

    Raises:
        HTTPException: 503 if session manager not initialized, 500 on failure.
    """
    try:
        sessions = session_mgr.get_user_sessions(r.user_id)
        session_data = [
            {
                "session_id": s.session_id,
                "user_id": s.user_id,
                "process_id": s.process_id,
                "created_at": s.created_at,
                "last_accessed": s.last_accessed,
            }
            for s in sessions
        ]
        return {
            "sessions": session_data,
            "count": len(session_data),
        }
    except (RuntimeError, ValueError, AttributeError) as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Session query failed: {e}",
        ) from e