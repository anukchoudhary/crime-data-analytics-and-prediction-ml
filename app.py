"""
CrimeVision AI — FastAPI Application
Provides RESTful APIs for India Property Crime Analytics, Prediction, Hotspots, Data Explorer, and Model Evaluation.
"""

from __future__ import annotations
from pathlib import Path
from typing import Optional, List
from fastapi import FastAPI, HTTPException, Query, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, StreamingResponse, JSONResponse
from pydantic import BaseModel
import io

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"

from backend.crimevision_engine import engine

app = FastAPI(
    title="CrimeVision AI API",
    description="Crime Data Analytics & Property Crime Risk Prediction Engine",
    version="2.0.0"
)

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class PredictPayload(BaseModel):
    state: str
    city: str
    zone: str
    crime_type: Optional[str] = "Theft"
    date: str
    time: str
    time_window: Optional[str] = None

class ComparePayload(BaseModel):
    zones: List[str]

@app.get("/api/health")
def get_health():
    return {
        "status": "online",
        "service": "CrimeVision AI Engine",
        "system_status": "🟢 ML System Online",
        "demo_mode": True,
        "dataset_label": "Demo Dataset — For Educational Demonstration",
        "total_records": len(engine.df),
        "model_loaded": engine.model is not None
    }

@app.get("/api/dashboard-summary")
def get_dashboard_summary(
    state: Optional[str] = Query(None),
    city: Optional[str] = Query(None),
    zone: Optional[str] = Query(None),
    crime_type: Optional[str] = Query(None),
    year: Optional[int] = Query(None),
    day: Optional[str] = Query(None),
    time_window: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None)
):
    filters = {
        "state": state, "city": city, "zone": zone, "crime_type": crime_type,
        "year": year, "day": day, "time_window": time_window,
        "start_date": start_date, "end_date": end_date
    }
    return engine.get_dashboard_summary(filters)

@app.get("/api/analytics")
def get_analytics(
    state: Optional[str] = Query(None),
    city: Optional[str] = Query(None),
    zone: Optional[str] = Query(None),
    crime_type: Optional[str] = Query(None),
    year: Optional[int] = Query(None),
    day: Optional[str] = Query(None),
    time_window: Optional[str] = Query(None)
):
    filters = {
        "state": state, "city": city, "zone": zone, "crime_type": crime_type,
        "year": year, "day": day, "time_window": time_window
    }
    return engine.get_analytics(filters)

@app.get("/api/hotspots")
def get_hotspots(
    state: Optional[str] = Query(None),
    city: Optional[str] = Query(None),
    crime_type: Optional[str] = Query(None),
    year: Optional[int] = Query(None)
):
    filters = {"state": state, "city": city, "crime_type": crime_type, "year": year}
    return engine.get_hotspots(filters)

@app.get("/api/trends")
def get_trends(
    state: Optional[str] = Query(None),
    city: Optional[str] = Query(None),
    zone: Optional[str] = Query(None),
    crime_type: Optional[str] = Query(None)
):
    filters = {"state": state, "city": city, "zone": zone, "crime_type": crime_type}
    return engine.get_trends(filters)

@app.get("/api/crimes")
def get_crimes(
    search: Optional[str] = Query(None),
    sort_by: str = Query("Date"),
    sort_order: str = Query("desc"),
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=5, le=100),
    state: Optional[str] = Query(None),
    city: Optional[str] = Query(None),
    zone: Optional[str] = Query(None),
    crime_type: Optional[str] = Query(None),
    year: Optional[int] = Query(None)
):
    filters = {"state": state, "city": city, "zone": zone, "crime_type": crime_type, "year": year}
    return engine.get_crimes_table(search=search, sort_by=sort_by, sort_order=sort_order, page=page, limit=limit, filters=filters)

@app.get("/api/crimes/export")
def export_crimes_csv(
    state: Optional[str] = Query(None),
    city: Optional[str] = Query(None),
    crime_type: Optional[str] = Query(None),
    year: Optional[int] = Query(None)
):
    filters = {"state": state, "city": city, "crime_type": crime_type, "year": year}
    df = engine.filter_df(**filters)
    stream = io.StringIO()
    df.to_csv(stream, index=False)
    response = StreamingResponse(iter([stream.getvalue()]), media_type="text/csv")
    response.headers["Content-Disposition"] = "attachment; filename=crimevision_export.csv"
    return response

@app.post("/api/predict")
def predict_risk(payload: PredictPayload):
    try:
        return engine.predict_risk(
            state=payload.state,
            city=payload.city,
            zone=payload.zone,
            crime_type=payload.crime_type,
            date_str=payload.date,
            time_str=payload.time,
            time_window=payload.time_window
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/compare")
def compare_zones(payload: ComparePayload):
    return engine.compare_zones(payload.zones)

@app.get("/api/zones")
def get_zones_summary():
    return list(engine.zone_profiles.values())

@app.get("/api/clusters")
def get_clusters():
    return engine.clusters

@app.get("/api/model-performance")
def get_model_performance():
    return engine.metrics

@app.post("/api/upload")
async def upload_dataset(
    file: UploadFile = File(...),
    apply: bool = Query(False)
):
    content = await file.read()
    res = engine.handle_upload(content, file.filename, apply_to_platform=apply)
    status_code = 200 if res.get("success") else 400
    return JSONResponse(status_code=status_code, content=res)

@app.get("/api/sample-template")
def get_sample_template():
    sample_csv = (
        "Crime_ID,Date,Time,State,City,Location,Zone,Crime_Type,Latitude,Longitude\n"
        "CV-SAMPLE-001,2024-06-15,21:30,Maharashtra,Mumbai,Colaba Market,Zone 1 - South Hub,Theft,18.9220,72.8347\n"
        "CV-SAMPLE-002,2024-06-15,23:45,Delhi NCT,New Delhi,Connaught Circle,Zone 1 - Connaught Hub,Vehicle Theft,28.6315,77.2167\n"
        "CV-SAMPLE-003,2024-06-16,03:15,Karnataka,Bengaluru,Electronic City Gate 1,Zone 1 - Tech Corridor,Burglary,12.8452,77.6602\n"
        "CV-SAMPLE-004,2024-06-16,14:20,Uttar Pradesh,Ghaziabad,Raj Nagar Market,Zone 4 - High-Risk Area,Theft,28.7100,77.4400\n"
        "CV-SAMPLE-005,2024-06-17,20:00,Maharashtra,Pune,Hinjawadi Phase 1,Zone 1 - IT City,Vehicle Theft,18.5913,73.7389\n"
    )
    response = StreamingResponse(iter([sample_csv]), media_type="text/csv")
    response.headers["Content-Disposition"] = "attachment; filename=crimevision_template.csv"
    return response

@app.post("/api/dataset/reset")
def reset_dataset(target: str = Query("default")):
    res = engine.reset_dataset(target=target)
    status_code = 200 if res.get("success") else 400
    return JSONResponse(status_code=status_code, content=res)

@app.get("/api/dataset/status")
def get_dataset_status():
    status = engine.get_dataset_status()
    return JSONResponse(content=status)

@app.get("/api/dataset/download-original")
def download_original_dataset():
    orig_path = BASE_DIR / "data" / "original_design_dataset.csv"
    if not orig_path.exists():
        orig_path = BASE_DIR / "data" / "india_property_crime.csv"
    return FileResponse(
        str(orig_path),
        media_type="text/csv",
        filename="crimevision_original_dataset_5200.csv"
    )

# Static Web Application Serving
if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

    @app.get("/")
    def serve_index():
        return FileResponse(str(STATIC_DIR / "index.html"))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="127.0.0.1", port=8000, reload=True)
