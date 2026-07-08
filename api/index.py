import sys
import os

# Ensure the root directory of the micro-app is in the Python path
root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if root_dir not in sys.path:
    sys.path.append(root_dir)

# Vercel requires the FastAPI instance to be named `app`
from server.main import app
