import json
from typing import Any


def to_toon(obj: Any, indent: int = 0, key_folding: bool = False, prefix: str = "") -> str:
    """Encode a Python object into TOON (Token-Oriented Object Notation) format.

    Args:
        obj: The object to encode.
        indent: Current indentation level.
        key_folding: Whether to use dot notation for nested keys.
        prefix: Current key prefix (used for folding).

    Returns:
        TOON formatted string.
    """
    indent_str = "  " * indent

    if obj is None:
        return "null"

    if isinstance(obj, bool):
        return str(obj).lower()

    if isinstance(obj, (int, float)):
        return str(obj)

    if isinstance(obj, str):
        # Basic escaping for special characters if needed
        if any(c in obj for c in '",:\n[]{}'):
            return json.dumps(obj)
        return obj

    if isinstance(obj, list):
        if not obj:
            return "[]"

        # Simple list representation: key[length]: val1,val2
        items = [to_toon(item) for item in obj]
        return f"[{len(obj)}]: " + ",".join(items)

    if isinstance(obj, dict):
        lines = []
        for k, v in obj.items():
            current_key = f"{prefix}.{k}" if prefix and key_folding else k

            if key_folding and isinstance(v, dict):
                lines.append(to_toon(v, indent, key_folding, current_key))
            else:
                encoded_val = to_toon(v, indent + 1, key_folding)
                if isinstance(v, (dict, list)) and not key_folding:
                    # For nested dicts/lists, if folding is off, we use indentation
                    if isinstance(v, dict):
                        lines.append(f"{indent_str}{k}:")
                        lines.append(encoded_val)
                    else:
                        lines.append(f"{indent_str}{k}{encoded_val}")
                else:
                    lines.append(f"{indent_str}{current_key}: {encoded_val}")

        return "\n".join(filter(None, lines))

    return str(obj)
