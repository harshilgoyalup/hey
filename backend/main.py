"""
StopTheDrip FastAPI Backend Server.
Provides POST /analyze with deterministic PDF/CSV parsing, pure code financial calculations,
256-bit AES-GCM in-memory decryption, and zero data storage.
"""

import asyncio
import io
import json
import os
import time
from typing import Optional
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import sys
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from crypto import decrypt_data, decrypt_payload_b64
from parser import parse_statement
from analyzer import analyze_transactions, create_empty_response

from dotenv import load_dotenv

load_dotenv()

app = FastAPI(
    title="StopTheDrip Financial Clarity API",
    description="Autonomous recurring subscription pattern detection and financial leak audit engine.",
    version="1.0.0"
)

# Enable CORS for local and production origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Data Retention Policy: 0 seconds = ephemeral RAM-only execution (disposed immediately)
RETENTION_POLICY_SECONDS = int(os.environ.get("RETENTION_POLICY_SECONDS", "0"))
DATA_STORAGE_MODE = os.environ.get("DATA_STORAGE_MODE", "ephemeral-ram-only")


@app.get("/")
@app.get("/health")
async def health_check():
    """Health check endpoint for deployment monitoring."""
    has_gemini = bool(os.environ.get("GEMINI_API_KEY"))
    has_anthropic = bool(os.environ.get("ANTHROPIC_API_KEY"))
    return {
        "status": "active",
        "service": "StopTheDrip Financial Clarity API",
        "encryption": "256-bit AES-GCM active",
        "storage": DATA_STORAGE_MODE,
        "retention_policy_seconds": RETENTION_POLICY_SECONDS,
        "ai_guidance_provider": "google-gemini" if has_gemini else ("anthropic" if has_anthropic else "deterministic-fallback")
    }


@app.get("/security-policy")
async def get_security_policy():
    """Telemetry endpoint providing technical security and retention specifications."""
    return {
        "service": "StopTheDrip Financial Clarity",
        "encryption_standard": "AES-256-GCM / TLS 1.3",
        "data_retention_policy": {
            "retention_seconds": RETENTION_POLICY_SECONDS,
            "mode": DATA_STORAGE_MODE,
            "automatic_deletion": True,
            "description": "Uploaded financial statements are parsed strictly in volatile memory and purged immediately post-request."
        },
        "supported_formats": [".pdf", ".csv", ".txt"],
        "disclaimer": "This service provides automated transaction analytics based on uploaded statements and is not a registered financial advisor."
    }


@app.post("/analyze")
async def analyze_statement_endpoint(
    file: Optional[UploadFile] = File(None),
    is_encrypted: Optional[bool] = Form(False),
    nonce_b64: Optional[str] = Form(None),
    key_b64: Optional[str] = Form(None),
    encrypted_payload_b64: Optional[str] = Form(None),
    password: Optional[str] = Form(None)
):
    """
    Primary analysis endpoint:
    - Ingests user multipart file (PDF or CSV) or AES-256-GCM encrypted payload.
    - Operates purely in-memory (RAM) with zero disk persistence.
    - Supports password-protected PDF bank statements via in-memory decryption.
    - Runs 100% deterministic code calculations for recurring charges, frequencies, and costs.
    - Restricts AI models exclusively to plain-language cancellation guidance.
    """
    start_time = time.time()

    try:
        content_bytes: bytes = b""
        filename = "statement.csv"

        # Case 1: Encrypted payload via Web Crypto API
        if is_encrypted and encrypted_payload_b64 and nonce_b64 and key_b64:
            try:
                content_bytes = decrypt_payload_b64(encrypted_payload_b64, nonce_b64, key_b64)
                filename = file.filename if file else "statement.csv"
            except Exception as dec_err:
                raise HTTPException(status_code=400, detail=f"256-bit AES-GCM Decryption failed: {str(dec_err)}")

        # Case 2: Standard multipart file upload
        elif file is not None:
            filename = file.filename or "statement.csv"
            content_bytes = await file.read()
        else:
            raise HTTPException(status_code=400, detail="No statement file or payload provided. Please upload a bank statement.")

        if not content_bytes:
            raise HTTPException(status_code=400, detail="Uploaded statement file is empty.")

        # Parse transactions in-memory with optional password
        try:
            transactions = parse_statement(filename, content_bytes, password=password)
        except ValueError as val_err:
            err_msg = str(val_err)
            if "PASSWORD_REQUIRED" in err_msg or "PASSWORD_INCORRECT" in err_msg:
                raise HTTPException(status_code=422, detail=err_msg)
            raise HTTPException(status_code=422, detail=f"Unable to parse statement: {err_msg}")
        except Exception as parse_err:
            raise HTTPException(status_code=422, detail=f"Unable to parse statement: {str(parse_err)}")

        # If no transactions parsed, return graceful empty result
        if not transactions:
            results = create_empty_response("No transactions found in the uploaded statement. Please check the file format.")
        else:
            # Run deterministic calculation pipeline
            results = await analyze_transactions(transactions)

        # Enforce minimum ~1.5s duration for the scanning animation
        elapsed = time.time() - start_time
        if elapsed < 1.5:
            await asyncio.sleep(1.5 - elapsed)

        return JSONResponse(content=results)

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Analysis pipeline error: {str(exc)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
