import uvicorn
from affine.api.server import app
from affine.config.settings import get_settings


def run_server():
    settings = get_settings()
    uvicorn.run(app, host=settings.host, port=settings.port, reload=True)


if __name__ == "__main__":
    run_server()
