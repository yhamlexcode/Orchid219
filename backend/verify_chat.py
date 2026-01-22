import httpx
import json
import asyncio

url = "http://localhost:8000/api/chat/stream"
payload = {
    "messages": [{"role": "user", "content": "Hello, simply say Hi back."}],
    "model": "llama3.3:70b-instruct-q3_K_M"
}

async def main():
    print(f"Sending request to {url}...")
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            async with client.stream("POST", url, json=payload) as response:
                print("Response status:", response.status_code)
                print("Stream content:")
                async for line in response.aiter_lines():
                    if line:
                        print(line)
                        if "[DONE]" in line:
                            break
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(main())
