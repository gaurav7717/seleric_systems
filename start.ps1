# start.ps1 — Start all local development services (Windows)
# Usage: .\start.ps1
#        .\start.ps1 -SkipDocker    # skip Postgres/Redis if already running
#        .\start.ps1 -SkipOrchestrator

param(
    [switch]$SkipDocker,
    [switch]$SkipOrchestrator
)

$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot
Set-Location $Root

function Write-Step($Message) { Write-Host "`n▶ $Message" -ForegroundColor Green }
function Write-Warn($Message) { Write-Host "⚠ $Message" -ForegroundColor Yellow }

Write-Step "Multi-Agent System — local dev startup"

# ── Environment file ───────────────────────────────────────
if (-not (Test-Path ".env.local")) {
    if (Test-Path ".env.example") {
        Copy-Item ".env.example" ".env.local"
        Write-Warn "Created .env.local from .env.example — add your API keys before using external services."
    } else {
        Write-Warn ".env.local not found — some services may fail without env vars."
    }
}

# ── Infrastructure (Postgres + Redis) ───────────────────────
if (-not $SkipDocker) {
    Write-Step "Starting Postgres + Redis (Docker)..."
    docker compose up -d postgres redis

    Write-Host "  Waiting for Postgres..."
    $ready = $false
    for ($i = 0; $i -lt 30; $i++) {
        docker compose exec -T postgres pg_isready -U multiagent 2>$null | Out-Null
        if ($LASTEXITCODE -eq 0) { $ready = $true; break }
        Start-Sleep -Seconds 2
    }
    if (-not $ready) {
        throw "Postgres did not become ready within 60 seconds."
    }
    Write-Host "  Postgres ready" -ForegroundColor Green
} else {
    Write-Warn "Skipping Docker infrastructure (-SkipDocker)"
}

# ── Python orchestrator (separate terminal) ─────────────
if (-not $SkipOrchestrator) {
    Write-Step "Starting orchestrator (new window, port 8000)..."

    $pythonPath = @(
        "$Root\services\orchestrator",
        "$Root\services",
        "$Root"
    ) -join ";"

    $orchDir = "$Root\services\orchestrator"
    $orchCmd = @"
Set-Location '$orchDir'
`$env:PYTHONPATH = '$pythonPath'
`$env:ENVIRONMENT = 'development'
if (Get-Command uv -ErrorAction SilentlyContinue) {
  uv run uvicorn src.main:app --host 0.0.0.0 --port 8000 --reload
} else {
  python -m uvicorn src.main:app --host 0.0.0.0 --port 8000 --reload
}
"@

    Start-Process pwsh -ArgumentList "-NoExit", "-Command", $orchCmd
} else {
    Write-Warn "Skipping orchestrator (-SkipOrchestrator)"
}

# ── Node services (web, worker, mcp-shopify via Turbo) ────
Write-Step "Starting Node services (web :3000, worker, mcp-shopify :3100)..."
Write-Host ""
Write-Host "  Web UI:         http://localhost:3000"
Write-Host "  Orchestrator:   http://localhost:8000/docs"
Write-Host "  MCP Shopify:    http://localhost:3100"
Write-Host ""
Write-Host "Press Ctrl+C to stop Node services (orchestrator window stays open)."
Write-Host ""

pnpm dev
