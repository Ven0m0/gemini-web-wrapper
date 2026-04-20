from affine.llm_core.providers.gemini import GeminiProvider

def test():
    try:
        GeminiProvider._extract_text({"candidates": []})
        print("Empty candidates success")
    except Exception as e:
        print("Empty candidates failed:", type(e).__name__)

test()
