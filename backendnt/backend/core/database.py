from flask_sqlalchemy import SQLAlchemy
from core.config import settings

db = SQLAlchemy()

def init_db(app):
    """Initialize the database with the Flask app"""
    app.config["SQLALCHEMY_DATABASE_URI"] = settings.DATABASE_URL
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    db.init_app(app)
    
    # Import models to ensure they are registered
    from core.models import User, RefreshToken, Ticket
    
    with app.app_context():
        db.create_all()