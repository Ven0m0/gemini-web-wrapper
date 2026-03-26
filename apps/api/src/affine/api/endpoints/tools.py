import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from composio_service import ComposioService
from state import state

router = APIRouter(prefix="/tools/composio", tags=["tools", "composio"])


class ComposioListReq(BaseModel):
    """Request model for listing Composio tools."""

    user_id: str = Field(default="default_user")


class ComposioExecuteReq(BaseModel):
    """Request model for executing a Composio tool."""

    tool_name: str = Field(..., min_length=1)
    arguments: dict[str, Any] = Field(default_factory=dict)
    user_id: str = Field(default="default_user")


def get_composio_service() -> ComposioService:
    """FastAPI dependency to get the initialized ComposioService."""
    if not hasattr(state, "composio_service") or state.composio_service is None:
        # Lazy initialization
        api_key = state.settings.composio_api_key if state.settings else None
        state.composio_service = ComposioService(api_key=api_key)

    if state.composio_service is None or not state.composio_service.api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Composio API key not configured.",
        )
    return state.composio_service


@router.post("/list")
async def list_tools(
    r: ComposioListReq,
    service: ComposioService = Depends(get_composio_service),
) -> dict[str, Any]:
    """List available Composio tools for a user."""
    try:
        tools = await service.get_tools(r.user_id)
        # Return simplified tool info
        return {
            "tools": [
                {
                    "name": tool.get("function", {}).get("name"),
                    "description": tool.get("function", {}).get("description"),
                }
                for tool in tools
            ],
            "count": len(tools),
        }
    except Exception as e:
        logging.exception("Failed to list Composio tools for user %s", r.user_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list tools.",
        ) from e


@router.post("/execute")
async def execute_tool(
    r: ComposioExecuteReq,
    service: ComposioService = Depends(get_composio_service),
) -> dict[str, Any]:
    """Execute a specific Composio tool."""
    try:
        result = await service.execute_tool(r.tool_name, r.arguments, r.user_id)
        return {"result": result}
    except Exception as e:
        logging.exception(
            "Composio tool execution failed for user %s and tool %s",
            r.user_id,
            r.tool_name,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Tool execution failed.",
        ) from e
