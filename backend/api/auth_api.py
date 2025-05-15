from flask import Blueprint, request, jsonify
import jwt
from datetime import datetime, timedelta
from functools import wraps
from uuid import uuid4
from core.config import settings
from core.database import db
from core.models import User, RefreshToken
from utils.logger import logger

auth_api = Blueprint("auth_api", __name__)

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get("Authorization")
        if not token:
            return jsonify({"error": "Token is missing"}), 401
        try:
            token = token.split(" ")[1]  
            data = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
            request.email = data["email"]
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Token has expired"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"error": "Invalid token"}), 401
        return f(*args, **kwargs)
    return decorated

@auth_api.route("/auth/register", methods=["POST"])
def register():
    """Register a new user"""
    try:
        data = request.get_json()
        email = data.get("email")
        password = data.get("password")
        if not email or not password:
            return jsonify({"error": "Email and password are required"}), 400
        
        if User.query.filter_by(email=email).first():
            return jsonify({"error": "User already exists"}), 400
        
        user = User(email=email)
        user.set_password(password)
        db.session.add(user)
        db.session.commit()
        return jsonify({"message": "User registered successfully"}), 201
    except Exception as e:
        logger.error(f"Error in register: {str(e)}")
        db.session.rollback()
        return jsonify({"error": "Registration failed"}), 500

@auth_api.route("/auth/login", methods=["POST"])
def login():
    """Log in a user and return access and refresh tokens"""
    try:
        data = request.get_json()
        email = data.get("email")
        password = data.get("password")
        user = User.query.filter_by(email=email).first()
        
        if not user or not user.check_password(password):
            return jsonify({"error": "Invalid credentials"}), 401
        
        # Generate tokens
        access_token = jwt.encode(
            {
                "email": email,
                "exp": datetime.utcnow() + timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES)
            },
            settings.JWT_SECRET_KEY,
            algorithm=settings.JWT_ALGORITHM
        )
        refresh_token = str(uuid4())
        
        # Store refresh token
        refresh_token_entry = RefreshToken(
            token=refresh_token,
            user_id=user.id,
            expires_at=datetime.utcnow() + timedelta(days=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS)
        )
        db.session.add(refresh_token_entry)
        db.session.commit()
        
        return jsonify({
            "access_token": access_token,
            "refresh_token": refresh_token
        }), 200
    except Exception as e:
        logger.error(f"Error in login: {str(e)}")
        db.session.rollback()
        return jsonify({"error": "Login failed"}), 500

@auth_api.route("/auth/refresh", methods=["POST"])
def refresh():
    """Refresh access token using refresh token"""
    try:
        data = request.get_json()
        refresh_token = data.get("refresh_token")
        if not refresh_token:
            return jsonify({"error": "Refresh token is required"}), 400
        
        token_record = RefreshToken.query.filter_by(token=refresh_token, is_revoked=False).first()
        if not token_record or token_record.expires_at < datetime.utcnow():
            return jsonify({"error": "Invalid or expired refresh token"}), 401
        
        user = User.query.get(token_record.user_id)
        if not user:
            return jsonify({"error": "User not found"}), 404
        
        # Generate new access token
        access_token = jwt.encode(
            {
                "email": user.email,
                "exp": datetime.utcnow() + timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES)
            },
            settings.JWT_SECRET_KEY,
            algorithm=settings.JWT_ALGORITHM
        )
        
        return jsonify({"access_token": access_token}), 200
    except Exception as e:
        logger.error(f"Error in refresh: {str(e)}")
        return jsonify({"error": "Token refresh failed"}), 500

@auth_api.route("/auth/logout", methods=["POST"])
@token_required
def logout():
    """Log out a user by revoking the refresh token"""
    try:
        data = request.get_json()
        refresh_token = data.get("refresh_token")
        token_record = RefreshToken.query.filter_by(token=refresh_token).first()
        
        if token_record:
            token_record.is_revoked = True
            db.session.commit()
        
        return jsonify({"message": "Logged out successfully"}), 200
    except Exception as e:
        logger.error(f"Error in logout: {str(e)}")
        db.session.rollback()
        return jsonify({"error": "Logout failed"}), 500