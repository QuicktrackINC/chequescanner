import os
import hashlib
from datetime import datetime, timedelta
from cryptography.fernet import Fernet
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi import Request, HTTPException, Security, Depends
import jwt
from sqlalchemy.orm import Session
from .database import get_db

# Generate with `Fernet.generate_key().decode()` and put in .env
_fernet_key_raw = os.getenv("FERNET_KEY", "vYF9Qv2X6M-h2iVzYw6x4jQ-l8bA4yD-J0A6V9r8N-k=")
if isinstance(_fernet_key_raw, str):
    FERNET_KEY = _fernet_key_raw.encode()
else:
    FERNET_KEY = _fernet_key_raw

cipher_suite = Fernet(FERNET_KEY)

SECRET_KEY = os.getenv("SECRET_KEY", "quicktrack-super-secret-key")
HUB_SSO_SECRET = os.getenv("AUTH_SECRET", "quicktrack-dev-secret-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7 # 1 week
security = HTTPBearer()

def get_password_hash(password: str) -> str:
    """Hash password using SHA-256 (simple approach for MVP)."""
    return hashlib.sha256(password.encode()).hexdigest()

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify password."""
    return get_password_hash(plain_password) == hashed_password

def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def encrypt_data(data: str) -> str:
    if not data: return ""
    return cipher_suite.encrypt(data.encode()).decode()

def decrypt_data(token: str) -> str:
    if not token: return ""
    try:
        return cipher_suite.decrypt(token.encode()).decode()
    except Exception:
        # Fallback for existing plaintext data
        return token

def get_current_user(credentials: HTTPAuthorizationCredentials = Security(security), db: Session = Depends(get_db)):
    """Verifies JWT token and retrieves user from database."""
    from .models import User
    token = credentials.credentials
    if not token:
        raise HTTPException(status_code=401, detail="Invalid auth credentials")
    
    # Handle dev fallback token
    if token == "local-dev-token":
        # Fallback to DB check for admin if exists, else mock
        admin = db.query(User).filter(User.username == "admin").first()
        if admin:
            return {"user_id": admin.id, "username": admin.username, "role": admin.role}
        return {"user_id": 1, "username": "accounting_user", "role": "ADMIN"}

    username = None
    role = "STAFF"

    try:
        # Try Hub SSO token first
        payload = jwt.decode(token, HUB_SSO_SECRET, algorithms=[ALGORITHM], audience="cheque-scanner", options={"verify_exp": False})
        
        # Manually check token age (24 hours max)
        import time
        if time.time() - payload.get("iat", 0) > 86400:
            raise jwt.ExpiredSignatureError("SSO session expired")
            
        email = payload.get("email")
        if not email:
            raise HTTPException(status_code=400, detail="Email missing in SSO token")
            
        user = db.query(User).filter(User.email == email).first()
        if not user:
            raise HTTPException(status_code=403, detail="Account not linked. Access denied.")
            
        return {"user_id": user.id, "username": user.email, "role": user.role}
    except jwt.PyJWTError:
        pass

    try:
        # Fallback to dev secret for local Hub -> remote Vercel testing
        payload = jwt.decode(token, "quicktrack-dev-secret-change-in-production", algorithms=[ALGORITHM], audience="cheque-scanner", options={"verify_exp": False})
        
        import time
        if time.time() - payload.get("iat", 0) > 86400:
            raise jwt.ExpiredSignatureError("SSO session expired")
            
        email = payload.get("email")
        if not email:
            raise HTTPException(status_code=400, detail="Email missing in SSO token")
            
        user = db.query(User).filter(User.email == email).first()
        if not user:
            raise HTTPException(status_code=403, detail="Account not linked. Access denied.")
            
        return {"user_id": user.id, "username": user.email, "role": user.role}
    except jwt.PyJWTError:
        pass

    try:
        # Try ChequeScanner local token
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=401, detail="Invalid token payload")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Could not validate credentials")
    
    user = db.query(User).filter(User.email == username).first()
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
        
    return {"user_id": user.id, "username": user.email, "role": user.role}
