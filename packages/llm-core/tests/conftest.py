from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "shared/python/src"))
sys.path.insert(0, str(ROOT / "config/src"))
sys.path.insert(0, str(ROOT / "llm-core/src"))
