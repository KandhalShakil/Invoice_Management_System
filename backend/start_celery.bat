@echo off
echo Starting Celery Worker for Invoice Management System...
call .venv\Scripts\activate
python -m celery -A config worker -l info -P solo
pause
