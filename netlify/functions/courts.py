import json
import sqlite3
import os

def handler(event, context):
    try:
        # Simple in-memory database for demo
        conn = sqlite3.connect(':memory:')
        conn.execute('''CREATE TABLE courts (id INTEGER PRIMARY KEY, name TEXT, type TEXT, active INTEGER)''')
        conn.execute("INSERT INTO courts (name, type, active) VALUES ('Quadra 1', 'clay', 1)")
        conn.execute("INSERT INTO courts (name, type, active) VALUES ('Quadra 2', 'hard', 1)")
        
        courts = conn.execute('SELECT * FROM courts WHERE active = 1').fetchall()
        result = [{'id': c[0], 'name': c[1], 'type': c[2], 'active': c[3]} for c in courts]
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps(result)
        }
    except Exception as e:
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        }