try:
    import google.generativeai as genai

    print("✅ google.generativeai imported successfully")
except ImportError:
    print("❌ google.generativeai import failed")

try:
    from google import genai

    print("✅ google.genai imported successfully")
except ImportError:
    print("❌ google.genai import failed")
