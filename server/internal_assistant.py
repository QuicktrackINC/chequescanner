import os
import hmac
from fastapi import APIRouter, Depends, Request, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import desc

from .database import get_db
from .models import CheckBatch, Check, CheckStatus

router = APIRouter(prefix="/api/internal/assistant", tags=["Internal Assistant"])

def validate_assistant_request(request: Request):
    api_key = request.headers.get("x-internal-api-key")
    request_source = request.headers.get("x-request-source")
    expected_key = os.getenv("INTERNAL_ASSISTANT_API_KEY")

    if not expected_key:
        raise HTTPException(status_code=503, detail="Service unavailable")

    if not api_key or not hmac.compare_digest(api_key.encode(), expected_key.encode()):
        raise HTTPException(status_code=401, detail="Unauthorized")

    if request_source != "quicktrack-hub":
        raise HTTPException(status_code=403, detail="Forbidden")

    return True

@router.post("/recent-batches", dependencies=[Depends(validate_assistant_request)])
def get_recent_batches(db: Session = Depends(get_db)):
    """Retrieve the 10 most recent cheque upload batches."""
    try:
        batches = db.query(CheckBatch).order_by(desc(CheckBatch.created_at)).limit(10).all()
        result = []
        for b in batches:
            result.append({
                "id": b.id,
                "status": b.status.value if b.status else None,
                "created_by": b.created_by,
                "created_at": b.created_at.isoformat() if b.created_at else None,
            })
        return JSONResponse(content={"batches": result})
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/pending-checks", dependencies=[Depends(validate_assistant_request)])
def get_pending_checks(db: Session = Depends(get_db)):
    """Retrieve up to 20 cheques currently awaiting manual review."""
    try:
        checks = db.query(Check).filter(Check.status == CheckStatus.MANUAL_REVIEW).order_by(desc(Check.created_at)).limit(20).all()
        result = []
        for c in checks:
            result.append({
                "id": c.id,
                "batch_id": c.batch_id,
                "store_name": c.store_name,
                "payee": c.payee,
                "amount": c.amount,
                "validation_notes": c.validation_notes,
                "created_at": c.created_at.isoformat() if c.created_at else None,
            })
        return JSONResponse(content={"checks": result})
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
