@echo off
title CrimeVision AI - Crime Data Analytics & Property Crime Risk Prediction
echo =====================================================================
echo Starting CrimeVision AI Web Platform...
echo Predict Crime Risk. Understand Patterns. Plan Smarter.
echo =====================================================================
echo.
python -m uvicorn app:app --host 127.0.0.1 --port 8000 --reload
pause
