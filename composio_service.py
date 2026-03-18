import os
from typing import Any

from composio import Composio

class ComposioService:
    """Service for managing Composio tools and sessions."""

    def __init__(self, api_key: str | None = None):
        """Initialize Composio service.

        Args:
            api_key: Optional Composio API key.
        """
        self.api_key = api_key or os.environ.get("COMPOSIO_API_KEY")
        if not self.api_key:
            # We don't raise here to allow the app to start without Composio
            self.composio = None
        else:
            self.composio = Composio(api_key=self.api_key)

    async def get_tools(self, user_id: str = "default_user") -> list[Any]:
        """Get available tools for a user session.

        Args:
            user_id: User identifier.

        Returns:
            List of native tools from Composio.
        """
        if not self.composio:
            return []

        session = self.composio.create(user_id=user_id)
        return await asyncio.to_thread(session.tools)

    async def execute_tool(self, tool_name: str, arguments: dict[str, Any], user_id: str = "default_user") -> Any:
        """Execute a Composio tool.

        Note: In native tool integration, the LLM usually handles tool calls.
        This is for direct execution if needed.
        """
        if not self.composio:
            raise ValueError("Composio API key not configured")

        session = self.composio.create(user_id=user_id)
        # This is a simplified direct execution if needed
        # In practice, we'd use the session to handle tool calls
        return await session.execute(tool_name, arguments)
