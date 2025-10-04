from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os

from core import OrbitalElements, compute_orbit

app = FastAPI()


@app.post("/api/orbit")
def get_orbit(elem: OrbitalElements, steps: int = 200):
    trajectory = compute_orbit(elem, steps)
    return {"trajectory": trajectory}


# === Serve Vite React frontend build ===
frontend_dir = os.path.join(os.path.dirname(__file__), "../Earth-main/public")
print(f"Frontend directory: {frontend_dir}")

if os.path.exists(frontend_dir):
    app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="static")

    @app.get("/{full_path:path}")
    async def serve_react_app(full_path: str):
        """Serve index.html for any route (React Router support)"""
        return FileResponse(os.path.join(frontend_dir, "index.html"))
