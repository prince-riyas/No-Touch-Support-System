from datetime import datetime
from core.database import db
from werkzeug.security import generate_password_hash, check_password_hash
import uuid

class User(db.Model):
    __tablename__ = "users"
    
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    refresh_tokens = db.relationship("RefreshToken", backref="user", lazy=True, cascade="all, delete-orphan")
    tickets = db.relationship("Ticket", backref="user", lazy=True, cascade="all, delete-orphan")
    
    def set_password(self, password):
        self.password_hash = generate_password_hash(password)
    
    def check_password(self, password):
        return check_password_hash(self.password_hash, password)
    
    def __repr__(self):
        return f"<User {self.email}>"

class RefreshToken(db.Model):
    __tablename__ = "refresh_tokens"
    
    id = db.Column(db.Integer, primary_key=True)
    token = db.Column(db.String(36), unique=True, nullable=False)  # UUID string
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    expires_at = db.Column(db.DateTime, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    is_revoked = db.Column(db.Boolean, default=False)
    
    def __repr__(self):
        return f"<RefreshToken user_id={self.user_id}>"

class Ticket(db.Model):
    __tablename__ = "tickets"
    
    id = db.Column(db.Integer, primary_key=True)
    sys_id = db.Column(db.String(50), unique=True, nullable=False)  
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)  
    email = db.Column(db.String(120), nullable=False)
    description = db.Column(db.Text, nullable=False)
    status = db.Column(db.String(50), default="new")
    priority = db.Column(db.String(50), nullable=True)  
    classified_team = db.Column(db.String(100), nullable=True)  
    feedback = db.Column(db.Text, nullable=True)  
    l2_is_new = db.Column(db.Boolean, nullable=True)
    l2_resolution = db.Column(db.Text, nullable=True)
    l3_is_dev = db.Column(db.Boolean, nullable=True)
    l3_resolution = db.Column(db.Text, nullable=True)
    l4_status = db.Column(db.String(100), nullable=True)
    source = db.Column(db.String(50), nullable=True)  # servicenow or jira
    rca = db.Column(db.Text, nullable=True)  # Root Cause Analysis
    pm = db.Column(db.Text, nullable=True)   # Preventive Measures
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def __repr__(self):
        return f"<Ticket sys_id={self.sys_id}>"