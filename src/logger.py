import logging
import os
from datetime import datetime

def setup_logger():
    """Setup application logger with file and console handlers"""
    logger = logging.getLogger('lapen_agenda')
    
    if logger.handlers:
        return logger
    
    logger.setLevel(logging.INFO)
    
    # Console handler (always available)
    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.INFO)
    
    # Formatter
    formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    console_handler.setFormatter(formatter)
    
    logger.addHandler(console_handler)
    
    # File handler (only if writable filesystem)
    try:
        os.makedirs('logs', exist_ok=True)
        file_handler = logging.FileHandler(f'logs/app_{datetime.now().strftime("%Y%m%d")}.log')
        file_handler.setLevel(logging.INFO)
        file_handler.setFormatter(formatter)
        logger.addHandler(file_handler)
    except OSError:
        # Read-only filesystem (like Vercel), skip file logging
        pass
    
    return logger

def get_logger():
    """Get the application logger"""
    return logging.getLogger('lapen_agenda')