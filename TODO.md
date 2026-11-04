- [x] fix the "Error: 500 : Internal Server Error" error even when the vercel api key and the opencode zen api keys are configured. (Cause: Zen defaulted to a local `opencode serve` URL, and connection failures were unhandled. Fixed with mocked tests; confirm with a real key.)
- [ ] [vite:react-swc] We recommend switching to `@vitejs/plugin-react` for improved performance as no swc plugins are used. More information at https://vite.dev/rolldown
- [ ] fix the local run: "dev:api | INFO:     Started server process [13676]
dev:api | INFO:     Waiting for application startup.
dev:api | INFO:     Application startup complete.
dev:api | INFO:     127.0.0.1:65261 - "GET / HTTP/1.1" 404 Not Found
dev:api | INFO:     127.0.0.1:65261 - "GET /favicon.ico HTTP/1.1" 404 Not Found"
- [x] the baserurl "https://opencode.ai/zen/v1" results in this error: "Error: 400 Bad Request: {"detail":"Upstream request failed: Model is unavailable."}" (Cause: `opencode/` model ID prefix; Zen's API takes bare IDs. Fixed with mocked tests; confirm with a real key.)
