import sys
import os

# Add current directory to path just like uvicorn would (implicitly)
sys.path.insert(0, os.getcwd())

try:
    import app
    import app.main
    print(f"App patht: {app.__file__}")
    print(f"Main path: {app.main.__file__}")
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()

import app.routes.chat
print(f"Chat route path: {app.routes.chat.__file__}")
