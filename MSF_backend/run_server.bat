@echo off
set USE_POSTGRES=True
set DB_NAME=asset_db
set DB_USER=postgres
set DB_PASSWORD=5683
set DB_HOST=localhost
set DB_PORT=5432
set DJANGO_SETTINGS_MODULE=config.settings.development
cd /d "F:\MetaharaSugarFactory Asset and House\MetaharaSugarFactory Asset and House\MSF_backend"
python manage.py runserver 0.0.0.0:8000
