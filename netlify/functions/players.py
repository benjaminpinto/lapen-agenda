import json
import sqlite3

def handler(event, context):
    try:
        # Simple in-memory database for demo
        conn = sqlite3.connect(':memory:')
        conn.execute('''CREATE TABLE players (name TEXT)''')
        conn.execute("INSERT INTO players (name) VALUES ('João Silva')")
        conn.execute("INSERT INTO players (name) VALUES ('Maria Santos')")
        conn.execute("INSERT INTO players (name) VALUES ('Pedro Costa')")
        
        players = conn.execute('SELECT name FROM players ORDER BY name').fetchall()
        result = [p[0] for p in players]
        
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