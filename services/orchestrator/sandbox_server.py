"""
Minimal standalone sandbox server.
Run: python sandbox_server.py
Exposes POST /sandbox/execute on port 8000.
"""

import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from src.sandbox.routes import router as sandbox_router

app = FastAPI(title="Sandbox Server")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
app.include_router(sandbox_router)

@app.get("/health")
def health():
    return {"status": "ok"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")
