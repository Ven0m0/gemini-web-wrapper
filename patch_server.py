import re

with open("server.py") as f:
    content = f.read()

# Remove _stream_gemini_sse, _build_tool_call_response, and openai_chat_completions
content = re.sub(
    r"# ----- OpenAI-Compatible Endpoints -----.*?# ----- Profile Management Endpoints -----",
    "# ----- Profile Management Endpoints -----",
    content,
    flags=re.DOTALL,
)

# Add the router import
content = content.replace(
    "from openai_schemas import ChatCompletionRequest, ChatCompletionResponse\n", ""
)
content = content.replace(
    "from openai_transforms import (\n    collapse_messages,\n    parse_tool_calls,\n    to_chat_completion_response,\n)\n",
    "",
)

content = content.replace(
    "from cachetools import TTLCache\n",
    "from cachetools import TTLCache\nfrom endpoints.openai import router as openai_router\n",
)

# Include the router
app_init = 'app.add_middleware(\n    CORSMiddleware,\n    allow_origins=["*"],  # For production, replace "*" with your Vercel URL\n    allow_credentials=True,\n    allow_methods=["*"],\n    allow_headers=["*"],\n)'
new_app_init = app_init + "\n\napp.include_router(openai_router)"
content = content.replace(app_init, new_app_init)

with open("server.py", "w") as f:
    f.write(content)
