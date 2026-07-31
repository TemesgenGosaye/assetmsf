import os
import sys

# Add the project root directory to the python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config.wsgi import application

# Vercel Serverless Function entry point
app = application
