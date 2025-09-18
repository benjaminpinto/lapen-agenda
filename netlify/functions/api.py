import json
import sys
import os

# Add project root to path
project_root = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
sys.path.insert(0, project_root)

try:
    from main import app
    from serverless_wsgi import handle_request
except ImportError as e:
    print(f"Import error: {e}")
    app = None

def handler(event, context):
    if app is None:
        return {
            'statusCode': 500,
            'body': json.dumps({'error': 'Failed to import Flask app'})
        }
    
    try:
        return handle_request(app, event, context)
    except Exception as e:
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        }