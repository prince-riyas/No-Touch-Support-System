from flask import Flask
from flask_cors import CORS
from flask_socketio import SocketIO
from api.auth_api import auth_api
from api.incidents_api import incident_api, init_socketio
from core.database import init_db
from core.config import settings

def create_app():
    app = Flask(__name__)
    CORS(app, resources={r"/*": {"origins": ["http://localhost:5173", "*"]}})  
    
    app.config["SECRET_KEY"] = settings.JWT_SECRET_KEY
    app.config["SQLALCHEMY_DATABASE_URI"] = settings.DATABASE_URL
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    
    init_db(app)
    
    app.register_blueprint(auth_api)
    app.register_blueprint(incident_api)
    
    return app

app = create_app()
socketio = SocketIO(app, async_mode='eventlet', cors_allowed_origins=["http://localhost:5173", "*"])

init_socketio(socketio)

if __name__ == "__main__":
    # logger.info("Starting the Flask server with eventlet...")
    socketio.run(app, host="0.0.0.0", port=8083, debug=True)