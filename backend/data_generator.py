"""
CrimeVision AI — Synthetic India Property Crime Dataset Generator
Generates realistic property crime records for major Indian metropolitan zones.
Covers: Theft, Burglary, Vehicle Theft (2021–2025)
Zero personal identifiable information (PII).
"""

from __future__ import annotations
import random
from datetime import datetime, timedelta
from pathlib import Path
import numpy as np
import pandas as pd

random.seed(42)
np.random.seed(42)

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_CSV = DATA_DIR / "india_property_crime.csv"

CITIES_CONFIG = [
    {
        "state": "Maharashtra",
        "city": "Mumbai",
        "center": (19.0760, 72.8777),
        "zones": [
            ("Zone 1 - South Hub", "Colaba & Fort", 18.9220, 72.8347),
            ("Zone 2 - Central Market", "Lower Parel & Dadar", 19.0178, 72.8478),
            ("Zone 3 - Airport Corridor", "Andheri & Vile Parle", 19.1136, 72.8697),
            ("Zone 4 - Tech Park", "Powai & Kanjurmarg", 19.1176, 72.9060),
            ("Zone 5 - Suburban North", "Borivali & Kandivali", 19.2288, 72.8541),
        ],
        "weight": 0.22
    },
    {
        "state": "Delhi NCT",
        "city": "New Delhi",
        "center": (28.6139, 77.2090),
        "zones": [
            ("Zone 1 - Connaught Hub", "CP & Barakhamba", 28.6315, 77.2167),
            ("Zone 2 - South Ring", "Lajpat Nagar & Hauz Khas", 28.5672, 77.2433),
            ("Zone 3 - West Commercial", "Rajouri Garden & Janakpuri", 28.6415, 77.1209),
            ("Zone 4 - North Campus", "Civil Lines & Model Town", 28.6860, 77.2100),
            ("Zone 5 - East Terminal", "Anand Vihar & Laxmi Nagar", 28.6469, 77.3160),
        ],
        "weight": 0.20
    },
    {
        "state": "Karnataka",
        "city": "Bengaluru",
        "center": (12.9716, 77.5946),
        "zones": [
            ("Zone 1 - Tech Corridor", "Electronic City", 12.8452, 77.6602),
            ("Zone 2 - Innovation Belt", "Whitefield", 12.9698, 77.7500),
            ("Zone 3 - Central CBD", "MG Road & Indiranagar", 12.9784, 77.6408),
            ("Zone 4 - South Hub", "Koramangala & BTM", 12.9352, 77.6245),
            ("Zone 5 - North Hub", "Hebbal & Yelahanka", 13.0358, 77.5970),
        ],
        "weight": 0.16
    },
    {
        "state": "Uttar Pradesh",
        "city": "Ghaziabad",
        "center": (28.6692, 77.4538),
        "zones": [
            ("Zone 1 - Transit Hub", "Old Ghaziabad & Rly Station", 28.6610, 77.4320),
            ("Zone 2 - Commercial Belt", "Indirapuram", 28.6430, 77.3710),
            ("Zone 3 - Industrial Sector", "Kavi Nagar & Sahibabad", 28.6800, 77.3800),
            ("Zone 4 - High-Risk Area", "Raj Nagar Extension", 28.7100, 77.4400),
            ("Zone 5 - Highway Node", "Crossings Republik", 28.6250, 77.4480),
        ],
        "weight": 0.12
    },
    {
        "state": "Maharashtra",
        "city": "Pune",
        "center": (18.5204, 73.8567),
        "zones": [
            ("Zone 1 - IT City", "Hinjawadi", 18.5913, 73.7389),
            ("Zone 2 - Old Core", "Shivajinagar & Deccan", 18.5314, 73.8446),
            ("Zone 3 - Eastern Hub", "Kharadi & Viman Nagar", 18.5529, 73.9350),
            ("Zone 4 - South Sector", "Kothrud & Swargate", 18.5074, 73.8077),
        ],
        "weight": 0.10
    },
    {
        "state": "West Bengal",
        "city": "Kolkata",
        "center": (22.5726, 88.3639),
        "zones": [
            ("Zone 1 - Sector V IT", "Salt Lake", 22.5800, 88.4300),
            ("Zone 2 - Heritage Central", "Park Street & Esplanade", 22.5530, 88.3520),
            ("Zone 3 - South Residential", "Ballygunge & Gariahat", 22.5180, 88.3640),
            ("Zone 4 - North Station Hub", "Howrah & Shyambazar", 22.5958, 88.3426),
        ],
        "weight": 0.08
    },
    {
        "state": "Telangana",
        "city": "Hyderabad",
        "center": (17.3850, 78.4867),
        "zones": [
            ("Zone 1 - Cyberabad", "Hitec City & Gachibowli", 17.4435, 78.3772),
            ("Zone 2 - Old City", "Charminar & Abids", 17.3616, 78.4747),
            ("Zone 3 - North Sector", "Secunderabad", 17.4399, 78.4983),
            ("Zone 4 - West Commercial", "Banjara & Jubilee Hills", 17.4325, 78.4071),
        ],
        "weight": 0.07
    },
    {
        "state": "Tamil Nadu",
        "city": "Chennai",
        "center": (13.0827, 80.2707),
        "zones": [
            ("Zone 1 - Coastal CBD", "Mylapore & Marina", 13.0368, 80.2676),
            ("Zone 2 - IT Expressway", "OMR & Taramani", 12.9863, 80.2432),
            ("Zone 3 - Commercial Hub", "T. Nagar & Nungambakkam", 13.0418, 80.2341),
            ("Zone 4 - Transit Junction", "Chennai Central & Egmore", 13.0825, 80.2750),
        ],
        "weight": 0.05
    }
]

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

DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

# Category distribution probabilities by time of day
# Vehicle theft peaks at night (18-24, 0-6)
# Theft peaks in commercial daytime & evening (12-21)
# Burglary peaks in daytime empty homes (10-16) and late night (1-5)

def get_time_window(hour: int) -> str:
    for name, s, e in TIME_WINDOWS:
        if s <= hour < e:
            return name
    return "9 PM – 12 AM"

def generate_records(num_records: int = 5200):
    records = []
    start_date = datetime(2021, 1, 1)
    end_date = datetime(2025, 12, 31)
    total_days = (end_date - start_date).days

    city_weights = np.array([c["weight"] for c in CITIES_CONFIG], dtype=float)
    city_weights = city_weights / city_weights.sum()

    for i in range(num_records):
        cid = f"CV-{2021 + (i % 5)}-{i+1:05d}"
        
        # Pick city
        city_cfg = np.random.choice(CITIES_CONFIG, p=city_weights)
        state = city_cfg["state"]
        city = city_cfg["city"]
        
        # Pick zone
        zone_info = random.choice(city_cfg["zones"])
        zone_name = zone_info[0]
        location_desc = zone_info[1]
        base_lat = zone_info[2]
        base_lng = zone_info[3]

        # Add slight jitter to coordinates (within ~1.5 km)
        lat = round(base_lat + np.random.normal(0, 0.008), 6)
        lng = round(base_lng + np.random.normal(0, 0.008), 6)

        # Date & Day
        random_day_offset = random.randint(0, total_days)
        record_date = start_date + timedelta(days=random_day_offset)
        year = record_date.year
        month = record_date.month
        day = record_date.day
        day_of_week = record_date.weekday()
        day_name = DAYS_OF_WEEK[day_of_week]

        # Diurnal distribution: Evening and late night have higher incidence
        hour_weights = np.array([
            0.05, 0.04, 0.03, 0.02, 0.015, 0.015, # 0-5
            0.02, 0.03, 0.04, 0.045, 0.05, 0.055, # 6-11
            0.06, 0.055, 0.05, 0.055, 0.065, 0.075, # 12-17
            0.085, 0.09, 0.095, 0.09, 0.07, 0.06  # 18-23
        ])
        hour_weights = hour_weights / hour_weights.sum()
        hour = int(np.random.choice(range(24), p=hour_weights))
        minute = random.randint(0, 59)
        time_str = f"{hour:02d}:{minute:02d}"
        time_window = get_time_window(hour)

        # Property crime category assignment based on hour
        if hour >= 21 or hour < 5:
            # Night -> Vehicle Theft and Burglary more likely
            crime_type = np.random.choice(
                ["Vehicle Theft", "Burglary", "Theft"],
                p=[0.48, 0.32, 0.20]
            )
        elif 9 <= hour <= 18:
            # Daytime -> Theft and residential Burglary
            crime_type = np.random.choice(
                ["Theft", "Burglary", "Vehicle Theft"],
                p=[0.55, 0.28, 0.17]
            )
        else:
            # Evening transition
            crime_type = np.random.choice(
                ["Theft", "Vehicle Theft", "Burglary"],
                p=[0.45, 0.35, 0.20]
            )

        # Assign risk zone categorization
        if "High-Risk" in zone_name or "Transit" in zone_name or "Commercial" in zone_name:
            risk_zone = "HIGH"
        elif "Tech" in zone_name or "Market" in zone_name or "Central" in zone_name:
            risk_zone = "MEDIUM"
        else:
            risk_zone = "LOW"

        records.append({
            "Crime_ID": cid,
            "Date": record_date.strftime("%Y-%m-%d"),
            "Time": time_str,
            "State": state,
            "City": city,
            "Location": location_desc,
            "Zone": zone_name,
            "Crime_Type": crime_type,
            "Latitude": lat,
            "Longitude": lng,
            "Day": day_name,
            "Month": record_date.strftime("%B"),
            "Hour": hour,
            "Year": year,
            "Time_Window": time_window,
            "Risk_Zone": risk_zone
        })

    df = pd.DataFrame(records)
    df.to_csv(OUTPUT_CSV, index=False)
    print(f"Generated {len(df)} records saved to {OUTPUT_CSV}")
    print("Crime Types:", df["Crime_Type"].value_counts().to_dict())
    print("States:", df["State"].value_counts().to_dict())
    print("Year Span:", df["Year"].min(), "-", df["Year"].max())

if __name__ == "__main__":
    generate_records(5200)
