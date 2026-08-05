"""
Temporary endpoint to download clean server.py
"""
from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/download-server")
async def download_server():
    """Download clean server.py file"""
    return FileResponse(
        path="/app/backend/server.py",
        media_type="text/plain",
        filename="server_clean.py"
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=9000)
