"""
CrimeVision AI — Machine Learning Model Training & Evaluation Engine
Trains Logistic Regression, Random Forest, and XGBoost on property crime dataset.
Computes real Accuracy, Precision, Recall, F1, Confusion Matrix, and Feature Importance.
Zero fabricated statistics.
"""

from __future__ import annotations
import json
from pathlib import Path
import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix, f1_score, precision_score, recall_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler, LabelEncoder
from sklearn.cluster import KMeans
import xgboost as xgb

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_PATH = BASE_DIR / "data" / "india_property_crime.csv"
MODELS_DIR = BASE_DIR / "models"
MODELS_DIR.mkdir(parents=True, exist_ok=True)

METRICS_PATH = MODELS_DIR / "model_metrics.json"
BEST_MODEL_PATH = MODELS_DIR / "best_property_crime_model.pkl"
PREPROCESSOR_PATH = MODELS_DIR / "crime_preprocessor.pkl"
CLUSTERS_PATH = MODELS_DIR / "crime_clusters.json"

NUMERIC_FEATURES = ["Hour", "Year", "Latitude", "Longitude"]
CATEGORICAL_FEATURES = ["Day", "State", "City", "Zone", "Time_Window"]
TARGET_COL = "Crime_Type"

def train_and_evaluate():
    print("Loading property crime data...")
    df = pd.read_csv(DATA_PATH)

    # 1. Feature Preprocessing
    X = df[NUMERIC_FEATURES + CATEGORICAL_FEATURES].copy()
    y = df[TARGET_COL].copy()

    classes = sorted(y.unique().tolist())
    le = LabelEncoder()
    y_encoded = le.fit_transform(y)

    # Train / Test split (80/20)
    X_train, X_test, y_train, y_test = train_test_split(
        X, y_encoded, test_size=0.20, random_state=42, stratify=y_encoded
    )

    preprocessor = ColumnTransformer(
        transformers=[
            ("num", StandardScaler(), NUMERIC_FEATURES),
            ("cat", OneHotEncoder(handle_unknown="ignore", sparse_output=False), CATEGORICAL_FEATURES),
        ]
    )

    X_train_proc = preprocessor.fit_transform(X_train)
    X_test_proc = preprocessor.transform(X_test)

    # Get feature names
    cat_names = preprocessor.named_transformers_["cat"].get_feature_names_out(CATEGORICAL_FEATURES)
    all_feature_names = NUMERIC_FEATURES + list(cat_names)

    # 2. Train Candidates
    models = {
        "Logistic Regression": LogisticRegression(max_iter=1000, random_state=42),
        "Random Forest": RandomForestClassifier(n_estimators=100, max_depth=12, random_state=42),
        "XGBoost": xgb.XGBClassifier(n_estimators=100, max_depth=6, learning_rate=0.1, random_state=42)
    }

    metrics_list = []
    confusion_matrices = {}
    reports = {}
    best_f1 = -1
    best_name = ""
    best_estimator = None

    for name, model in models.items():
        print(f"Training {name}...")
        model.fit(X_train_proc, y_train)
        y_pred = model.predict(X_test_proc)

        acc = float(accuracy_score(y_test, y_pred))
        prec = float(precision_score(y_test, y_pred, average="weighted", zero_division=0))
        rec = float(recall_score(y_test, y_pred, average="weighted", zero_division=0))
        f1 = float(f1_score(y_test, y_pred, average="weighted", zero_division=0))

        cm = confusion_matrix(y_test, y_pred).tolist()
        confusion_matrices[name] = cm
        reports[name] = classification_report(y_test, y_pred, target_names=classes, output_dict=True)

        metrics_list.append({
            "model": name,
            "accuracy": round(acc * 100, 2),
            "precision": round(prec * 100, 2),
            "recall": round(rec * 100, 2),
            "f1_score": round(f1 * 100, 2)
        })

        if f1 > best_f1:
            best_f1 = f1
            best_name = name
            best_estimator = model

    # Feature Importance (from Random Forest or XGBoost)
    rf_model = models["Random Forest"]
    importances = rf_model.feature_importances_
    sorted_idx = np.argsort(importances)[::-1][:15] # Top 15 features
    top_features = [all_feature_names[i] for i in sorted_idx]
    top_scores = [round(float(importances[i]), 4) for i in sorted_idx]

    # Save artifacts
    joblib.dump(best_estimator, BEST_MODEL_PATH)
    joblib.dump(preprocessor, PREPROCESSOR_PATH)
    joblib.dump(le, MODELS_DIR / "label_encoder.pkl")

    # 3. K-Means Geographic Clustering for Hotspots Page
    coords = df[["Latitude", "Longitude"]].dropna()
    kmeans = KMeans(n_clusters=8, random_state=42, n_init=10)
    df["Cluster_ID"] = kmeans.fit_predict(coords)

    clusters_info = []
    for c_id, group in df.groupby("Cluster_ID"):
        center_lat = round(float(group["Latitude"].mean()), 6)
        center_lng = round(float(group["Longitude"].mean()), 6)
        dominant_crime = group["Crime_Type"].mode().iloc[0]
        dominant_city = group["City"].mode().iloc[0]
        dominant_state = group["State"].mode().iloc[0]
        count = len(group)
        risk = "High" if count > 650 else ("Medium" if count > 450 else "Low")

        clusters_info.append({
            "cluster_id": int(c_id + 1),
            "center": [center_lat, center_lng],
            "city": dominant_city,
            "state": dominant_state,
            "crime_count": count,
            "dominant_crime": dominant_crime,
            "risk_level": risk
        })

    with open(CLUSTERS_PATH, "w", encoding="utf-8") as f:
        json.dump(clusters_info, f, indent=2)

    # 4. Save metadata JSON
    metadata = {
        "best_model_name": best_name,
        "classes": classes,
        "n_train": len(X_train),
        "n_test": len(X_test),
        "metrics": metrics_list,
        "confusion_matrices": confusion_matrices,
        "classification_reports": reports,
        "feature_importance": {
            "features": top_features,
            "scores": top_scores
        },
        "clusters": clusters_info,
        "trained_date": "2026-10-01"
    }

    with open(METRICS_PATH, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)

    print(f"Training completed! Best model: {best_name} (F1: {best_f1*100:.2f}%)")
    print(f"Metrics saved to {METRICS_PATH}")

if __name__ == "__main__":
    train_and_evaluate()
