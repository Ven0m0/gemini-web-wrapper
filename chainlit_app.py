#!/usr/bin/env python3
"""Chainlit application integrated with Gemini API.

This module provides a Chainlit-based chat interface for interacting with
Google's Gemini model. It integrates with the existing Genkit setup and
provides a modern conversational UI.
"""

from typing import Any

import chainlit as cl
from chainlit.input_widget import Select, Slider, Switch
from genkit.ai import Genkit
from genkit.plugins.google_genai import GoogleAI
from pydantic_settings import BaseSettings


# ----- Configuration -----
class Settings(BaseSettings):
    """Application settings loaded from environment or .env file."""

    google_api_key: str
    model_provider: str = "google"
    model_name: str = "gemini-2.5-flash"

    class Config:
        """Pydantic configuration."""

        env_file = ".env"


# Global state
settings = Settings()
genkit_instance: Genkit | None = None
model: Any = None


# ----- Chainlit Event Handlers -----
@cl.on_chat_start
async def on_chat_start() -> None:
    """Initialize Genkit and model when a new chat session starts."""
    global genkit_instance, model

    # Initialize Genkit if not already done
    if genkit_instance is None:
        genkit_instance = Genkit(plugins=[GoogleAI(api_key=settings.google_api_key)])
        model_path = f"{settings.model_provider}ai/{settings.model_name}"
        model = genkit_instance.get_model(model_path)

    # Set up chat settings in user session
    cl.user_session.set("model", model)
    cl.user_session.set("history", [])
    cl.user_session.set("system_message", None)

    # Create settings UI
    settings_ui = [
        Select(
            id="model_select",
            label="Model",
            values=[
                "gemini-2.5-flash",
                "gemini-2.5-pro",
                "gemini-3.0-pro",
            ],
            initial_value=settings.model_name,
        ),
        Switch(
            id="streaming",
            label="Enable Streaming",
            initial=False,
        ),
        Slider(
            id="max_history",
            label="Max History Length",
            initial=10,
            min=0,
            max=50,
            step=1,
        ),
    ]

    await cl.ChatSettings(settings_ui).send()

    # Send welcome message
    welcome_msg = (
        "👋 **Welcome to Gemini Chat powered by Chainlit!**\n\n"
        f"You're currently using **{settings.model_name}**.\n\n"
        "Features:\n"
        "- 💬 Conversational AI with context awareness\n"
        "- 🔄 Conversation history tracking\n"
        "- ⚙️ Customizable model settings\n"
        "- 🚀 Fast responses powered by Genkit\n\n"
        "Start chatting by typing a message below!"
    )
    await cl.Message(content=welcome_msg).send()


@cl.on_settings_update
async def on_settings_update(settings_dict: dict[str, Any]) -> None:
    """Handle settings updates from the UI.

    Args:
        settings_dict: Updated settings from the UI.
    """
    global model, genkit_instance

    # Update model if changed
    model_name = settings_dict.get("model_select")
    if model_name and model_name != settings.model_name:
        settings.model_name = model_name
        if genkit_instance:
            model_path = f"{settings.model_provider}ai/{model_name}"
            model = genkit_instance.get_model(model_path)
            cl.user_session.set("model", model)
            await cl.Message(content=f"✅ Model switched to **{model_name}**").send()


@cl.on_message
async def on_message(message: cl.Message) -> None:
    """Process incoming messages and generate responses.

    Args:
        message: The incoming message from the user.
    """
    # Get model and history from session
    current_model = cl.user_session.get("model")
    history = cl.user_session.get("history", [])
    system_message = cl.user_session.get("system_message")

    # Get settings
    settings_dict = cl.user_session.get("chat_settings", {})
    max_history = settings_dict.get("max_history", 10)
    streaming_enabled = settings_dict.get("streaming", False)

    # Build messages list
    messages = []
    if system_message:
        messages.append({"role": "system", "content": system_message})

    # Add history (limited by max_history)
    messages.extend(history[-max_history:] if max_history > 0 else [])

    # Add current user message
    messages.append({"role": "user", "content": message.content})

    # Create response message
    response_msg = cl.Message(content="")

    try:
        if streaming_enabled:
            # Simulate streaming by generating full response then displaying
            # Genkit doesn't provide true token streaming
            response = await cl.make_async(current_model.generate)(messages)
            text = str(response.text)

            # Stream word by word for better UX
            words = text.split()
            for word in words:
                await response_msg.stream_token(word + " ")

            await response_msg.send()
        else:
            # Generate response without streaming
            response = await cl.make_async(current_model.generate)(messages)
            text = str(response.text)
            response_msg.content = text
            await response_msg.send()

        # Update history
        history.append({"role": "user", "content": message.content})
        history.append({"role": "model", "content": text})
        cl.user_session.set("history", history)

    except Exception as e:
        error_msg = f"❌ Error generating response: {e!s}"
        response_msg.content = error_msg
        await response_msg.send()


@cl.on_chat_end
async def on_chat_end() -> None:
    """Clean up when chat session ends."""
    # Clear session data
    cl.user_session.clear()


# ----- Actions -----
@cl.action_callback("clear_history")
async def clear_history_action(action: cl.Action) -> None:
    """Clear conversation history.

    Args:
        action: The action that triggered this callback.
    """
    cl.user_session.set("history", [])
    await cl.Message(content="🗑️ Conversation history cleared!").send()

    # Remove the action button
    await action.remove()


@cl.action_callback("set_system_message")
async def set_system_message_action(action: cl.Action) -> None:
    """Set a custom system message.

    Args:
        action: The action that triggered this callback.
    """
    # Ask user for system message
    res = await cl.AskUserMessage(
        content="Please provide a system message to customize the AI's behavior:",
        timeout=60,
    ).send()

    if res:
        cl.user_session.set("system_message", res["output"])
        await cl.Message(
            content=f"✅ System message set to:\n\n> {res['output']}"
        ).send()

    await action.remove()


if __name__ == "__main__":
    # This is only used for development
    # In production, use: chainlit run chainlit_app.py
    print("Please run with: chainlit run chainlit_app.py")
