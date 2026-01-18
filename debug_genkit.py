from genkit.ai import Genkit
from genkit.plugins.google_genai import GoogleAI

try:
    print("Attempting to init Genkit...")
    ai = Genkit(plugins=[GoogleAI(api_key="fake")])
    print("Genkit init success")
except Exception as e:
    print(f"Genkit init failed: {e}")
