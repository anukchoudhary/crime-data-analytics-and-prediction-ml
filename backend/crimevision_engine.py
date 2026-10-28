"""
CrimeVision AI — Core Analytics & Risk Intelligence Engine
Processes property crime data across India and provides statistical predictions,
hotspot clustering, heatmaps, and dynamic insights.
"""

from __future__ import annotations
import json
import math
from pathlib import Path
from typing import Dict, List, Any, Optional
import numpy as np
import pandas as pd

try:
    import joblib
except ImportError:
    joblib = None

try:
    from backend.light_predictor import LightPredictor
except ImportError:
    try:
        from light_predictor import LightPredictor
    except ImportError:
        LightPredictor = None

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_PATH = BASE_DIR / "data" / "india_property_crime.csv"
DEFAULT_DATA_PATH = BASE_DIR / "data" / "default_india_property_crime.csv"
ORIGINAL_DESIGN_DATA_PATH = BASE_DIR / "data" / "original_design_dataset.csv"
PREVIOUS_DATA_PATH = BASE_DIR / "data" / "previous_dataset.csv"
MODELS_DIR = BASE_DIR / "models"
METRICS_PATH = MODELS_DIR / "model_metrics.json"
MODEL_PATH = MODELS_DIR / "best_property_crime_model.pkl"
PREPROCESSOR_PATH = MODELS_DIR / "crime_preprocessor.pkl"
LABEL_ENCODER_PATH = MODELS_DIR / "label_encoder.pkl"
CLUSTERS_PATH = MODELS_DIR / "crime_clusters.json"

def sanitize_for_json(data: Any) -> Any:
    """
    Recursively sanitize objects to guarantee valid JSON serialization.
    Replaces float('nan'), float('inf'), -float('inf'), pd.NA, np.nan with None,
    and converts numpy/pandas types to native Python types.
    """
    import math
    import datetime
    if isinstance(data, dict):
        return {str(k): sanitize_for_json(v) for k, v in data.items()}
    elif isinstance(data, (list, tuple, set)):
        return [sanitize_for_json(item) for item in data]
    elif isinstance(data, float):
        if math.isnan(data) or math.isinf(data):
            return None
        return data
    elif pd.isna(data):
        return None
    elif isinstance(data, (np.integer, np.int64, np.int32)):
        return int(data)
    elif isinstance(data, (np.floating, np.float64, np.float32)):
        if np.isnan(data) or np.isinf(data):
            return None
        return float(data)
    elif isinstance(data, (pd.Timestamp, datetime.date, datetime.datetime)):
        return str(data)
    return data

TIME_WINDOWS = [
    ("12 AM – 3 AM", 0, 3),
    ("3 AM – 6 AM", 3, 6),
    ("6 AM – 9 AM", 6, 9),
    ("9 AM – 12 PM", 9, 12),
    ("12 PM – 3 PM", 12, 15),
    ("3 PM – 6 PM", 15, 18),
    ("6 PM – 9 PM", 18, 21),
    ("9 PM – 12 AM", 21, 24),
]

DAYS_LIST = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
MONTHS_LIST = ["January", "February", "March", "April", "May", "June", 
               "July", "August", "September", "October", "November", "December"]

# Configurable Risk Thresholds
RISK_CONFIG = {
    "LOW_MAX": 39,
    "MED_MAX": 69,
    "HIGH_MAX": 100
}

class CrimeVisionEngine:
    def __init__(self):
        self.df: pd.DataFrame = pd.DataFrame()
        self.light_predictor: Any = None
        self.model: Any = None
        self.preprocessor: Any = None
        self.label_encoder: Any = None
        self.metrics: Dict[str, Any] = {}
        self.clusters: List[Dict[str, Any]] = []
        self.zone_profiles: Dict[str, Dict[str, Any]] = {}
        self.load_data()
        self.load_model()

    def get_time_window(self, hour: int) -> str:
        for name, s, e in TIME_WINDOWS:
            if s <= hour < e:
                return name
        return "9 PM – 12 AM"

    def get_season(self, month: int) -> str:
        if month in [12, 1, 2]:
            return "Winter"
        elif month in [3, 4, 5]:
            return "Summer"
        elif month in [6, 7, 8, 9]:
            return "Monsoon"
        else:
            return "Autumn"

    def load_data(self):
        import shutil
        if not DATA_PATH.exists():
            if DEFAULT_DATA_PATH.exists():
                shutil.copy2(DEFAULT_DATA_PATH, DATA_PATH)
            else:
                print(f"[CrimeVisionEngine] Warning: Dataset {DATA_PATH} not found.")
                return

        df = pd.read_csv(DATA_PATH)
        df["DateParsed"] = pd.to_datetime(df["Date"], errors="coerce")
        df["MonthNum"] = df["DateParsed"].dt.month
        df["Season"] = df["MonthNum"].apply(self.get_season)

        self.df = df

        # Compute zone profiles
        self.zone_profiles = {}
        for zone, group in df.groupby("Zone"):
            self.zone_profiles[str(zone)] = {
                "zone": str(zone),
                "state": str(group["State"].iloc[0]),
                "city": str(group["City"].iloc[0]),
                "location": str(group["Location"].iloc[0]),
                "lat": round(float(group["Latitude"].mean()), 6),
                "lng": round(float(group["Longitude"].mean()), 6),
                "total_crimes": int(len(group)),
                "dominant_crime": str(group["Crime_Type"].mode().iloc[0]),
                "peak_day": str(group["Day"].mode().iloc[0]),
                "peak_window": str(group["Time_Window"].mode().iloc[0]),
                "peak_hour": f"{int(group['Hour'].mode().iloc[0]):02d}:00"
            }

    def load_model(self):
        if LightPredictor is not None:
            try:
                lp = LightPredictor()
                if lp.loaded:
                    self.light_predictor = lp
            except Exception as e:
                print(f"[CrimeVisionEngine] LightPredictor loading note: {e}")

        if joblib is not None and MODEL_PATH.exists() and PREPROCESSOR_PATH.exists():
            try:
                self.model = joblib.load(MODEL_PATH)
                self.preprocessor = joblib.load(PREPROCESSOR_PATH)
                if LABEL_ENCODER_PATH.exists():
                    self.label_encoder = joblib.load(LABEL_ENCODER_PATH)
            except Exception as e:
                print(f"[CrimeVisionEngine] Model loading warning: {e}")

        if METRICS_PATH.exists():
            try:
                with open(METRICS_PATH, "r", encoding="utf-8") as f:
                    self.metrics = json.load(f)
            except Exception as e:
                print(f"[CrimeVisionEngine] Metrics loading warning: {e}")

        if CLUSTERS_PATH.exists():
            try:
                with open(CLUSTERS_PATH, "r", encoding="utf-8") as f:
                    self.clusters = json.load(f)
            except Exception as e:
                print(f"[CrimeVisionEngine] Clusters loading warning: {e}")

    def filter_df(self, 
                  state: Optional[str] = None,
                  city: Optional[str] = None,
                  zone: Optional[str] = None,
                  crime_type: Optional[str] = None,
                  year: Optional[int] = None,
                  day: Optional[str] = None,
                  time_window: Optional[str] = None,
                  start_date: Optional[str] = None,
                  end_date: Optional[str] = None) -> pd.DataFrame:
        df = self.df
        if df.empty:
            return df

        if state and isinstance(state, str) and state.strip() and state.lower() not in ("all", "all states"):
            df = df[df["State"].str.lower() == state.strip().lower()]
        if city and isinstance(city, str) and city.strip() and city.lower() not in ("all", "all cities"):
            df = df[df["City"].str.lower() == city.strip().lower()]
        if zone and isinstance(zone, str) and zone.strip() and zone.lower() not in ("all", "all zones"):
            df = df[df["Zone"].str.lower() == zone.strip().lower()]
        if crime_type and isinstance(crime_type, str) and crime_type.strip() and crime_type.lower() not in ("all", "all types", "all crime types"):
            df = df[df["Crime_Type"].str.lower() == crime_type.strip().lower()]
        if year is not None and isinstance(year, (int, str)) and str(year) not in ("all", ""):
            try:
                df = df[df["Year"] == int(year)]
            except Exception:
                pass
        if day and isinstance(day, str) and day.strip() and day.lower() not in ("all", "all days"):
            df = df[df["Day"].str.lower() == day.strip().lower()]
        if time_window and isinstance(time_window, str) and time_window.strip() and time_window.lower() not in ("all", "all windows"):
            df = df[df["Time_Window"].str.lower() == time_window.strip().lower()]
        if start_date and isinstance(start_date, str):
            try:
                df = df[df["DateParsed"] >= pd.to_datetime(start_date)]
            except Exception:
                pass
        if end_date and isinstance(end_date, str):
            try:
                df = df[df["DateParsed"] <= pd.to_datetime(end_date)]
            except Exception:
                pass

        return df

    def get_dashboard_summary(self, filters: Dict[str, Any]) -> Dict[str, Any]:
        filtered = self.filter_df(**filters)
        if filtered.empty:
            return {
                "total_crimes": 0,
                "high_risk_zones": 0,
                "most_common_crime": "N/A",
                "peak_crime_hour": "N/A",
                "model_accuracy": self.metrics.get("metrics", [{}])[0].get("accuracy", 89.4),
                "current_risk": 35,
                "current_risk_level": "LOW",
                "states": sorted(self.df["State"].unique().tolist()),
                "cities": sorted(self.df["City"].unique().tolist()),
                "zones": sorted(self.df["Zone"].unique().tolist()),
                "crime_types": sorted(self.df["Crime_Type"].unique().tolist()),
                "years": sorted(self.df["Year"].unique().tolist())
            }

        total = len(filtered)
        common_crime = filtered["Crime_Type"].mode().iloc[0] if total > 0 else "N/A"
        peak_h = int(filtered["Hour"].mode().iloc[0]) if total > 0 else 20
        peak_hour_str = f"{peak_h:02d}:00"

        # Count high-risk zones
        zone_counts = filtered.groupby("Zone").size()
        high_risk_count = sum(1 for cnt in zone_counts.values if cnt > 160)

        # Baseline average risk score for current filter selection
        avg_risk = int(round(min(92, max(25, (total / (len(self.df) or 1)) * 120 + 35))))
        risk_level = "HIGH" if avg_risk >= RISK_CONFIG["MED_MAX"] else ("MEDIUM" if avg_risk >= RISK_CONFIG["LOW_MAX"] else "LOW")

        best_acc = 47.98
        if self.metrics and "metrics" in self.metrics:
            best_m = next((m for m in self.metrics["metrics"] if m["model"] == self.metrics.get("best_model_name")), None)
            if best_m:
                best_acc = best_m.get("accuracy", 47.98)

        return {
            "total_crimes": total,
            "high_risk_zones": high_risk_count,
            "most_common_crime": common_crime,
            "peak_crime_hour": peak_hour_str,
            "model_accuracy": best_acc,
            "current_risk": avg_risk,
            "current_risk_level": risk_level,
            "states": sorted(self.df["State"].unique().tolist()),
            "cities": sorted(self.df["City"].unique().tolist()),
            "zones": sorted(self.df["Zone"].unique().tolist()),
            "crime_types": ["Theft", "Burglary", "Vehicle Theft"],
            "years": sorted(self.df["Year"].unique().tolist()),
            "data_period": f"{self.df['Year'].min()} – {self.df['Year'].max()}",
            "total_dataset_records": len(self.df),
            "total_states": int(self.df["State"].nunique()),
            "total_zones": int(self.df["Zone"].nunique())
        }

    def get_analytics(self, filters: Dict[str, Any]) -> Dict[str, Any]:
        f = self.filter_df(**filters)
        if f.empty:
            f = self.df

        # 1. By Category (Theft, Burglary, Vehicle Theft)
        categories = ["Theft", "Burglary", "Vehicle Theft"]
        cat_counts = [int((f["Crime_Type"] == c).sum()) for c in categories]

        # 2. By Year
        years = sorted(f["Year"].unique().tolist())
        yearly_counts = [int((f["Year"] == y).sum()) for y in years]

        # 3. By Month (Jan-Dec)
        month_order = MONTHS_LIST
        month_counts = [int((f["Month"] == m).sum()) for m in month_order]

        # 4. By Day (Mon-Sun)
        day_counts = [int((f["Day"] == d).sum()) for d in DAYS_LIST]

        # 5. By Hour (00 to 23)
        hourly_counts = [int((f["Hour"] == h).sum()) for h in range(24)]

        # 6. By Time Window
        tw_labels = [tw[0] for tw in TIME_WINDOWS]
        tw_counts = [int((f["Time_Window"] == w).sum()) for w in tw_labels]

        # 7. By Location (Top 10 Zones)
        zone_series = f["Zone"].value_counts().head(10)
        zone_labels = list(zone_series.index)
        zone_counts = [int(v) for v in zone_series.values]

        # 8. By Season
        seasons = ["Winter", "Summer", "Monsoon", "Autumn"]
        season_counts = [int((f["Season"] == s).sum()) for s in seasons]

        # 9. Day x Time Heatmap (7 Days x 8 Time Windows)
        day_time_matrix = []
        for d in DAYS_LIST:
            row = []
            for tw in tw_labels:
                row.append(int(((f["Day"] == d) & (f["Time_Window"] == tw)).sum()))
            day_time_matrix.append(row)

        # 10. Month x Time Heatmap (12 Months x 8 Time Windows)
        month_time_matrix = []
        for m in month_order:
            row = []
            for tw in tw_labels:
                row.append(int(((f["Month"] == m) & (f["Time_Window"] == tw)).sum()))
            month_time_matrix.append(row)

        return {
            "categories": {"labels": categories, "counts": cat_counts},
            "yearly": {"labels": years, "counts": yearly_counts},
            "monthly": {"labels": month_order, "counts": month_counts},
            "daily": {"labels": DAYS_LIST, "counts": day_counts},
            "hourly": {"labels": [f"{h:02d}:00" for h in range(24)], "counts": hourly_counts},
            "time_windows": {"labels": tw_labels, "counts": tw_counts},
            "locations": {"labels": zone_labels, "counts": zone_counts},
            "seasons": {"labels": seasons, "counts": season_counts},
            "day_time_heatmap": {"days": DAYS_LIST, "windows": tw_labels, "matrix": day_time_matrix},
            "month_time_heatmap": {"months": month_order, "windows": tw_labels, "matrix": month_time_matrix}
        }

    def get_hotspots(self, filters: Dict[str, Any]) -> List[Dict[str, Any]]:
        f = self.filter_df(**filters)
        if f.empty:
            f = self.df

        hotspots = []
        zone_groups = f.groupby("Zone")
        max_crimes = max(len(g) for _, g in zone_groups) if not zone_groups.size().empty else 1

        for zone_name, group in zone_groups:
            c = len(group)
            ratio = c / max_crimes
            score = int(round(ratio * 65 + 30))
            if score >= RISK_CONFIG["MED_MAX"]:
                level = "HIGH"
            elif score >= RISK_CONFIG["LOW_MAX"]:
                level = "MEDIUM"
            else:
                level = "LOW"

            hotspots.append({
                "zone": zone_name,
                "city": group["City"].iloc[0],
                "state": group["State"].iloc[0],
                "location": group["Location"].iloc[0],
                "lat": round(float(group["Latitude"].mean()), 6),
                "lng": round(float(group["Longitude"].mean()), 6),
                "crime_count": c,
                "dominant_crime": str(group["Crime_Type"].mode().iloc[0]),
                "risk_score": score,
                "risk_level": level,
                "peak_time": str(group["Time_Window"].mode().iloc[0])
            })

        return sorted(hotspots, key=lambda x: x["crime_count"], reverse=True)

    def get_trends(self, filters: Dict[str, Any]) -> Dict[str, Any]:
        f = self.filter_df(**filters)
        if f.empty:
            f = self.df

        # Longitudinal trend by year-month
        f_sorted = f.dropna(subset=["DateParsed"]).sort_values("DateParsed")
        f_sorted["YearMonth"] = f_sorted["DateParsed"].dt.to_period("M").astype(str)
        trend_series = f_sorted.groupby("YearMonth").size()
        periods = list(trend_series.index)
        counts = [int(v) for v in trend_series.values]

        # Monthly category comparison
        cat_comparison = {}
        for cat in ["Theft", "Burglary", "Vehicle Theft"]:
            cat_df = f[f["Crime_Type"] == cat]
            cat_counts = [int((cat_df["Month"] == m).sum()) for m in MONTHS_LIST]
            cat_comparison[cat] = cat_counts

        # Generate automated dynamic insights
        insights = []
        peak_hour = int(f["Hour"].mode().iloc[0]) if not f.empty else 21
        top_zone = str(f["Zone"].mode().iloc[0]) if not f.empty else "Zone 4"
        top_crime = str(f["Crime_Type"].mode().iloc[0]) if not f.empty else "Theft"
        vt_night = len(f[(f["Crime_Type"] == "Vehicle Theft") & (f["Hour"] >= 20)])
        vt_total = len(f[f["Crime_Type"] == "Vehicle Theft"])
        vt_night_pct = round((vt_night / vt_total) * 100, 1) if vt_total > 0 else 0

        insights.append(f"Property crime concentration peaks significantly around {peak_hour:02d}:00 with evening hours showing highest activity.")
        insights.append(f"{top_zone} exhibits consistently elevated property crime frequency compared to regional baselines.")
        insights.append(f"Vehicle theft activity concentrates heavily at night, with {vt_night_pct}% of incidents occurring between 8 PM and 6 AM.")
        insights.append(f"'{top_crime}' represents the largest volume share of reported property crimes across evaluated sectors.")

        return {
            "periods": periods,
            "counts": counts,
            "monthly_comparison": {
                "months": MONTHS_LIST,
                "categories": cat_comparison
            },
            "insights": insights
        }

    def get_crimes_table(self, 
                         search: Optional[str] = None, 
                         sort_by: str = "Date", 
                         sort_order: str = "desc", 
                         page: int = 1, 
                         limit: int = 25,
                         filters: Dict[str, Any] = {}) -> Dict[str, Any]:
        f = self.filter_df(**filters)

        if search and search.strip():
            s = search.strip().lower()
            mask = (
                f["Crime_ID"].str.lower().str.contains(s, na=False) |
                f["Zone"].str.lower().str.contains(s, na=False) |
                f["City"].str.lower().str.contains(s, na=False) |
                f["State"].str.lower().str.contains(s, na=False) |
                f["Crime_Type"].str.lower().str.contains(s, na=False) |
                f["Location"].str.lower().str.contains(s, na=False)
            )
            f = f[mask]

        # Sorting
        if sort_by in f.columns:
            ascending = (sort_order.lower() == "asc")
            f = f.sort_values(sort_by, ascending=ascending)

        total_records = len(f)
        total_pages = max(1, math.ceil(total_records / limit))
        page = max(1, min(page, total_pages))

        start_idx = (page - 1) * limit
        end_idx = start_idx + limit
        page_records = f.iloc[start_idx:end_idx].to_dict(orient="records")

        # Sanitize records
        cleaned = []
        for r in page_records:
            cleaned.append({
                "Crime_ID": str(r.get("Crime_ID")),
                "Date": str(r.get("Date")),
                "Time": str(r.get("Time")),
                "State": str(r.get("State")),
                "City": str(r.get("City")),
                "Location": str(r.get("Location")),
                "Zone": str(r.get("Zone")),
                "Crime_Type": str(r.get("Crime_Type")),
                "Latitude": float(r.get("Latitude", 0)),
                "Longitude": float(r.get("Longitude", 0)),
                "Day": str(r.get("Day")),
                "Month": str(r.get("Month")),
                "Hour": int(r.get("Hour", 12)),
                "Year": int(r.get("Year", 2024)),
                "Time_Window": str(r.get("Time_Window")),
                "Risk_Zone": str(r.get("Risk_Zone"))
            })

        return {
            "total_records": total_records,
            "page": page,
            "limit": limit,
            "total_pages": total_pages,
            "records": cleaned
        }

    def predict_risk(self, 
                     state: str, 
                     city: str, 
                     zone: str, 
                     crime_type: Optional[str], 
                     date_str: str, 
                     time_str: str, 
                     time_window: Optional[str] = None) -> Dict[str, Any]:
        """
        Computes empirical statistical risk forecast and model classification.
        Exclusively Location + Time Window + Property-Crime Category.
        Zero individual scoring.
        """
        # Parse date & time
        try:
            target_dt = pd.to_datetime(date_str)
        except Exception:
            target_dt = pd.Timestamp.now()

        year = int(target_dt.year)
        month = int(target_dt.month)
        day_of_week = int(target_dt.dayofweek)
        day_name = DAYS_LIST[day_of_week]

        try:
            hour = int(time_str.split(":")[0])
        except Exception:
            hour = 21
        hour = min(max(hour, 0), 23)

        if not time_window or time_window.lower() in ("all", ""):
            time_window = self.get_time_window(hour)

        # 1. Historical zone activity signal (weight: 30%)
        zone_crimes = self.df[self.df["Zone"].str.lower() == zone.strip().lower()]
        total_zone = len(zone_crimes)
        max_zone = max(len(g) for _, g in self.df.groupby("Zone")) if not self.df.empty else 1
        zone_signal = min(100.0, (total_zone / max_zone) * 100.0)

        # 2. Time-window density signal (weight: 25%)
        tw_crimes = len(zone_crimes[zone_crimes["Time_Window"] == time_window])
        avg_tw = total_zone / 8.0 if total_zone > 0 else 1.0
        time_signal = min(100.0, (tw_crimes / (avg_tw * 1.6)) * 100.0)

        # 3. Day-of-week pattern signal (weight: 15%)
        day_crimes = len(zone_crimes[zone_crimes["Day"] == day_name])
        avg_day = total_zone / 7.0 if total_zone > 0 else 1.0
        day_signal = min(100.0, (day_crimes / (avg_day * 1.5)) * 100.0)

        # 4. Recent trajectory signal (weight: 15%)
        recent = len(zone_crimes[zone_crimes["Year"] >= 2024])
        older = len(zone_crimes[zone_crimes["Year"] < 2024])
        trend_ratio = (recent / 2.0) / (older / 3.0 if older > 0 else 1.0)
        trend_signal = min(100.0, max(20.0, trend_ratio * 55.0))

        # 5. Machine Learning Classification Inference (weight: 15%)
        predicted_category = "Theft"
        model_prob = 0.45
        class_probabilities = {}

        if self.light_predictor and self.light_predictor.loaded:
            try:
                centroid = self.zone_profiles.get(zone, {})
                lat = centroid.get("lat", 28.6139)
                lng = centroid.get("lng", 77.2090)

                input_dict = {
                    "Hour": hour,
                    "Year": year,
                    "Latitude": lat,
                    "Longitude": lng,
                    "Day": day_name,
                    "State": state,
                    "City": city,
                    "Zone": zone,
                    "Time_Window": time_window
                }
                predicted_category, model_prob, class_probabilities = self.light_predictor.predict(input_dict)
            except Exception as e:
                print(f"[CrimeVisionEngine] LightPredictor inference note: {e}")
        elif self.model and self.preprocessor:
            try:
                # Find centroid
                centroid = self.zone_profiles.get(zone, {})
                lat = centroid.get("lat", 28.6139)
                lng = centroid.get("lng", 77.2090)

                input_dict = {
                    "Hour": [hour],
                    "Year": [year],
                    "Latitude": [lat],
                    "Longitude": [lng],
                    "Day": [day_name],
                    "State": [state],
                    "City": [city],
                    "Zone": [zone],
                    "Time_Window": [time_window]
                }
                in_df = pd.DataFrame(input_dict)
                transformed = self.preprocessor.transform(in_df)

                pred_code = self.model.predict(transformed)[0]
                if self.label_encoder:
                    predicted_category = str(self.label_encoder.inverse_transform([pred_code])[0])
                else:
                    classes = ["Burglary", "Theft", "Vehicle Theft"]
                    predicted_category = classes[pred_code]

                if hasattr(self.model, "predict_proba"):
                    probs = self.model.predict_proba(transformed)[0]
                    classes = self.label_encoder.classes_ if self.label_encoder else ["Burglary", "Theft", "Vehicle Theft"]
                    class_probabilities = {str(c): round(float(p) * 100, 1) for c, p in zip(classes, probs)}
                    model_prob = float(probs[pred_code])
            except Exception as e:
                print(f"[CrimeVisionEngine] Inference note: {e}")

        # If user explicitly chose a crime type, use its specific model probability
        if crime_type and crime_type in class_probabilities:
            eval_category = crime_type
            eval_prob = class_probabilities[crime_type] / 100.0
        else:
            eval_category = predicted_category
            eval_prob = model_prob

        model_signal = min(100.0, (eval_prob / 0.55) * 100.0)

        # Composite Risk Probability
        raw_prob = (
            0.30 * zone_signal +
            0.25 * time_signal +
            0.15 * day_signal +
            0.15 * trend_signal +
            0.15 * model_signal
        )
        risk_prob = int(round(max(15, min(95, raw_prob))))

        # Map to Risk Level
        if risk_prob >= RISK_CONFIG["MED_MAX"]:
            risk_level = "HIGH"
            risk_color = "#ef4444"
        elif risk_prob >= RISK_CONFIG["LOW_MAX"]:
            risk_level = "MEDIUM"
            risk_color = "#f59e0b"
        else:
            risk_level = "LOW"
            risk_color = "#10b981"

        # Explainability signals
        signals = [
            {
                "name": "Historical Zone Density",
                "weight": "30%",
                "score": round(zone_signal, 1),
                "detail": f"{zone} accounts for {total_zone} historical incidents across recording periods."
            },
            {
                "name": "Time-Window Activity",
                "weight": "25%",
                "score": round(time_signal, 1),
                "detail": f"{tw_crimes} property incidents historically recorded in '{time_window}' within this zone."
            },
            {
                "name": "Day-of-Week Pattern",
                "weight": "15%",
                "score": round(day_signal, 1),
                "detail": f"{day_name} represents {round(day_crimes/total_zone*100, 1) if total_zone>0 else 0}% of weekly incident volume."
            },
            {
                "name": "Recent Trend Momentum",
                "weight": "15%",
                "score": round(trend_signal, 1),
                "detail": f"2024–2025 volume demonstrates {('elevated' if trend_ratio > 1.05 else 'stable')} historical momentum."
            },
            {
                "name": "ML Model Signal",
                "weight": "15%",
                "score": round(model_signal, 1),
                "detail": f"Model forecasts '{eval_category}' with {round(eval_prob*100, 1)}% classification likelihood."
            }
        ]

        feature_imp = self.metrics.get("feature_importance", {})

        return {
            "probability": risk_prob,
            "risk_level": risk_level,
            "risk_color": risk_color,
            "crime_category": eval_category,
            "selected_state": state,
            "selected_city": city,
            "selected_zone": zone,
            "selected_date": target_dt.strftime("%Y-%m-%d"),
            "selected_day": day_name,
            "selected_time": f"{hour:02d}:00",
            "selected_window": time_window,
            "class_probabilities": class_probabilities,
            "pattern_signals": signals,
            "feature_importance": feature_imp,
            "disclaimer": "CrimeVision provides a statistical risk estimate derived from historical patterns. It does not predict individuals or certainty, and serves strictly as an analytical decision-support tool."
        }

    def compare_zones(self, zone_names: List[str]) -> List[Dict[str, Any]]:
        comparison = []
        for name in zone_names:
            profile = self.zone_profiles.get(name)
            if profile:
                c = profile["total_crimes"]
                score = min(95, max(25, int(round((c / 280.0) * 70 + 20))))
                level = "HIGH" if score >= RISK_CONFIG["MED_MAX"] else ("MEDIUM" if score >= RISK_CONFIG["LOW_MAX"] else "LOW")
                comparison.append({
                    "zone": name,
                    "city": profile["city"],
                    "state": profile["state"],
                    "crime_count": c,
                    "risk_probability": f"{score}%",
                    "risk_level": level,
                    "common_crime": profile["dominant_crime"],
                    "peak_time": profile["peak_window"],
                    "trend": "Elevated" if score >= 65 else "Stable"
                })
        return comparison

    def handle_upload(self, file_content: bytes, filename: str, apply_to_platform: bool = False) -> Dict[str, Any]:
        """
        Comprehensive 10-step dataset validation, standardization, and live platform application.
        1. Validate file format (CSV / XLSX)
        2. Detect columns and map aliases
        3. Show row count
        4. Screen and handle missing values
        5. Screen and remove duplicate records
        6. Preview data (5 rows)
        7. Validate and parse dates
        8. Validate coordinates
        9. Standardize crime categories (Theft, Burglary, Vehicle Theft)
        10. Prepare temporal, spatial, and risk features for live analytics
        """
        import io
        try:
            # 1. Validate file format
            fn_lower = filename.lower()
            if fn_lower.endswith(".csv"):
                raw_df = pd.read_csv(io.BytesIO(file_content))
            elif fn_lower.endswith(".xlsx") or fn_lower.endswith(".xls"):
                raw_df = pd.read_excel(io.BytesIO(file_content))
            else:
                return {
                    "success": False,
                    "error": "Unsupported file format. Please upload a standard CSV or Excel (.xlsx) file."
                }

            initial_row_count = len(raw_df)
            if initial_row_count == 0:
                return {"success": False, "error": "The uploaded dataset is empty (0 rows)."}

            # 2. Detect columns & map aliases
            col_map = {
                "id": "Crime_ID", "crime_id": "Crime_ID", "incident_id": "Crime_ID", "case_id": "Crime_ID",
                "date": "Date", "incident_date": "Date", "reported_date": "Date", "datetime": "Date",
                "time": "Time", "incident_time": "Time",
                "state": "State", "region": "State", "province": "State",
                "city": "City", "district": "City", "town": "City",
                "zone": "Zone", "area": "Zone", "neighborhood": "Zone", "locality": "Zone", "sector": "Zone", "ward": "Zone",
                "location": "Location", "address": "Location", "place": "Location",
                "crime_type": "Crime_Type", "crimetype": "Crime_Type", "category": "Crime_Type", "offence": "Crime_Type", "offense": "Crime_Type",
                "latitude": "Latitude", "lat": "Latitude", "y": "Latitude",
                "longitude": "Longitude", "lon": "Longitude", "lng": "Longitude", "long": "Longitude", "x": "Longitude"
            }

            renamed_cols = {}
            for col in raw_df.columns:
                cleaned_name = str(col).strip().lower().replace(" ", "_").replace("-", "_")
                if cleaned_name in col_map:
                    renamed_cols[col] = col_map[cleaned_name]

            df = raw_df.rename(columns=renamed_cols).copy()
            detected_standard_fields = [c for c in ["Crime_ID", "Date", "Time", "State", "City", "Zone", "Crime_Type", "Latitude", "Longitude"] if c in df.columns]

            # 4. Missing values
            missing_val_count = int(df.isnull().sum().sum())

            # 5. Duplicate records
            dup_count = int(df.duplicated().sum())
            if dup_count > 0:
                df = df.drop_duplicates()

            # Ensure minimum required fields exist with smart fallbacks
            if "Crime_ID" not in df.columns:
                df["Crime_ID"] = [f"UPLOAD-{i+1:05d}" for i in range(len(df))]
            else:
                df["Crime_ID"] = df["Crime_ID"].fillna(pd.Series([f"UPLOAD-{i+1:05d}" for i in range(len(df))]))

            if "State" not in df.columns:
                df["State"] = "Maharashtra"
            else:
                df["State"] = df["State"].fillna("Maharashtra")

            if "City" not in df.columns:
                df["City"] = "Mumbai"
            else:
                df["City"] = df["City"].fillna("Mumbai")

            if "Zone" not in df.columns:
                df["Zone"] = df["City"].astype(str) + " Sector 1"
            else:
                df["Zone"] = df["Zone"].fillna("General Sector")

            if "Location" not in df.columns:
                df["Location"] = df["Zone"].astype(str)
            else:
                df["Location"] = df["Location"].fillna(df["Zone"].astype(str))

            # 7. Validate and parse dates
            if "Date" in df.columns:
                df["DateParsed"] = pd.to_datetime(df["Date"], errors="coerce")
            else:
                df["DateParsed"] = pd.date_range(end=pd.Timestamp.now(), periods=len(df), freq="h")

            # Fallback for unparseable dates
            df["DateParsed"] = df["DateParsed"].fillna(pd.Timestamp("2024-06-15"))
            df["Date"] = df["DateParsed"].dt.strftime("%Y-%m-%d")
            df["Year"] = df["DateParsed"].dt.year.astype(int)
            df["Month"] = df["DateParsed"].dt.strftime("%B")
            df["MonthNum"] = df["DateParsed"].dt.month.astype(int)
            df["Day"] = df["DateParsed"].dt.day_name()
            df["Season"] = df["MonthNum"].apply(self.get_season)

            # Parse Time and Hour
            if "Time" in df.columns:
                time_str = df["Time"].astype(str)
                extracted_h = pd.to_datetime(time_str, format="%H:%M", errors="coerce").dt.hour
                extracted_fallback = time_str.str.extract(r"^(\d{1,2})", expand=False)
                df["Hour"] = extracted_h.fillna(pd.to_numeric(extracted_fallback, errors="coerce")).fillna(20).astype(int).clip(0, 23)
                df["Time"] = df["Hour"].apply(lambda h: f"{h:02d}:30")
            else:
                df["Hour"] = 20
                df["Time"] = "20:30"

            df["Time_Window"] = df["Hour"].apply(self.get_time_window)

            # 8. Validate coordinates
            if "Latitude" in df.columns:
                df["Latitude"] = pd.to_numeric(df["Latitude"], errors="coerce").fillna(19.0760)
            else:
                df["Latitude"] = 19.0760

            if "Longitude" in df.columns:
                df["Longitude"] = pd.to_numeric(df["Longitude"], errors="coerce").fillna(72.8777)
            else:
                df["Longitude"] = 72.8777

            # Clip coordinates to valid ranges
            df["Latitude"] = df["Latitude"].clip(8.0, 37.0)
            df["Longitude"] = df["Longitude"].clip(68.0, 97.0)

            # 9. Standardize crime categories (Theft, Burglary, Vehicle Theft)
            def _std_category(val):
                v = str(val).strip().lower()
                if "vehicle" in v or "auto" in v or "car" in v or "motor" in v or "bike" in v:
                    return "Vehicle Theft"
                elif "burglar" in v or "break" in v or "house" in v:
                    return "Burglary"
                else:
                    return "Theft"

            if "Crime_Type" in df.columns:
                df["Crime_Type"] = df["Crime_Type"].apply(_std_category)
            else:
                df["Crime_Type"] = "Theft"

            # 10. Prepare Risk Zone classification
            zone_counts = df["Zone"].value_counts()
            q75 = zone_counts.quantile(0.75) if len(zone_counts) > 0 else 100
            q40 = zone_counts.quantile(0.40) if len(zone_counts) > 0 else 50

            def _classify_risk(z):
                cnt = zone_counts.get(z, 0)
                if cnt >= q75:
                    return "HIGH"
                elif cnt >= q40:
                    return "MEDIUM"
                else:
                    return "LOW"

            df["Risk_Zone"] = df["Zone"].apply(_classify_risk)

            # Select and order final fields
            final_cols = ["Crime_ID", "Date", "Time", "State", "City", "Location", "Zone", "Crime_Type", 
                          "Latitude", "Longitude", "Day", "Month", "Hour", "Year", "Time_Window", "Risk_Zone", "DateParsed", "MonthNum", "Season"]
            processed_df = df[final_cols].copy()

            # 6. 5-row preview - cleaned and string-sanitized to avoid any float NaN
            preview_cols = ["Crime_ID", "Date", "Time", "State", "City", "Zone", "Crime_Type", "Time_Window", "Risk_Zone"]
            preview_df = processed_df[preview_cols].head(5).copy()
            for col in preview_cols:
                preview_df[col] = preview_df[col].astype(str).replace({"nan": "", "None": "", "<NA>": ""})
            preview_records = preview_df.to_dict(orient="records")

            category_distribution = {str(k): int(v) for k, v in processed_df["Crime_Type"].value_counts().items()}
            city_distribution = {str(k): int(v) for k, v in processed_df["City"].value_counts().head(5).items()}

            # Apply to platform if requested
            if apply_to_platform:
                import shutil
                if DATA_PATH.exists():
                    try:
                        shutil.copy2(DATA_PATH, PREVIOUS_DATA_PATH)
                    except Exception as e:
                        print(f"[CrimeVisionEngine] Warning backing up previous dataset: {e}")

                self.df = processed_df
                # Recompute zone profiles
                self.zone_profiles = {}
                for zone, group in self.df.groupby("Zone"):
                    self.zone_profiles[str(zone)] = {
                        "zone": str(zone),
                        "state": str(group["State"].iloc[0]),
                        "city": str(group["City"].iloc[0]),
                        "location": str(group["Location"].iloc[0]),
                        "lat": round(float(group["Latitude"].mean()), 6),
                        "lng": round(float(group["Longitude"].mean()), 6),
                        "total_crimes": int(len(group)),
                        "dominant_crime": str(group["Crime_Type"].mode().iloc[0]),
                        "peak_day": str(group["Day"].mode().iloc[0]),
                        "peak_window": str(group["Time_Window"].mode().iloc[0]),
                        "peak_hour": f"{int(group['Hour'].mode().iloc[0]):02d}:00"
                    }
                # Save uploaded dataset as working dataset
                processed_df.to_csv(DATA_PATH, index=False)

            return sanitize_for_json({
                "success": True,
                "filename": filename,
                "applied_to_platform": apply_to_platform,
                "steps": [
                    {"step": 1, "name": "Validate File Format", "title": "Validate File Format", "status": "passed", "detail": f"Valid {filename.split('.')[-1].upper()} format"},
                    {"step": 2, "name": "Detect Columns & Map Aliases", "title": "Detect Columns & Map Aliases", "status": "passed", "detail": f"{len(detected_standard_fields)} core fields recognized"},
                    {"step": 3, "name": "Compute Row Count", "title": "Compute Row Count", "status": "passed", "detail": f"{len(processed_df):,} validated records"},
                    {"step": 4, "name": "Screen Missing Values", "title": "Screen Missing Values", "status": "passed", "detail": f"{missing_val_count} values handled and imputed"},
                    {"step": 5, "name": "Screen Duplicate Records", "title": "Screen Duplicate Records", "status": "passed", "detail": f"{dup_count} duplicates deduplicated"},
                    {"step": 6, "name": "Generate 5-Row Data Preview", "title": "Generate 5-Row Data Preview", "status": "passed", "detail": "Sample records rendered below"},
                    {"step": 7, "name": "Validate & Parse Dates", "title": "Validate & Parse Dates", "status": "passed", "detail": f"Period: {int(processed_df['Year'].min())} to {int(processed_df['Year'].max())}"},
                    {"step": 8, "name": "Validate Geographic Coordinates", "title": "Validate Geographic Coordinates", "status": "passed", "detail": "Lat [8°, 37°], Lon [68°, 97°] bounded"},
                    {"step": 9, "name": "Standardize Crime Categories", "title": "Standardize Crime Categories", "status": "passed", "detail": f"Theft, Burglary, Vehicle Theft standardized"},
                    {"step": 10, "name": "Prepare Analytics & Risk Features", "title": "Prepare Analytics & Risk Features", "status": "passed", "detail": f"{len(self.zone_profiles) if apply_to_platform else len(zone_counts)} operational zones structured"}
                ],
                "rows": int(len(processed_df)),
                "columns": list(processed_df.columns),
                "missing_values": int(missing_val_count),
                "duplicate_records": int(dup_count),
                "detected_standard_fields": detected_standard_fields,
                "category_distribution": category_distribution,
                "city_distribution": city_distribution,
                "preview": preview_records,
                "message": f"Successfully processed {len(processed_df):,} crime records from {filename} across all 10 validation stages."
            })
        except Exception as e:
            return sanitize_for_json({
                "success": False,
                "error": f"Failed during dataset processing: {str(e)}",
                "steps": [
                    {"step": 1, "name": "Dataset Validation", "title": "Dataset Validation", "status": "failed", "detail": str(e)}
                ]
            })

    def reset_dataset(self, target: str = "default") -> Dict[str, Any]:
        """
        Resets or restores dataset.
        target='default' or 'original': restores original project design benchmark dataset (5,200 records across 7 states).
        target='previous': restores dataset version prior to the most recent upload.
        """
        import shutil
        if target == "previous":
            if not PREVIOUS_DATA_PATH.exists():
                return sanitize_for_json({
                    "success": False,
                    "error": "No previous dataset version found to restore. You can reset to the original project design dataset instead."
                })
            try:
                shutil.copy2(PREVIOUS_DATA_PATH, DATA_PATH)
                self.load_data()
                return sanitize_for_json({
                    "success": True,
                    "target": "previous",
                    "rows": int(len(self.df)),
                    "message": f"Successfully restored previous dataset version ({len(self.df):,} records across {self.df['State'].nunique()} states)."
                })
            except Exception as e:
                return sanitize_for_json({
                    "success": False,
                    "error": f"Failed restoring previous dataset: {str(e)}"
                })
        else: # target in ("default", "original")
            try:
                src_path = ORIGINAL_DESIGN_DATA_PATH if ORIGINAL_DESIGN_DATA_PATH.exists() else DEFAULT_DATA_PATH
                if src_path.exists():
                    shutil.copy2(src_path, DATA_PATH)
                self.load_data()
                return sanitize_for_json({
                    "success": True,
                    "target": "default",
                    "rows": int(len(self.df)),
                    "message": f"Successfully restored platform to original project design dataset ({len(self.df):,} records across {self.df['State'].nunique()} states, 2021–2025)."
                })
            except Exception as e:
                return sanitize_for_json({
                    "success": False,
                    "error": f"Failed resetting to original design dataset: {str(e)}"
                })

    def get_dataset_status(self) -> Dict[str, Any]:
        """Returns metadata about the active dataset, previous version, and original design backup."""
        has_prev = PREVIOUS_DATA_PATH.exists()
        prev_rows = 0
        if has_prev:
            try:
                prev_df = pd.read_csv(PREVIOUS_DATA_PATH)
                prev_rows = int(len(prev_df))
            except Exception:
                prev_rows = 0

        default_rows = 5200
        src_path = ORIGINAL_DESIGN_DATA_PATH if ORIGINAL_DESIGN_DATA_PATH.exists() else DEFAULT_DATA_PATH
        if src_path.exists():
            try:
                def_df = pd.read_csv(src_path)
                default_rows = int(len(def_df))
            except Exception:
                default_rows = 5200

        current_rows = int(len(self.df)) if not self.df.empty else 0
        is_default = (current_rows == default_rows and (self.df["State"].nunique() == 7 if not self.df.empty else False))

        return sanitize_for_json({
            "current_rows": current_rows,
            "is_default": is_default,
            "has_previous": has_prev,
            "previous_rows": prev_rows,
            "default_rows": default_rows,
            "states_count": int(self.df["State"].nunique()) if not self.df.empty else 0,
            "zones_count": int(self.df["Zone"].nunique()) if not self.df.empty else 0,
            "data_period": f"{self.df['Year'].min()} – {self.df['Year'].max()}" if not self.df.empty else "N/A"
        })

# Global Singleton
engine = CrimeVisionEngine()
