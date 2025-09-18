import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from main import app

def handler(event, context):
    from serverless_wsgi import handle_request
    return handle_request(app, event, context)