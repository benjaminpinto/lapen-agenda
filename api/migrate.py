import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from flask import jsonify
from scripts.fix_ranking_schedule_integration import main as run_migration

def handler(request):
    """One-time migration endpoint - DELETE AFTER USE"""
    try:
        import io
        import contextlib
        
        output = io.StringIO()
        with contextlib.redirect_stdout(output):
            run_migration()
        
        return jsonify({
            'success': True,
            'output': output.getvalue()
        })
    except Exception as e:
        import traceback
        return jsonify({
            'success': False,
            'error': str(e),
            'traceback': traceback.format_exc()
        }), 500
