"""
CrimeVision AI - Streamlit front end
Run locally:  streamlit run streamlit_app.py
Place this file in the project root (same folder as app.py, next to backend/, data/, models/).
"""

import sys
from pathlib import Path

import pandas as pd
import streamlit as st

BASE_DIR = Path(__file__).resolve().parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

st.set_page_config(page_title="CrimeVision AI", page_icon="🛡️", layout="wide")


@st.cache_resource(show_spinner="Loading CrimeVision engine...")
def load_engine():
    from backend.crimevision_engine import engine
    return engine


try:
    engine = load_engine()
except Exception as exc:  # noqa: BLE001
    st.error(f"Could not load backend.crimevision_engine: {exc}")
    st.info("Make sure backend/, data/ and models/ are in the repo and requirements are installed.")
    st.stop()


# ----------------------------------------------------------------- helpers
def opts(col, df=None):
    df = engine.df if df is None else df
    if col not in df.columns:
        return ["All"]
    vals = sorted(str(v) for v in df[col].dropna().unique())
    return ["All"] + vals


def none_if_all(v):
    return None if v in (None, "All") else v


def render(obj, title=None, depth=0):
    """Render whatever the engine returns (dict / list / DataFrame / scalar)."""
    if title:
        (st.subheader if depth == 0 else st.markdown)(title if depth == 0 else f"**{title}**")
    if isinstance(obj, pd.DataFrame):
        st.dataframe(obj, use_container_width=True)
    elif isinstance(obj, list):
        if obj and all(isinstance(x, dict) for x in obj):
            st.dataframe(pd.DataFrame(obj), use_container_width=True)
        elif obj:
            st.write(obj)
    elif isinstance(obj, dict):
        scalars = {k: v for k, v in obj.items() if isinstance(v, (int, float, str, bool)) or v is None}
        if scalars:
            cols = st.columns(min(4, len(scalars)))
            for i, (k, v) in enumerate(scalars.items()):
                cols[i % len(cols)].metric(str(k).replace("_", " ").title(), "-" if v is None else v)
        for k, v in obj.items():
            if k in scalars:
                continue
            nice = str(k).replace("_", " ").title()
            if isinstance(v, dict) and v and all(isinstance(x, (int, float)) for x in v.values()):
                st.markdown(f"**{nice}**")
                st.bar_chart(pd.Series(v))
            elif isinstance(v, (dict, list)):
                render(v, nice, depth + 1)
            else:
                st.write(nice, v)
    else:
        st.write(obj)


def sidebar_filters(zone=True, day=False, window=False):
    st.sidebar.header("Filters")
    state = st.sidebar.selectbox("State", opts("State"))
    sub = engine.df if state == "All" else engine.df[engine.df["State"] == state]
    city = st.sidebar.selectbox("City", opts("City", sub))
    if city != "All":
        sub = sub[sub["City"] == city]
    f = {"state": none_if_all(state), "city": none_if_all(city)}
    if zone:
        f["zone"] = none_if_all(st.sidebar.selectbox("Zone", opts("Zone", sub)))
    f["crime_type"] = none_if_all(st.sidebar.selectbox("Crime type", opts("Crime_Type")))
    years = ["All"] + sorted(
        pd.to_datetime(engine.df["Date"], errors="coerce").dt.year.dropna().astype(int).unique().tolist()
    ) if "Date" in engine.df.columns else ["All"]
    y = st.sidebar.selectbox("Year", years)
    f["year"] = None if y == "All" else int(y)
    if day:
        f["day"] = none_if_all(st.sidebar.selectbox(
            "Day", ["All", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]))
    if window:
        f["time_window"] = none_if_all(st.sidebar.selectbox("Time window", opts("Time_Window")))
    return f


# ------------------------------------------------------------------- pages
def page_dashboard():
    st.title("📊 Dashboard")
    f = sidebar_filters(day=True, window=True)
    f.update({"start_date": None, "end_date": None})
    render(engine.get_dashboard_summary(f))


def page_analytics():
    st.title("📈 Crime Analytics")
    f = sidebar_filters(day=True, window=True)
    render(engine.get_analytics(f))


def page_hotspots():
    st.title("🔥 Hotspots & Clusters")
    f = sidebar_filters(zone=False)
    render(engine.get_hotspots({k: f[k] for k in ("state", "city", "crime_type", "year")}), "Top hotspots")
    render(engine.clusters, "Spatial clusters")
    df = engine.df
    if {"Latitude", "Longitude"} <= set(df.columns):
        st.subheader("Map")
        m = df.rename(columns={"Latitude": "lat", "Longitude": "lon"})[["lat", "lon"]].dropna()
        st.map(m.sample(min(len(m), 3000), random_state=1))


def page_trends():
    st.title("📉 Trends")
    f = sidebar_filters()
    render(engine.get_trends(f))


def page_predict():
    st.title("🎯 Risk Prediction")
    c1, c2, c3 = st.columns(3)
    state = c1.selectbox("State", opts("State")[1:])
    sub = engine.df[engine.df["State"] == state]
    city = c2.selectbox("City", opts("City", sub)[1:])
    sub = sub[sub["City"] == city]
    zone = c3.selectbox("Zone", opts("Zone", sub)[1:])
    c4, c5, c6 = st.columns(3)
    crime = c4.selectbox("Crime type", ["Theft", "Burglary", "Vehicle Theft"])
    d = c5.date_input("Date")
    t = c6.time_input("Time")
    if st.button("Predict risk", type="primary"):
        try:
            res = engine.predict_risk(
                state=state, city=city, zone=zone, crime_type=crime,
                date_str=d.strftime("%Y-%m-%d"), time_str=t.strftime("%H:%M"), time_window=None,
            )
        except Exception as exc:  # noqa: BLE001
            st.error(str(exc))
            return
        score = next((res[k] for k in ("risk_score", "score", "risk_percent", "probability")
                      if isinstance(res, dict) and isinstance(res.get(k), (int, float))), None)
        level = next((res[k] for k in ("risk_level", "level") if isinstance(res, dict) and k in res), None)
        if score is not None:
            pct = score * 100 if score <= 1 else score
            st.metric("Risk score", f"{pct:.0f}%", level)
            st.progress(min(max(int(pct), 0), 100))
        render(res, "Details")
    st.caption("Statistical risk forecast based on historical data. It does not identify individuals "
               "and should not be the sole basis for enforcement decisions.")


def page_explorer():
    st.title("🗂️ Data Explorer")
    df = engine.df
    q = st.text_input("Search")
    f = sidebar_filters()
    data = df.copy()
    for col, key in (("State", "state"), ("City", "city"), ("Zone", "zone"), ("Crime_Type", "crime_type")):
        if f.get(key) and col in data.columns:
            data = data[data[col] == f[key]]
    if f.get("year") and "Date" in data.columns:
        data = data[pd.to_datetime(data["Date"], errors="coerce").dt.year == f["year"]]
    if q:
        mask = data.astype(str).apply(lambda c: c.str.contains(q, case=False, na=False)).any(axis=1)
        data = data[mask]
    st.write(f"{len(data):,} records")
    st.dataframe(data, use_container_width=True, height=500)
    st.download_button("Export CSV", data.to_csv(index=False).encode(), "crimevision_export.csv", "text/csv")


def page_model():
    st.title("🤖 Model Performance")
    render(engine.metrics)


PAGES = {
    "Dashboard": page_dashboard,
    "Analytics": page_analytics,
    "Hotspots": page_hotspots,
    "Trends": page_trends,
    "Risk Prediction": page_predict,
    "Data Explorer": page_explorer,
    "Model Performance": page_model,
}

st.sidebar.title("🛡️ CrimeVision AI")
choice = st.sidebar.radio("Navigate", list(PAGES))
st.sidebar.caption(f"{len(engine.df):,} records · Property Crime Dataset (2021–2025)")
st.sidebar.divider()
PAGES[choice]()
