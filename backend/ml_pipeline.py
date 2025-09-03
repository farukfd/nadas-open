"""
ML Pipeline Module for Real Estate Price Prediction and Data Processing
Supports Linear Regression, XGBoost, Prophet, and ARIMA models
"""

import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Tuple
import json
import logging
from pathlib import Path

# ML Libraries
from sklearn.model_selection import train_test_split, cross_val_score, TimeSeriesSplit
from sklearn.linear_model import LinearRegression, Ridge, Lasso
from sklearn.ensemble import RandomForestRegressor
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score
import xgboost as xgb
from prophet import Prophet
import joblib
import matplotlib
matplotlib.use('Agg')  # Non-interactive backend
import matplotlib.pyplot as plt
import plotly.graph_objects as go
import plotly.express as px
from plotly.utils import PlotlyJSONEncoder

# Setup logging
logger = logging.getLogger(__name__)

class MLModelType:
    """Available ML Model Types"""
    LINEAR_REGRESSION = "linear_regression"
    RIDGE_REGRESSION = "ridge_regression"  
    LASSO_REGRESSION = "lasso_regression"
    RANDOM_FOREST = "random_forest"
    XGBOOST = "xgboost"
    PROPHET = "prophet"

class DataProcessor:
    """Handles data preparation and feature engineering"""
    
    def __init__(self):
        self.scaler = StandardScaler()
        self.label_encoders = {}
        
    def clean_data(self, df: pd.DataFrame, options: Dict[str, Any]) -> pd.DataFrame:
        """Clean and prepare data based on user options"""
        logger.info(f"Cleaning data with {len(df)} rows")
        
        # Handle missing values
        if options.get('drop_missing', False):
            df = df.dropna()
        elif options.get('interpolate_missing', True):
            numeric_cols = df.select_dtypes(include=[np.number]).columns
            df[numeric_cols] = df[numeric_cols].interpolate(method='linear')
        
        # Handle outliers
        if options.get('remove_outliers', True):
            df = self._remove_outliers(df, method=options.get('outlier_method', 'iqr'))
        
        # Feature engineering for time series
        if options.get('create_time_features', True) and 'date' in df.columns:
            df = self._create_time_features(df)
            
        logger.info(f"Data cleaned, {len(df)} rows remaining")
        return df
    
    def _remove_outliers(self, df: pd.DataFrame, method: str = 'iqr') -> pd.DataFrame:
        """Remove outliers using IQR or Z-score method"""
        numeric_cols = df.select_dtypes(include=[np.number]).columns
        
        for col in numeric_cols:
            if method == 'iqr':
                Q1 = df[col].quantile(0.25)
                Q3 = df[col].quantile(0.75)
                IQR = Q3 - Q1
                lower_bound = Q1 - 1.5 * IQR
                upper_bound = Q3 + 1.5 * IQR
                df = df[(df[col] >= lower_bound) & (df[col] <= upper_bound)]
            elif method == 'zscore':
                z_scores = np.abs((df[col] - df[col].mean()) / df[col].std())
                df = df[z_scores < 3]
                
        return df
    
    def _create_time_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """Create time-based features"""
        if 'date' in df.columns:
            df['date'] = pd.to_datetime(df['date'])
            df['year'] = df['date'].dt.year
            df['month'] = df['date'].dt.month
            df['quarter'] = df['date'].dt.quarter
            df['day_of_year'] = df['date'].dt.dayofyear
            
        # Create lag features for price
        if 'price' in df.columns:
            for lag in [1, 3, 6, 12]:
                df[f'price_lag_{lag}'] = df['price'].shift(lag)
                
        # Rolling statistics
        if 'price' in df.columns:
            for window in [3, 6, 12]:
                df[f'price_rolling_mean_{window}'] = df['price'].rolling(window=window).mean()
                df[f'price_rolling_std_{window}'] = df['price'].rolling(window=window).std()
                
        return df

class ModelTrainer:
    """Handles ML model training and evaluation"""
    
    def __init__(self):
        self.models = {}
        self.model_configs = {
            MLModelType.LINEAR_REGRESSION: {
                'class': LinearRegression,
                'params': {}
            },
            MLModelType.RIDGE_REGRESSION: {
                'class': Ridge,
                'params': {'alpha': 1.0}
            },
            MLModelType.LASSO_REGRESSION: {
                'class': Lasso,
                'params': {'alpha': 1.0}
            },
            MLModelType.RANDOM_FOREST: {
                'class': RandomForestRegressor,
                'params': {'n_estimators': 100, 'random_state': 42}
            },
            MLModelType.XGBOOST: {
                'class': xgb.XGBRegressor,
                'params': {'n_estimators': 100, 'random_state': 42}
            }
        }
        
    def train_model(self, df: pd.DataFrame, model_type: str, target_column: str = 'price', 
                   test_size: float = 0.2) -> Dict[str, Any]:
        """Train a machine learning model"""
        logger.info(f"Training {model_type} model with {len(df)} samples")
        
        try:
            # Prepare features and target
            X, y = self._prepare_features_target(df, target_column)
            
            # Handle time series data differently
            if model_type == MLModelType.PROPHET:
                return self._train_prophet_model(df, target_column)
            
            # Split data
            X_train, X_test, y_train, y_test = train_test_split(
                X, y, test_size=test_size, random_state=42
            )
            
            # Get model configuration
            if model_type not in self.model_configs:
                raise ValueError(f"Unsupported model type: {model_type}")
                
            model_config = self.model_configs[model_type]
            model = model_config['class'](**model_config['params'])
            
            # Train model
            start_time = datetime.now()
            model.fit(X_train, y_train)
            training_time = (datetime.now() - start_time).total_seconds()
            
            # Make predictions
            y_pred_train = model.predict(X_train)
            y_pred_test = model.predict(X_test)
            
            # Calculate metrics
            metrics = self._calculate_metrics(y_train, y_pred_train, y_test, y_pred_test)
            
            # Feature importance (if available)
            feature_importance = {}
            if hasattr(model, 'feature_importances_'):
                # Ensure feature importance values are JSON serializable
                importance_values = [float(val) if not (np.isnan(val) or np.isinf(val)) else 0.0 
                                   for val in model.feature_importances_]
                feature_importance = dict(zip(X.columns, importance_values))
            elif hasattr(model, 'coef_'):
                # Ensure coefficient values are JSON serializable
                coef_values = [float(val) if not (np.isnan(val) or np.isinf(val)) else 0.0 
                             for val in model.coef_]
                feature_importance = dict(zip(X.columns, coef_values))
                
            # Save model with feature names
            model_id = self._save_model(model, model_type, X.columns.tolist())
            
            result = {
                'model_id': model_id,
                'model_type': model_type,
                'training_time': training_time,
                'metrics': metrics,
                'feature_importance': feature_importance,
                'data_shape': X.shape,
                'feature_names': X.columns.tolist(),
                'predictions': {
                    'actual_test': y_test.tolist(),
                    'predicted_test': y_pred_test.tolist()
                }
            }
            
            logger.info(f"Model {model_type} trained successfully. R² Score: {metrics['test_r2']:.3f}")
            return result
            
        except Exception as e:
            logger.error(f"Error training model {model_type}: {str(e)}")
            raise
    
    def _train_prophet_model(self, df: pd.DataFrame, target_column: str) -> Dict[str, Any]:
        """Train Prophet time series model"""
        logger.info("Training Prophet time series model")
        
        # Prepare Prophet data format
        prophet_df = df[['date', target_column]].rename(columns={
            'date': 'ds',
            target_column: 'y'
        }).dropna()
        
        # Split data for evaluation
        split_date = prophet_df['ds'].quantile(0.8)
        train_df = prophet_df[prophet_df['ds'] <= split_date]
        test_df = prophet_df[prophet_df['ds'] > split_date]
        
        # Train Prophet model
        start_time = datetime.now()
        model = Prophet(
            yearly_seasonality=True,
            weekly_seasonality=False,
            daily_seasonality=False
        )
        model.fit(train_df)
        training_time = (datetime.now() - start_time).total_seconds()
        
        # Make predictions
        future = model.make_future_dataframe(periods=len(test_df), freq='M')
        forecast = model.predict(future)
        
        # Calculate metrics for test period
        test_predictions = forecast[forecast['ds'].isin(test_df['ds'])]
        y_test = test_df['y'].values
        y_pred = test_predictions['yhat'].values
        
        metrics = {
            'test_rmse': np.sqrt(mean_squared_error(y_test, y_pred)),
            'test_mae': mean_absolute_error(y_test, y_pred),
            'test_mape': np.mean(np.abs((y_test - y_pred) / y_test)) * 100
        }
        
        # Save model
        model_id = self._save_model(model, MLModelType.PROPHET)
        
        result = {
            'model_id': model_id,
            'model_type': MLModelType.PROPHET,
            'training_time': training_time,
            'metrics': metrics,
            'forecast_data': {
                'dates': forecast['ds'].dt.strftime('%Y-%m-%d').tolist(),
                'predicted': forecast['yhat'].tolist(),
                'lower_bound': forecast['yhat_lower'].tolist(),
                'upper_bound': forecast['yhat_upper'].tolist()
            }
        }
        
        return result
    
    def _prepare_features_target(self, df: pd.DataFrame, target_column: str) -> Tuple[pd.DataFrame, pd.Series]:
        """Prepare features and target for training"""
        # Select numeric columns for features
        numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
        
        # Remove target column from features
        if target_column in numeric_cols:
            numeric_cols.remove(target_column)
        
        X = df[numeric_cols].fillna(0)
        y = df[target_column].fillna(df[target_column].mean())
        
        return X, y
    
    def _calculate_metrics(self, y_train, y_pred_train, y_test, y_pred_test) -> Dict[str, float]:
        """Calculate model performance metrics"""
        def safe_metric(value):
            """Ensure metric values are JSON serializable"""
            if np.isnan(value) or np.isinf(value):
                return 0.0
            return float(value)
        
        return {
            'train_rmse': safe_metric(np.sqrt(mean_squared_error(y_train, y_pred_train))),
            'train_mae': safe_metric(mean_absolute_error(y_train, y_pred_train)),
            'train_r2': safe_metric(r2_score(y_train, y_pred_train)),
            'test_rmse': safe_metric(np.sqrt(mean_squared_error(y_test, y_pred_test))),
            'test_mae': safe_metric(mean_absolute_error(y_test, y_pred_test)),
            'test_r2': safe_metric(r2_score(y_test, y_pred_test))
        }
    
    def _save_model(self, model, model_type: str) -> str:
        """Save model to disk and return model ID"""
        model_id = f"{model_type}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        model_path = Path(f"/app/backend/models/{model_id}.pkl")
        model_path.parent.mkdir(exist_ok=True)
        
        joblib.dump(model, model_path)
        logger.info(f"Model saved: {model_path}")
        
        return model_id

class DataVisualization:
    """Handles data visualization for the admin panel"""
    
    @staticmethod
    def create_price_trend_chart(df: pd.DataFrame) -> str:
        """Create price trend visualization"""
        fig = go.Figure()
        
        fig.add_trace(go.Scatter(
            x=df['date'] if 'date' in df.columns else df.index,
            y=df['price'] if 'price' in df.columns else df.iloc[:, 0],
            mode='lines+markers',
            name='Fiyat Trendi',
            line=dict(color='#2563eb', width=2)
        ))
        
        fig.update_layout(
            title='Emlak Fiyat Trendi',
            xaxis_title='Tarih',
            yaxis_title='Fiyat (TL/m²)',
            template='plotly_white',
            height=400
        )
        
        return json.dumps(fig, cls=PlotlyJSONEncoder)
    
    @staticmethod
    def create_model_performance_chart(metrics: Dict[str, float]) -> str:
        """Create model performance comparison chart"""
        metric_names = list(metrics.keys())
        metric_values = list(metrics.values())
        
        fig = go.Figure(data=[
            go.Bar(
                x=metric_names,
                y=metric_values,
                marker_color=['#10b981', '#f59e0b', '#ef4444']
            )
        ])
        
        fig.update_layout(
            title='Model Performans Metrikleri',
            xaxis_title='Metrik',
            yaxis_title='Değer',
            template='plotly_white',
            height=400
        )
        
        return json.dumps(fig, cls=PlotlyJSONEncoder)
    
    @staticmethod
    def create_feature_importance_chart(feature_importance: Dict[str, float]) -> str:
        """Create feature importance visualization"""
        features = list(feature_importance.keys())
        importance = list(feature_importance.values())
        
        # Sort by importance
        sorted_data = sorted(zip(features, importance), key=lambda x: x[1], reverse=True)
        features, importance = zip(*sorted_data[:10])  # Top 10 features
        
        fig = go.Figure(data=[
            go.Bar(
                x=importance,
                y=features,
                orientation='h',
                marker_color='#2563eb'
            )
        ])
        
        fig.update_layout(
            title='Özellik Önem Sıralaması (Top 10)',
            xaxis_title='Önem Skoru',
            yaxis_title='Özellik',
            template='plotly_white',
            height=500
        )
        
        return json.dumps(fig, cls=PlotlyJSONEncoder)

# ML Pipeline Manager
class MLPipeline:
    """Main ML Pipeline Manager"""
    
    def __init__(self):
        self.data_processor = DataProcessor()
        self.model_trainer = ModelTrainer()
        self.models_metadata = {}
        
    async def process_data(self, data: List[Dict], options: Dict[str, Any]) -> Dict[str, Any]:
        """Process raw data with cleaning and feature engineering"""
        try:
            # Convert to DataFrame
            df = pd.DataFrame(data)
            
            if df.empty:
                return {
                    'success': False,
                    'error': 'No data provided'
                }
            
            # Clean and prepare data
            cleaned_df = self.data_processor.clean_data(df, options)
            
            # Generate visualization (simplified to avoid plotly issues)
            result = {
                'success': True,
                'processed_rows': len(cleaned_df),
                'original_rows': len(df),
                'columns': list(cleaned_df.columns),
                'data_preview': cleaned_df.head(10).to_dict('records')
            }
            
            # Try to add visualization, but don't fail if it doesn't work
            try:
                price_chart = DataVisualization.create_price_trend_chart(cleaned_df)
                result['visualization'] = price_chart
            except Exception as viz_error:
                logger.warning(f"Could not create visualization: {str(viz_error)}")
                result['visualization'] = None
            
            return result
            
        except Exception as e:
            logger.error(f"Error processing data: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    async def train_model(self, data: List[Dict], model_config: Dict[str, Any]) -> Dict[str, Any]:
        """Train a machine learning model"""
        try:
            # Convert to DataFrame
            df = pd.DataFrame(data)
            
            # Clean data first
            df = self.data_processor.clean_data(df, model_config.get('data_options', {}))
            
            # Train model
            result = self.model_trainer.train_model(
                df, 
                model_config['model_type'],
                model_config.get('target_column', 'price'),
                model_config.get('test_size', 0.2)
            )
            
            # Generate visualizations
            if result['feature_importance']:
                feature_chart = DataVisualization.create_feature_importance_chart(result['feature_importance'])
                result['feature_importance_chart'] = feature_chart
            
            performance_chart = DataVisualization.create_model_performance_chart(result['metrics'])
            result['performance_chart'] = performance_chart
            
            # Store model metadata
            self.models_metadata[result['model_id']] = {
                'created_at': datetime.now().isoformat(),
                'model_type': result['model_type'],
                'metrics': result['metrics'],
                'data_shape': result['data_shape']
            }
            
            result['success'] = True
            return result
            
        except Exception as e:
            logger.error(f"Error training model: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    async def get_model_list(self) -> List[Dict[str, Any]]:
        """Get list of all trained models"""
        return [
            {
                'model_id': model_id,
                **metadata
            }
            for model_id, metadata in self.models_metadata.items()
        ]
    
    async def predict(self, model_id: str, data: List[Dict]) -> Dict[str, Any]:
        """Make predictions using a trained model"""
        try:
            # Load model
            model_path = Path(f"/app/backend/models/{model_id}.pkl")
            if not model_path.exists():
                raise ValueError(f"Model {model_id} not found")
            
            model = joblib.load(model_path)
            
            # Prepare data for prediction (no target column needed)
            df = pd.DataFrame(data)
            
            # Select numeric columns for features (excluding price if present)
            numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
            if 'price' in numeric_cols:
                numeric_cols.remove('price')
            
            # If no numeric columns, create some basic features
            if not numeric_cols:
                # Create basic features from available data
                if 'size_m2' in df.columns:
                    df['size_m2'] = pd.to_numeric(df['size_m2'], errors='coerce').fillna(100)
                    numeric_cols.append('size_m2')
                if 'rooms' in df.columns:
                    df['rooms'] = pd.to_numeric(df['rooms'], errors='coerce').fillna(2)
                    numeric_cols.append('rooms')
                if 'age' in df.columns:
                    df['age'] = pd.to_numeric(df['age'], errors='coerce').fillna(5)
                    numeric_cols.append('age')
                if 'floor' in df.columns:
                    df['floor'] = pd.to_numeric(df['floor'], errors='coerce').fillna(3)
                    numeric_cols.append('floor')
            
            X = df[numeric_cols].fillna(0)
            
            # Make predictions
            predictions = model.predict(X)
            
            return {
                'success': True,
                'predictions': predictions.tolist(),
                'model_id': model_id,
                'features_used': numeric_cols
            }
            
        except Exception as e:
            logger.error(f"Error making predictions: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }

# Global pipeline instance
ml_pipeline = MLPipeline()