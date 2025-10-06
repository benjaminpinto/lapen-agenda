import os
import sys
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# DON\'T CHANGE THIS !!!
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from flask import Flask, send_from_directory
from flask_cors import CORS
from src.routes.admin import admin_bp
from src.routes.public import public_bp
from src.routes.auth import auth_bp
from src.database import init_db
from src.email_service import init_mail

app = Flask(__name__, static_folder=os.path.join(os.path.dirname(__file__), 'src', 'static'))
app.config['SECRET_KEY'] = 'asdf#FGSgvasgf$5$WGT'
app.config['SESSION_COOKIE_SAMESITE'] = 'None'
app.config['SESSION_COOKIE_SECURE'] = False

# Enable CORS for all routes with credentials support
CORS(app, supports_credentials=True, origins=['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:5001', 'http://127.0.0.1:5001'])

# Initialize the database
with app.app_context():
    init_db()

# Initialize email service
init_mail(app)

# Register blueprints
app.register_blueprint(admin_bp)
app.register_blueprint(public_bp)
app.register_blueprint(auth_bp)

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    static_folder_path = app.static_folder
    if static_folder_path is None:
            return "Static folder not configured", 404

    if path.startswith("api/"):
        return "Not Found", 404 # API routes are handled by blueprints
    elif path != "" and os.path.exists(os.path.join(static_folder_path, path)):
        return send_from_directory(static_folder_path, path)
    else:
        index_path = os.path.join(static_folder_path, 'index.html')
        if os.path.exists(index_path):
            return send_from_directory(static_folder_path, 'index.html')
        else:
            return "index.html not found", 404


# Export app for Vercel
app = app

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=True)


