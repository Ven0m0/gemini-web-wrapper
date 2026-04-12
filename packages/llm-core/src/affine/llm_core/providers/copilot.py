from affine.llm_core.providers.openai_compatible import OpenAICompatibleProvider

DEFAULT_MODEL = "claude-sonnet-4.6"
DEFAULT_BASE_URL = "https://api.githubcopilot.com"


class CopilotProvider(OpenAICompatibleProvider):
    def __init__(
        self,
        api_key: str | None = None,
        model: str = DEFAULT_MODEL,
        base_url: str = DEFAULT_BASE_URL,
    ) -> None:
        if not api_key:
            raise ValueError("GitHub Copilot API key not provided.")
        super().__init__(
            provider_name="copilot",
            model=model,
            base_url=base_url,
            api_key=api_key,
        )
