#!/usr/bin/env python3
"""Example usage of the Gemini Web Wrapper with cookie management.

This script demonstrates:
- Creating profiles from browser cookies
- Listing and managing profiles
- Using gemini-webapi with cookie authentication
- Switching between profiles
"""

import asyncio

import httpx


async def main() -> None:
    """Run example usage scenarios."""
    base_url = "http://localhost:9000"

    async with httpx.AsyncClient() as client:
        print("=== Gemini Web Wrapper - Cookie Management Examples ===\n")

        # 1. Health check
        print("1. Health check...")
        response = await client.get(f"{base_url}/health")
        print(f"   Status: {response.json()}\n")

        # 2. Create a profile from Chrome browser
        print("2. Creating profile 'my-account' from Chrome cookies...")
        print("   (Make sure you're logged into gemini.google.com in Chrome)")
        try:
            response = await client.post(
                f"{base_url}/profiles/create",
                json={"name": "my-account", "browser": "chrome"},
            )
            print(f"   Result: {response.json()}")
        except httpx.HTTPStatusError as e:
            print(f"   Error: {e.response.json()}")
        print()

        # 3. List all profiles
        print("3. Listing all profiles...")
        response = await client.get(f"{base_url}/profiles/list")
        data = response.json()
        print(f"   Found {data['count']} profile(s):")
        for profile in data["profiles"]:
            print(
                f"   - {profile['name']} ({profile['browser']}) - {profile['cookie_count']} cookies"
            )
        print(f"   Current profile: {data['current_profile']}\n")

        # 4. Chat using gemini-webapi with auto cookie import
        print("4. Chat using auto cookie import...")
        try:
            response = await client.post(
                f"{base_url}/gemini/chat",
                json={"message": "Hello! Say hi in one sentence."},
            )
            data = response.json()
            print(f"   Response: {data['text']}")
            print(f"   Conversation ID: {data['conversation_id']}")
            print(f"   Profile: {data['profile']}\n")

            # Save conversation ID for later
            conv_id = data["conversation_id"]

        except httpx.HTTPStatusError as e:
            print(f"   Error: {e.response.json()}")
            conv_id = None
            print()

        # 5. Continue conversation (if we have a conversation ID)
        if conv_id:
            print("5. Continuing conversation...")
            try:
                response = await client.post(
                    f"{base_url}/gemini/chat",
                    json={
                        "message": "What's 2+2?",
                        "conversation_id": conv_id,
                    },
                )
                data = response.json()
                print(f"   Response: {data['text']}\n")
            except httpx.HTTPStatusError as e:
                print(f"   Error: {e.response.json()}\n")

        # 6. Chat with a specific profile
        print("6. Chat using specific profile 'my-account'...")
        try:
            response = await client.post(
                f"{base_url}/gemini/chat",
                json={
                    "message": "Tell me a fun fact about Python in one sentence.",
                    "profile": "my-account",
                },
            )
            data = response.json()
            print(f"   Response: {data['text']}")
            print(f"   Profile: {data['profile']}\n")
        except httpx.HTTPStatusError as e:
            print(f"   Error: {e.response.json()}\n")

        # 7. List conversations
        print("7. Listing all conversations...")
        try:
            response = await client.get(f"{base_url}/gemini/conversations")
            data = response.json()
            print(f"   Found {data['count']} conversation(s)")
            for conv in data["conversations"][:3]:  # Show first 3
                print(f"   - {conv}")
            print()
        except httpx.HTTPStatusError as e:
            print(f"   Error: {e.response.json()}\n")

        # 8. Switch profiles
        print("8. Switching to profile 'my-account'...")
        try:
            response = await client.post(
                f"{base_url}/profiles/switch",
                json={"name": "my-account"},
            )
            print(f"   Result: {response.json()}\n")
        except httpx.HTTPStatusError as e:
            print(f"   Error: {e.response.json()}\n")

        # 9. Refresh profile cookies
        print("9. Refreshing profile 'my-account' cookies...")
        try:
            response = await client.post(f"{base_url}/profiles/my-account/refresh")
            print(f"   Result: {response.json()}\n")
        except httpx.HTTPStatusError as e:
            print(f"   Error: {e.response.json()}\n")

        # 10. Use existing Genkit endpoints (still work!)
        print("10. Using existing Genkit /chat endpoint...")
        try:
            response = await client.post(
                f"{base_url}/chat",
                json={
                    "prompt": "Say hello in one sentence",
                    "system": "You are a friendly assistant",
                },
            )
            data = response.json()
            print(f"   Response: {data['text']}\n")
        except httpx.HTTPStatusError as e:
            print(f"   Error: {e.response.json()}\n")

        print("=== Examples Complete ===")
        print("\nNOTE: You can also create profiles from other browsers:")
        print("  - Firefox: {'name': 'firefox-account', 'browser': 'firefox'}")
        print("  - Edge: {'name': 'edge-account', 'browser': 'edge'}")
        print("  - Safari: {'name': 'safari-account', 'browser': 'safari'}")
        print("  - All: {'name': 'all-browsers', 'browser': 'all'}")


if __name__ == "__main__":
    asyncio.run(main())
