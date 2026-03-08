with open("response_builder.py") as f:
    content = f.read()

content = content.replace(
    "from message_transforms import parse_tool_calls",
    "from tool_parsing import parse_tool_calls",
)

with open("response_builder.py", "w") as f:
    f.write(content)
