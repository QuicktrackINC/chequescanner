import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Enum, Date
from sqlalchemy.orm import relationship, declarative_base

from .security import encrypt_data, decrypt_data # Optional, abstracting property setters

Base = declarative_base()

class CheckStatus(enum.Enum):
    PENDING = "PENDING"
    EXTRACTED = "EXTRACTED"
    MANUAL_REVIEW = "MANUAL_REVIEW"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"

class CheckBatch(Base):
    __tablename__ = "check_batches"
    
    id = Column(Integer, primary_key=True, index=True)
    created_by = Column(String, index=True) # Per PRD 3
    created_at = Column(DateTime, default=datetime.utcnow) # Per PRD 3
    status = Column(Enum(CheckStatus), default=CheckStatus.PENDING) # Per PRD 3
    
    # NEW: Robust processing fields
    original_pdf_path = Column(String, nullable=True)
    parameters_json = Column(String, nullable=True) # JSON of table_pages, etc
    
    # Cascading delete so cleaning batches removes all checks inside
    checks = relationship("Check", back_populates="batch", cascade="all, delete-orphan")

class Check(Base):
    __tablename__ = "checks"
    
    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("check_batches.id"), nullable=False)
    
    store_name = Column(String, index=True)
    check_number = Column(String, index=True)
    check_date = Column(Date, nullable=True) # Per PRD 3 rename
    payee = Column(String)
    amount = Column(Float, nullable=True)
    memo = Column(String)
    bank = Column(String) # Per PRD 3 rename
    
    _routing_number = Column("routing_number", String, nullable=True)
    _account_number = Column("account_number", String, nullable=True)
    
    @property
    def routing_number(self):
        return decrypt_data(self._routing_number) if self._routing_number else None

    @routing_number.setter
    def routing_number(self, value):
        self._routing_number = encrypt_data(value) if value else None

    @property
    def account_number(self):
        return decrypt_data(self._account_number) if self._account_number else None

    @account_number.setter
    def account_number(self, value):
        self._account_number = encrypt_data(value) if value else None
    
    confidence_score = Column(Float, nullable=True) # Per PRD 3
    
    status = Column(Enum(CheckStatus), default=CheckStatus.PENDING)
    validation_notes = Column(String, nullable=True) 
    s3_image_url = Column(String, nullable=True)
    
    reviewed_by = Column(String, nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    batch = relationship("CheckBatch", back_populates="checks")
    audit_logs = relationship("AuditLog", back_populates="check", cascade="all, delete-orphan")

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    check_id = Column(Integer, ForeignKey("checks.id", ondelete="CASCADE"), nullable=False)
    user = Column(String, nullable=False)
    action = Column(String, nullable=False) # e.g., "UPDATED", "APPROVED"
    changes = Column(String, nullable=True) # JSON string of changes
    created_at = Column(DateTime, default=datetime.utcnow)

    check = relationship("Check", back_populates="audit_logs")

class User(Base):
    __tablename__ = "User"

    id = Column(String, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    emailVerified = Column(DateTime, nullable=True)
    name = Column(String, nullable=True)
    passwordHash = Column(String, nullable=True)
    role = Column(String, default="STAFF", nullable=False) # "ADMIN" or "STAFF"
    createdAt = Column(DateTime, default=datetime.utcnow)
    updatedAt = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
