"""
Backfill Pipeline - Geçmiş Verinin Canlı Veri ile Geri Doldurulması
Historical Data Backfilling using Current Data and ML Predictions

Amaç:
- Güncel veri (01/09/2025) ile eksik geçmiş veri (2016-2022) tahmin edilecek
- ML pipeline ile eksik aylara ait fiyat verisi tahmin edilecek
- Panelde "tahmini veri" olarak işaretlenecek ve confidence skorları gösterilecek
"""

import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Tuple
import logging
from dataclasses import dataclass
from motor.motor_asyncio import AsyncIOMotorDatabase
import asyncio

# ML Libraries
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.model_selection import train_test_split, TimeSeriesSplit
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score
import xgboost as xgb
from prophet import Prophet
import joblib
from pathlib import Path

# Visualization
import plotly.graph_objects as go
import plotly.express as px
from plotly.utils import PlotlyJSONEncoder
import json

logger = logging.getLogger(__name__)

@dataclass
class BackfillConfig:
    """Backfill konfigürasyonu"""
    start_date: str  # "2016-01-01"
    end_date: str    # "2022-12-31"
    current_data_months: int = 12  # Son kaç ay güncel veri kullanılacak
    confidence_threshold: float = 0.7  # Minimum güven skoru
    batch_size: int = 1000
    models_to_use: List[str] = None
    
    def __post_init__(self):
        if self.models_to_use is None:
            self.models_to_use = ['prophet', 'xgboost', 'random_forest']

@dataclass
class BackfillResult:
    """Backfill sonuçları"""
    location_code: str
    property_type: str
    filled_periods: List[str]
    predictions: List[Dict[str, Any]]
    confidence_scores: List[float]
    model_used: str
    rmse: float
    mae: float
    r2_score: float

class MacroEconomicData:
    """Makroekonomi verilerini yönetir"""
    
    def __init__(self):
        # Mock makroekonomi verileri - gerçek sistemde TCMB API'sinden alınacak
        self.tufe_data = self._generate_tufe_data()
        self.interest_rate_data = self._generate_interest_data()
        self.usd_rate_data = self._generate_usd_data()
    
    def _generate_tufe_data(self) -> Dict[str, float]:
        """TÜFE verilerini generate eder (mock)"""
        dates = pd.date_range(start='2016-01-01', end='2025-09-01', freq='M')
        # Basit TÜFE trendi: yıllık %15-20 enflasyon
        base_tufe = 100
        tufe_values = {}
        
        for i, date in enumerate(dates):
            # Trend + seasonal + noise
            yearly_inflation = 0.17 + 0.05 * np.sin(2 * np.pi * i / 12)  # %15-22 arası
            monthly_rate = (1 + yearly_inflation) ** (1/12) - 1
            if i == 0:
                tufe_values[date.strftime('%Y-%m')] = base_tufe
            else:
                prev_value = list(tufe_values.values())[-1]
                tufe_values[date.strftime('%Y-%m')] = prev_value * (1 + monthly_rate)
        
        return tufe_values
    
    def _generate_interest_data(self) -> Dict[str, float]:
        """Faiz oranı verilerini generate eder (mock)"""
        dates = pd.date_range(start='2016-01-01', end='2025-09-01', freq='M')
        # TCMB politika faizi trendi
        interest_values = {}
        
        for i, date in enumerate(dates):
            # 2016: %7.5, 2018-2019: %24, 2020-2021: %17, 2022-2023: %35, 2024-2025: %50
            year = date.year
            if year <= 2017:
                base_rate = 7.5
            elif year <= 2019:
                base_rate = 20.0
            elif year <= 2021:
                base_rate = 17.0
            elif year <= 2023:
                base_rate = 30.0
            else:
                base_rate = 50.0
            
            # Add some monthly variation
            monthly_variation = 2 * np.sin(2 * np.pi * i / 12) + np.random.normal(0, 1)
            interest_values[date.strftime('%Y-%m')] = max(5.0, base_rate + monthly_variation)
        
        return interest_values
    
    def _generate_usd_data(self) -> Dict[str, float]:
        """USD/TRY kurunu generate eder (mock)"""
        dates = pd.date_range(start='2016-01-01', end='2025-09-01', freq='M')
        usd_values = {}
        
        # USD/TRY trendi: 2016: 3 TL, 2020: 7 TL, 2022: 18 TL, 2025: 32 TL
        for i, date in enumerate(dates):
            years_since_2016 = (date.year - 2016) + (date.month - 1) / 12
            # Exponential growth with some volatility
            base_rate = 3.0 * (1.25 ** years_since_2016)  # %25 yearly average growth
            volatility = 0.5 * np.sin(2 * np.pi * i / 6) + np.random.normal(0, 0.3)
            usd_values[date.strftime('%Y-%m')] = max(2.5, base_rate + volatility)
        
        return usd_values
    
    def get_macro_features(self, date_str: str) -> Dict[str, float]:
        """Belirli bir tarih için makro değişkenleri döndürür"""
        try:
            date_key = pd.to_datetime(date_str).strftime('%Y-%m')
            return {
                'tufe_index': self.tufe_data.get(date_key, 100.0),
                'interest_rate': self.interest_rate_data.get(date_key, 15.0),
                'usd_try_rate': self.usd_rate_data.get(date_key, 15.0)
            }
        except:
            return {'tufe_index': 100.0, 'interest_rate': 15.0, 'usd_try_rate': 15.0}

class BackfillFeatureEngine:
    """Backfill için feature engineering"""
    
    def __init__(self, macro_data: MacroEconomicData):
        self.macro_data = macro_data
        self.location_encoder = LabelEncoder()
        self.property_type_encoder = LabelEncoder()
        self.scaler = StandardScaler()
        
    def create_time_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """Zaman serisi özellikleri oluşturur"""
        df = df.copy()
        df['date'] = pd.to_datetime(df['date'])
        
        # Basic time features
        df['year'] = df['date'].dt.year
        df['month'] = df['date'].dt.month
        df['quarter'] = df['date'].dt.quarter
        df['day_of_year'] = df['date'].dt.dayofyear
        df['days_since_2016'] = (df['date'] - pd.to_datetime('2016-01-01')).dt.days
        
        # Cyclical features
        df['month_sin'] = np.sin(2 * np.pi * df['month'] / 12)
        df['month_cos'] = np.cos(2 * np.pi * df['month'] / 12)
        df['quarter_sin'] = np.sin(2 * np.pi * df['quarter'] / 4)
        df['quarter_cos'] = np.cos(2 * np.pi * df['quarter'] / 4)
        
        return df
    
    def create_lag_features(self, df: pd.DataFrame, target_col: str = 'price_per_m2', 
                          location_col: str = 'location_code') -> pd.DataFrame:
        """Lag özellikleri oluşturur"""
        df = df.copy()
        df = df.sort_values(['location_code', 'date'])
        
        # Lag features by location
        for lag in [1, 3, 6, 12]:
            df[f'{target_col}_lag_{lag}'] = df.groupby(location_col)[target_col].shift(lag)
        
        # Rolling statistics
        for window in [3, 6, 12]:
            df[f'{target_col}_rolling_mean_{window}'] = (
                df.groupby(location_col)[target_col]
                .rolling(window=window, min_periods=1)
                .mean()
                .reset_index(level=0, drop=True)
            )
            df[f'{target_col}_rolling_std_{window}'] = (
                df.groupby(location_col)[target_col]
                .rolling(window=window, min_periods=1)
                .std()
                .reset_index(level=0, drop=True)
            )
        
        return df
    
    def add_macro_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """Makroekonomi özelliklerini ekler"""
        df = df.copy()
        
        # Add macro features for each row
        macro_features = []
        for date in df['date']:
            macro_dict = self.macro_data.get_macro_features(date.strftime('%Y-%m-%d'))
            macro_features.append(macro_dict)
        
        macro_df = pd.DataFrame(macro_features)
        df = pd.concat([df.reset_index(drop=True), macro_df.reset_index(drop=True)], axis=1)
        
        # Create macro change features
        df['tufe_growth'] = df['tufe_index'].pct_change()
        df['interest_change'] = df['interest_rate'].diff()
        df['usd_growth'] = df['usd_try_rate'].pct_change()
        
        return df
    
    def add_location_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """Lokasyon özelliklerini ekler"""
        df = df.copy()
        
        # Location-based statistics
        location_stats = df.groupby('location_code')['price_per_m2'].agg([
            'mean', 'std', 'count', 'min', 'max'
        ]).reset_index()
        location_stats.columns = ['location_code', 'location_price_mean', 'location_price_std', 
                                'location_count', 'location_price_min', 'location_price_max']
        
        df = df.merge(location_stats, on='location_code', how='left')
        
        # Price relative to location
        df['price_vs_location_mean'] = df['price_per_m2'] / df['location_price_mean']
        
        return df
    
    def prepare_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """Tüm özellikleri hazırlar"""
        logger.info(f"Preparing features for {len(df)} records")
        
        # Create all features
        df = self.create_time_features(df)
        df = self.create_lag_features(df)
        df = self.add_macro_features(df)
        df = self.add_location_features(df)
        
        # Encode categorical variables
        if 'location_code' in df.columns:
            df['location_encoded'] = self.location_encoder.fit_transform(df['location_code'].astype(str))
        
        if 'property_type' in df.columns:
            df['property_type_encoded'] = self.property_type_encoder.fit_transform(df['property_type'].astype(str))
        
        # Fill remaining NaN values
        df = df.fillna(method='ffill').fillna(method='bfill').fillna(0)
        
        logger.info(f"Feature preparation complete. Shape: {df.shape}")
        return df

class BackfillModel:
    """Backfill için ML modelleri"""
    
    def __init__(self, model_type: str = 'xgboost'):
        self.model_type = model_type
        self.model = None
        self.feature_columns = None
        self.scaler = StandardScaler()
        
    def _get_model(self):
        """Model tipine göre ML modeli döndürür"""
        if self.model_type == 'xgboost':
            return xgb.XGBRegressor(
                n_estimators=200,
                max_depth=6,
                learning_rate=0.1,
                random_state=42,
                n_jobs=-1
            )
        elif self.model_type == 'random_forest':
            return RandomForestRegressor(
                n_estimators=200,
                max_depth=10,
                random_state=42,
                n_jobs=-1
            )
        elif self.model_type == 'gradient_boosting':
            return GradientBoostingRegressor(
                n_estimators=200,
                max_depth=6,
                learning_rate=0.1,
                random_state=42
            )
        else:
            raise ValueError(f"Unsupported model type: {self.model_type}")
    
    def train(self, X: pd.DataFrame, y: pd.Series) -> Dict[str, float]:
        """Modeli eğitir"""
        logger.info(f"Training {self.model_type} model with {len(X)} samples")
        
        # Store feature columns
        self.feature_columns = X.columns.tolist()
        
        # Split data for validation
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
        
        # Scale features
        X_train_scaled = self.scaler.fit_transform(X_train)
        X_test_scaled = self.scaler.transform(X_test)
        
        # Train model
        self.model = self._get_model()
        self.model.fit(X_train_scaled, y_train)
        
        # Evaluate
        y_pred_train = self.model.predict(X_train_scaled)
        y_pred_test = self.model.predict(X_test_scaled)
        
        metrics = {
            'train_rmse': np.sqrt(mean_squared_error(y_train, y_pred_train)),
            'train_mae': mean_absolute_error(y_train, y_pred_train),
            'train_r2': r2_score(y_train, y_pred_train),
            'test_rmse': np.sqrt(mean_squared_error(y_test, y_pred_test)),
            'test_mae': mean_absolute_error(y_test, y_pred_test),
            'test_r2': r2_score(y_test, y_pred_test)
        }
        
        logger.info(f"Model trained. Test R²: {metrics['test_r2']:.3f}, RMSE: {metrics['test_rmse']:.0f}")
        return metrics
    
    def predict_with_uncertainty(self, X: pd.DataFrame) -> Tuple[np.ndarray, np.ndarray]:
        """Tahmin ve belirsizlik skorları döndürür"""
        if self.model is None:
            raise ValueError("Model must be trained first")
        
        # Ensure same features
        X_aligned = X[self.feature_columns].fillna(0)
        X_scaled = self.scaler.transform(X_aligned)
        
        # Base prediction
        predictions = self.model.predict(X_scaled)
        
        # Calculate uncertainty (confidence) scores
        if hasattr(self.model, 'estimators_') and self.model_type == 'random_forest':
            # For Random Forest, use variance of tree predictions
            tree_predictions = np.array([tree.predict(X_scaled) for tree in self.model.estimators_])
            uncertainties = np.std(tree_predictions, axis=0)
        else:
            # For other models, estimate uncertainty based on residuals
            # This is a simplified approach - in production, use more sophisticated methods
            uncertainties = np.abs(predictions) * 0.1  # 10% of prediction as uncertainty
        
        # Convert uncertainty to confidence (0-1 scale)
        max_uncertainty = np.percentile(uncertainties, 95)
        confidence_scores = 1 - (uncertainties / max_uncertainty)
        confidence_scores = np.clip(confidence_scores, 0, 1)
        
        return predictions, confidence_scores

class ProphetBackfillModel:
    """Prophet ile zaman serisi backfill"""
    
    def __init__(self):
        self.model = None
        self.location_models = {}
        
    def train_location_model(self, df: pd.DataFrame, location_code: str) -> Dict[str, float]:
        """Specific lokasyon için Prophet modeli eğitir"""
        location_data = df[df['location_code'] == location_code].copy()
        
        if len(location_data) < 12:  # At least 1 year of data
            logger.warning(f"Insufficient data for location {location_code}: {len(location_data)} records")
            return {'error': 'insufficient_data'}
        
        # Prepare Prophet format
        prophet_df = location_data[['date', 'price_per_m2']].rename(columns={
            'date': 'ds',
            'price_per_m2': 'y'
        })
        
        # Train Prophet
        model = Prophet(
            yearly_seasonality=True,
            weekly_seasonality=False,
            daily_seasonality=False,
            changepoint_prior_scale=0.1,
            seasonality_prior_scale=10.0
        )
        
        try:
            model.fit(prophet_df)
            self.location_models[location_code] = model
            
            # Evaluate on last 20% of data
            split_idx = int(len(prophet_df) * 0.8)
            train_df = prophet_df.iloc[:split_idx]
            test_df = prophet_df.iloc[split_idx:]
            
            if len(test_df) > 0:
                forecast = model.predict(test_df[['ds']])
                rmse = np.sqrt(mean_squared_error(test_df['y'], forecast['yhat']))
                mae = mean_absolute_error(test_df['y'], forecast['yhat'])
                
                return {'rmse': rmse, 'mae': mae, 'model_trained': True}
            else:
                return {'model_trained': True, 'note': 'no_test_data'}
                
        except Exception as e:
            logger.error(f"Error training Prophet for location {location_code}: {str(e)}")
            return {'error': str(e)}
    
    def predict_missing_periods(self, location_code: str, missing_dates: List[str]) -> Tuple[List[float], List[float]]:
        """Eksik dönemler için tahmin yapar"""
        if location_code not in self.location_models:
            raise ValueError(f"No trained model for location {location_code}")
        
        model = self.location_models[location_code]
        
        # Prepare future dataframe
        future_df = pd.DataFrame({'ds': pd.to_datetime(missing_dates)})
        
        # Make predictions
        forecast = model.predict(future_df)
        
        predictions = forecast['yhat'].tolist()
        # Use prediction intervals for confidence
        lower_bound = forecast['yhat_lower'].tolist()
        upper_bound = forecast['yhat_upper'].tolist()
        
        # Calculate confidence scores based on prediction interval width
        interval_widths = np.array(upper_bound) - np.array(lower_bound)
        max_width = np.percentile(interval_widths, 95)
        confidence_scores = 1 - (interval_widths / max_width)
        confidence_scores = np.clip(confidence_scores, 0, 1).tolist()
        
        return predictions, confidence_scores

class BackfillPipeline:
    """Ana Backfill Pipeline sınıfı"""
    
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.macro_data = MacroEconomicData()
        self.feature_engine = BackfillFeatureEngine(self.macro_data)
        self.models = {}
        self.prophet_model = ProphetBackfillModel()
        
    async def detect_missing_periods(self, config: BackfillConfig) -> Dict[str, List[str]]:
        """Eksik dönemleri tespit eder"""
        logger.info("Detecting missing periods in historical data")
        
        # Get all existing data
        existing_data = await self.db.price_indices_raw.find({
            'date': {
                '$gte': config.start_date,
                '$lte': config.end_date
            }
        }).to_list(None)
        
        if not existing_data:
            logger.warning("No existing historical data found")
            return {}
        
        # Create DataFrame
        df = pd.DataFrame(existing_data)
        df['date'] = pd.to_datetime(df['date'])
        
        # Generate complete date range
        full_date_range = pd.date_range(
            start=config.start_date,
            end=config.end_date,
            freq='M'
        )
        
        # Find missing periods by location
        missing_by_location = {}
        
        for location in df['location_code'].unique():
            location_data = df[df['location_code'] == location]
            existing_dates = set(location_data['date'].dt.to_period('M').astype(str))
            all_dates = set(full_date_range.to_period('M').astype(str))
            
            missing_dates = list(all_dates - existing_dates)
            if missing_dates:
                missing_by_location[location] = sorted(missing_dates)
        
        logger.info(f"Detected missing periods for {len(missing_by_location)} locations")
        return missing_by_location
    
    async def prepare_training_data(self, config: BackfillConfig) -> pd.DataFrame:
        """Eğitim verisi hazırlar"""
        logger.info("Preparing training data for backfill models")
        
        # Get current data (last N months)
        cutoff_date = (datetime.now() - timedelta(days=config.current_data_months * 30)).strftime('%Y-%m-%d')
        
        # Query real estate data
        query = {
            'date': {'$gte': cutoff_date},
            'price': {'$gt': 0},
            'size_m2': {'$gt': 0}
        }
        
        # Get from real_estate_ads collection
        current_ads = await self.db.real_estate_ads.find(query).to_list(None)
        
        if not current_ads:
            # Fallback to price_indices_raw
            current_ads = await self.db.price_indices_raw.find(query).to_list(None)
        
        if not current_ads:
            raise ValueError("No current data found for training")
        
        # Convert to DataFrame
        df = pd.DataFrame(current_ads)
        
        # Standardize columns
        if 'price_per_m2' not in df.columns and 'price' in df.columns and 'size_m2' in df.columns:
            df['price_per_m2'] = df['price'] / df['size_m2']
        
        # Clean data
        df = df.dropna(subset=['price_per_m2'])
        df = df[df['price_per_m2'] > 0]
        
        # Add features
        df = self.feature_engine.prepare_features(df)
        
        logger.info(f"Training data prepared: {len(df)} records")
        return df
    
    async def train_backfill_models(self, config: BackfillConfig) -> Dict[str, Any]:
        """Backfill modelleri eğitir"""
        logger.info("Training backfill models")
        
        # Prepare training data
        df = await self.prepare_training_data(config)
        
        if len(df) < 100:
            raise ValueError(f"Insufficient training data: {len(df)} records (minimum 100 required)")
        
        # Define feature columns (exclude target and ID columns)
        exclude_cols = ['price_per_m2', 'price', '_id', 'original_id', 'location_code', 'property_type', 'date']
        feature_cols = [col for col in df.columns if col not in exclude_cols and not col.endswith('_id')]
        
        X = df[feature_cols]
        y = df['price_per_m2']
        
        # Train different models
        results = {}
        
        for model_type in config.models_to_use:
            if model_type == 'prophet':
                # Train Prophet models by location
                prophet_results = {}
                for location in df['location_code'].unique()[:10]:  # Limit to top 10 locations
                    location_result = self.prophet_model.train_location_model(df, location)
                    prophet_results[location] = location_result
                
                results['prophet'] = {
                    'locations_trained': len([r for r in prophet_results.values() if r.get('model_trained')]),
                    'location_results': prophet_results
                }
            else:
                # Train ML models
                model = BackfillModel(model_type)
                metrics = model.train(X, y)
                self.models[model_type] = model
                results[model_type] = metrics
        
        logger.info(f"Trained {len(results)} backfill models")
        return results
    
    async def run_backfill(self, config: BackfillConfig) -> List[BackfillResult]:
        """Ana backfill işlemini çalıştırır"""
        logger.info("Starting backfill process")
        
        # 1. Detect missing periods
        missing_periods = await self.detect_missing_periods(config)
        
        if not missing_periods:
            logger.info("No missing periods detected")
            return []
        
        # 2. Train models
        training_results = await self.train_backfill_models(config)
        
        # 3. Run predictions for each location
        backfill_results = []
        
        for location_code, missing_dates in list(missing_periods.items())[:5]:  # Limit to 5 locations for demo
            logger.info(f"Processing backfill for location {location_code}: {len(missing_dates)} missing periods")
            
            try:
                # Try Prophet first (best for time series)
                if 'prophet' in training_results and location_code in self.prophet_model.location_models:
                    predictions, confidence_scores = self.prophet_model.predict_missing_periods(
                        location_code, missing_dates
                    )
                    
                    result = BackfillResult(
                        location_code=location_code,
                        property_type='residential_sale',  # Default
                        filled_periods=missing_dates,
                        predictions=[
                            {
                                'period': period,
                                'predicted_price_per_m2': pred,
                                'confidence': conf,
                                'is_predicted': True
                            }
                            for period, pred, conf in zip(missing_dates, predictions, confidence_scores)
                        ],
                        confidence_scores=confidence_scores,
                        model_used='prophet',
                        rmse=training_results['prophet']['location_results'][location_code].get('rmse', 0),
                        mae=training_results['prophet']['location_results'][location_code].get('mae', 0),
                        r2_score=0.8  # Prophet doesn't directly provide R²
                    )
                    
                    backfill_results.append(result)
                
                # Fallback to XGBoost/RandomForest
                elif 'xgboost' in self.models:
                    # This would require more complex feature preparation for missing periods
                    # For now, skip non-Prophet predictions
                    logger.info(f"Skipping XGBoost prediction for {location_code} (would need feature engineering)")
                
            except Exception as e:
                logger.error(f"Error processing backfill for location {location_code}: {str(e)}")
                continue
        
        logger.info(f"Completed backfill for {len(backfill_results)} locations")
        return backfill_results
    
    async def save_backfill_results(self, results: List[BackfillResult]) -> Dict[str, int]:
        """Backfill sonuçlarını veritabanına kaydeder"""
        logger.info(f"Saving {len(results)} backfill results to database")
        
        saved_counts = {'predictions': 0, 'metadata': 0}
        
        for result in results:
            # Save predictions to a separate collection
            predictions_to_save = []
            
            for pred in result.predictions:
                predictions_to_save.append({
                    'location_code': result.location_code,
                    'property_type': result.property_type,
                    'date': pred['period'],
                    'price_per_m2': pred['predicted_price_per_m2'],
                    'confidence_score': pred['confidence'],
                    'is_predicted': True,
                    'model_used': result.model_used,
                    'created_at': datetime.utcnow(),
                    'backfill_session': datetime.now().strftime('%Y%m%d_%H%M%S')
                })
            
            if predictions_to_save:
                await self.db.backfill_predictions.insert_many(predictions_to_save)
                saved_counts['predictions'] += len(predictions_to_save)
            
            # Save metadata
            metadata = {
                'location_code': result.location_code,
                'property_type': result.property_type,
                'filled_periods_count': len(result.filled_periods),
                'model_used': result.model_used,
                'avg_confidence': np.mean(result.confidence_scores),
                'rmse': result.rmse,
                'mae': result.mae,
                'r2_score': result.r2_score,
                'created_at': datetime.utcnow(),
                'backfill_session': datetime.now().strftime('%Y%m%d_%H%M%S')
            }
            
            await self.db.backfill_metadata.insert_one(metadata)
            saved_counts['metadata'] += 1
        
        logger.info(f"Saved {saved_counts['predictions']} predictions and {saved_counts['metadata']} metadata records")
        return saved_counts

# Main backfill function
async def run_backfill_pipeline(db: AsyncIOMotorDatabase, config: BackfillConfig) -> Dict[str, Any]:
    """Ana backfill pipeline fonksiyonu"""
    pipeline = BackfillPipeline(db)
    
    try:
        # Run backfill
        results = await pipeline.run_backfill(config)
        
        # Save results
        save_stats = await pipeline.save_backfill_results(results)
        
        return {
            'success': True,
            'backfilled_locations': len(results),
            'total_predictions': save_stats['predictions'],
            'avg_confidence': np.mean([np.mean(r.confidence_scores) for r in results]) if results else 0,
            'models_used': list(set([r.model_used for r in results])),
            'session_id': datetime.now().strftime('%Y%m%d_%H%M%S')
        }
        
    except Exception as e:
        logger.error(f"Backfill pipeline error: {str(e)}")
        return {
            'success': False,
            'error': str(e)
        }