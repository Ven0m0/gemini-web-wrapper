# Gemini Local Web Frontend

A minimal static frontend for the local Gemini Wrapper API.

## Setup

1. **Ensure Backend is Running**:
  The backend `server.py` should be running (default port 9000).

```bash
# From project root
python3 server.py
```

2. **Serve Frontend**:
  You can serve this folder using any static file server.

```bash
cd web
python3 -m http.server 8000
```

Or use `uvicorn` if available:

```bash
uvicorn web.main:app --port 8000 # if wrapped in python
# OR just python http server is simplest
```

3. **Access**:
  Open browser to `http://localhost:8000`.

## Configuration

- On first load, enter your `API Token` (matches `X-API-KEY` header expected by server) in the top bar.
- If running on a different machine, update the `API Base URL` (e.g., `http://192.168.1.5:9000`).
- Settings are saved in `localStorage`.

## Usage

- **Chat**: Enter prompt in bottom-right text area, click "Send Chat".
- **Code**: Paste code or drag/drop a file into left editor. Enter instruction below it. Click "Send Code".
- **Output**: Responses appear in the right panel. Use Copy/Download buttons to save.

## Curl Examples for Backend Testing

**Check Health:**

```bash
curl http://localhost:9000/health
```

**Chat:**

```bash
curl -X POST http://localhost:9000/chat \
     -H "Content-Type: application/json" \
     -H "X-API-KEY: your_token_here" \
     -d '{"prompt": "Hello world"}'
```

**Code:**

```bash
curl -X POST http://localhost:9000/code \
     -H "Content-Type: application/json" \
     -H "X-API-KEY: your_token_here" \
     -d '{"code": "print(1)", "instruction": "Explain this"}'
```

**Security Warning**: This frontend runs entirely client-side. Do not expose the backend port (9000) directly to the public internet without proper authentication/firewall configuration.
