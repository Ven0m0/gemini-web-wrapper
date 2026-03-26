"""Affine AI shared package.

Monorepo shared utilities, types, and schemas for the Affine AI coding workstation.
"""

from affine.shared.models import (
    APIResponse,
    ChatRequestBase,
    ChatResponseBase,
    ChatResponseChoice,
    ChatResponseUsage,
    ErrorResponse,
    StreamChunk,
    StreamChunkChoice,
)
from affine.shared.provider_config import (
    AnthropicProviderConfig,
    BifrostProviderConfig,
    CopilotProviderConfig,
    GoogleProviderConfig,
    ModelAliases,
    ProviderConfig,
)
from affine.shared.schemas import ContentPart, Message, ProviderType, Role
from affine.shared.tools import (
    FunctionCall,
    ToolCall,
    ToolCallPreference,
    ToolChoice,
    ToolDefinition,
    ToolParameterProperty,
    ToolParameters,
)

__all__ = [
    # Schemas
    "ContentPart",
    "Message",
    "ProviderType",
    "Role",
    # Provider config
    "ModelAliases",
    "ProviderConfig",
    "GoogleProviderConfig",
    "AnthropicProviderConfig",
    "CopilotProviderConfig",
    "BifrostProviderConfig",
    # Tools
    "FunctionCall",
    "ToolCall",
    "ToolCallPreference",
    "ToolChoice",
    "ToolDefinition",
    "ToolParameterProperty",
    "ToolParameters",
    # Models
    "APIResponse",
    "ChatRequestBase",
    "ChatResponseBase",
    "ChatResponseChoice",
    "ChatResponseUsage",
    "ErrorResponse",
    "StreamChunk",
    "StreamChunkChoice",
]
