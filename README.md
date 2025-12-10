````markdown
# gemini-web-wrapper

Lightweight LAN-accessible web UI for the Gemini CLI. Minimal FastAPI backend + static HTML/JS frontend for chat and code-assist.

---

## Features
- Chat and code endpoints (`/chat`, `/code`)
- Simple editor + output pane
- No frameworks, no build step
- Works on Arch, Raspbian, Termux
- LAN-visible; optional token header
- Fast, compact, easy to modify

---

## Requirements
- Python 3.10+
- `pip install fastapi uvicorn genkit google-genai`
- `export GOOGLE_API_KEY="your_key"`

---

## Backend
Start the API server:

```bash
uvicorn server:app --host 0.0.0.0 --port 9000
````

Endpoints:

- `GET /health`
- `POST /chat` → `{ "prompt": "...", "system": "..." }`
- `POST /code` → `{ "code": "...", "instruction": "..." }`

______________________________________________________________________

## Frontend

Static files in `web/`:

- `index.html`
- `app.js`
- `style.css`

Run a local static server:

```bash
cd web
python3 -m http.server 8000
```

Open:

```
http://localhost:8000
```

Set host and token in the UI.

______________________________________________________________________

## Usage (API Examples)

Chat:

```bash
curl -s -X POST http://<host>:9000/chat \
  -H 'Content-Type: application/json' \
  -d '{"prompt":"explain async io"}'
```

Code assist:

```bash
curl -s -X POST http://<host>:9000/code \
  -H 'Content-Type: application/json' \
  -d '{"code":"def x(a): return a+1","instruction":"make async"}'
```

______________________________________________________________________

## Token Header (optional)

If enabled in the frontend:

```
X-API-KEY: <token>
```

Add simple checks in `server.py` if needed.

______________________________________________________________________

## Security

Designed for LAN/local development. Do not expose to the internet without authentication and restrictions.

______________________________________________________________________
