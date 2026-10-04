import sys
sys.path.insert(0, '.')
from app.api.routes.weather import router
for r in router.routes:
    print('Route:', r.path, r.methods)
