import sqlite3
import os

DATABASE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'instance', 'app.db')

def init_db():
    if not os.path.exists(DATABASE):
        os.makedirs(os.path.dirname(DATABASE), exist_ok=True)
        conn = sqlite3.connect(DATABASE)
        with open(os.path.join(os.path.dirname(__file__), "database", "schema.sql"), "r") as f:
            conn.executescript(f.read())
        conn.close()

def get_db():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn


