
import os
import asyncio
from llm_core.factory import ProviderFactory
from llm_core.providers.gemini import GeminiProvider
from llm_core.providers.anthropic import AnthropicProvider

async def verify():
    print("Verifying LLM Factory and Providers...")

    # Test Gemini Creation
    try:
        gemini = ProviderFactory.create("gemini", api_key="fake_key")
        print(f"✅ Gemini Provider created: {type(gemini)}")
        assert isinstance(gemini, GeminiProvider)
    except Exception as e:
        print(f"❌ Gemini Creation Failed: {e}")

    # Test Anthropic Creation
    try:
        # We need a dummy env var or explicit key to avoid errors if SDK checks eagerly
        anthropic = ProviderFactory.create("anthropic", api_key="fake_key")
        print(f"✅ Anthropic Provider created: {type(anthropic)}")
        assert isinstance(anthropic, AnthropicProvider)
    except Exception as e:
        print(f"❌ Anthropic Creation Failed: {e}")

    # Test Copilot Creation
    try:
        from llm_core.providers.copilot import CopilotProvider
        copilot = ProviderFactory.create("copilot")
        print(f"✅ Copilot Provider created: {type(copilot)}")
        assert isinstance(copilot, CopilotProvider)
    except Exception as e:
        print(f"❌ Copilot Creation Failed: {e}")

    print("Verification Script Finished.")

if __name__ == "__main__":
    asyncio.run(verify())
