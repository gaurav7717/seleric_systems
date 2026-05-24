"""
Orchestrator service — FastAPI entry point.
Receives signals from the rule engine and routes them through the LangGraph pipeline.
"""

import os
import time
from contextlib import asynccontextmanager

from dotenv import load_dotenv

# Load .env.local first (highest priority), fall back to .env
load_dotenv(".env.local", override=False)
load_dotenv(".env", override=False)

import structlog
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.api.routes import router
from src.db.client import close_pool, get_pool, health_check as db_health
from src.memory.cube_client import health_check as cube_health
from src.memory.redis_client import get_client as get_redis, health_check as redis_health
from src.memory.vector_client import health_check as vector_health

logger = structlog.get_logger()
_start_time = time.monotonic()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("orchestrator_starting", version="0.1.0", environment=os.getenv("ENVIRONMENT", "development"))

    # Warm up connections — log failures but don't crash (services may start in any order)
    await get_redis()
    logger.info("redis_connected")

    await get_pool()
    logger.info("postgres_connected")

    # Cube is optional — skip if CUBE_REST_URL not configured
    cube_ok = await cube_health()
    if cube_ok:
        logger.info("cube_connected")
    else:
        logger.warning("cube_unavailable_will_use_empty_metrics")

    yield

    await close_pool()
    logger.info("orchestrator_stopped")


app = FastAPI(
    title="Multi-Agent Orchestrator",
    version="0.1.0",
    description="LangGraph orchestrator for business intelligence agents",
    lifespan=lifespan,
    docs_url="/docs" if os.getenv("ENVIRONMENT") != "production" else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


@app.get("/health")
async def health():
    checks = {
        "redis": await redis_health(),
        "postgres": await db_health(),
        "vector": await vector_health(),
        "cube": await cube_health(),
    }
    all_ok = all(v for k, v in checks.items() if k != "cube")  # cube is optional
    return {
        "status": "ok" if all_ok else "degraded",
        "version": "0.1.0",
        "uptime_s": round(time.monotonic() - _start_time),
        "environment": os.getenv("ENVIRONMENT", "development"),
        "checks": checks,
    }


if __name__ == "__main__":
    uvicorn.run(
        "src.main:app",
        host="0.0.0.0",
        port=8000,
        reload=os.getenv("ENVIRONMENT") == "development",
        log_config=None,
    )
