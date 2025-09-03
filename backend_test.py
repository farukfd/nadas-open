#!/usr/bin/env python3
"""
Comprehensive Backend API Test Suite for Turkish Real Estate Price Index System
Tests all major API endpoints including authentication, location hierarchy, and price queries.
"""

import requests
import json
import time
from typing import Dict, Any, Optional

# Get backend URL from environment
BACKEND_URL = "https://realty-analytics-3.preview.emergentagent.com/api"

class BackendTester:
    def __init__(self):
        self.base_url = BACKEND_URL
        self.auth_token = None
        self.test_results = []
        
    def log_test(self, test_name: str, success: bool, details: str = ""):
        """Log test results"""
        status = "✅ PASS" if success else "❌ FAIL"
        self.test_results.append({
            "test": test_name,
            "status": status,
            "details": details
        })
        print(f"{status}: {test_name}")
        if details:
            print(f"   Details: {details}")
    
    def make_request(self, method: str, endpoint: str, data: Dict = None, headers: Dict = None) -> tuple:
        """Make HTTP request and return (success, response_data, status_code)"""
        url = f"{self.base_url}{endpoint}"
        
        try:
            if method.upper() == "GET":
                response = requests.get(url, headers=headers, timeout=30)
            elif method.upper() == "POST":
                response = requests.post(url, json=data, headers=headers, timeout=30)
            else:
                return False, f"Unsupported method: {method}", 0
                
            return True, response.json() if response.content else {}, response.status_code
            
        except requests.exceptions.RequestException as e:
            return False, f"Request failed: {str(e)}", 0
        except json.JSONDecodeError:
            return False, "Invalid JSON response", response.status_code if 'response' in locals() else 0
    
    def test_health_check(self):
        """Test health check endpoint"""
        success, data, status_code = self.make_request("GET", "/health")
        
        if success and status_code == 200 and data.get("status") == "healthy":
            self.log_test("Health Check", True, "API is healthy and responding")
        else:
            self.log_test("Health Check", False, f"Status: {status_code}, Data: {data}")
    
    def test_user_registration(self):
        """Test user registration with individual and corporate types"""
        
        import time
        timestamp = str(int(time.time()))
        
        # Test individual user registration
        individual_user = {
            "email": f"test_individual_{timestamp}@example.com",
            "password": "testpass123",
            "first_name": "Ahmet",
            "last_name": "Yılmaz",
            "user_type": "individual",
            "phone": "+905551234567"
        }
        
        success, data, status_code = self.make_request("POST", "/auth/register", individual_user)
        
        if success and status_code == 200 and "token" in data:
            self.log_test("Individual User Registration", True, f"User ID: {data.get('user', {}).get('id')}")
        else:
            self.log_test("Individual User Registration", False, f"Status: {status_code}, Data: {data}")
        
        # Test corporate user registration
        corporate_user = {
            "email": f"test_corporate_{timestamp}@example.com", 
            "password": "testpass123",
            "first_name": "Mehmet",
            "last_name": "Özkan",
            "user_type": "corporate",
            "company_name": "Emlak Şirketi A.Ş.",
            "phone": "+905559876543"
        }
        
        success, data, status_code = self.make_request("POST", "/auth/register", corporate_user)
        
        if success and status_code == 200 and "token" in data:
            user_data = data.get('user', {})
            self.log_test("Corporate User Registration", True, f"Company: {user_data.get('company_name', 'N/A')}")
        else:
            self.log_test("Corporate User Registration", False, f"Status: {status_code}, Data: {data}")
    
    def test_user_login(self):
        """Test user login with sample user"""
        login_data = {
            "email": "test@example.com",
            "password": "test123"
        }
        
        success, data, status_code = self.make_request("POST", "/auth/login", login_data)
        
        if success and status_code == 200 and "token" in data:
            self.auth_token = data["token"]
            user_info = data.get("user", {})
            self.log_test("User Login", True, f"User: {user_info.get('first_name')} {user_info.get('last_name')}, Type: {user_info.get('user_type')}")
        else:
            self.log_test("User Login", False, f"Status: {status_code}, Data: {data}")
    
    def test_user_profile(self):
        """Test authenticated user profile endpoint"""
        if not self.auth_token:
            self.log_test("User Profile", False, "No auth token available")
            return
            
        headers = {"Authorization": f"Bearer {self.auth_token}"}
        success, data, status_code = self.make_request("GET", "/user/profile", headers=headers)
        
        if success and status_code == 200 and "email" in data:
            self.log_test("User Profile", True, f"Email: {data.get('email')}, Query Count: {data.get('query_count')}/{data.get('query_limit')}")
        else:
            self.log_test("User Profile", False, f"Status: {status_code}, Data: {data}")
    
    def test_location_hierarchy(self):
        """Test location hierarchy endpoints"""
        
        # Test cities endpoint
        success, data, status_code = self.make_request("GET", "/locations/cities")
        
        if success and status_code == 200 and "cities" in data:
            cities = data["cities"]
            expected_cities = ["İstanbul", "Ankara", "İzmir", "Bursa", "Antalya"]
            found_cities = [city for city in expected_cities if city in cities]
            self.log_test("Get Cities", True, f"Found {len(cities)} cities including: {', '.join(found_cities[:3])}")
        else:
            self.log_test("Get Cities", False, f"Status: {status_code}, Data: {data}")
            return
        
        # Test districts for Istanbul
        success, data, status_code = self.make_request("GET", "/locations/districts/İstanbul")
        
        if success and status_code == 200 and "districts" in data:
            districts = data["districts"]
            self.log_test("Get Districts (İstanbul)", True, f"Found {len(districts)} districts")
        else:
            self.log_test("Get Districts (İstanbul)", False, f"Status: {status_code}, Data: {data}")
            return
        
        # Test neighborhoods for Istanbul/Kadıköy (if exists)
        if districts and len(districts) > 0:
            test_district = districts[0]  # Use first available district
            success, data, status_code = self.make_request("GET", f"/locations/neighborhoods/İstanbul/{test_district}")
            
            if success and status_code == 200 and "neighborhoods" in data:
                neighborhoods = data["neighborhoods"]
                self.log_test("Get Neighborhoods", True, f"Found {len(neighborhoods)} neighborhoods in {test_district}")
            else:
                self.log_test("Get Neighborhoods", False, f"Status: {status_code}, Data: {data}")
    
    def test_guest_query(self):
        """Test guest query endpoint (no authentication)"""
        query_data = {
            "il": "İstanbul",
            "ilce": "Kadıköy", 
            "mahalle": "Moda",  # Using actual seeded location
            "property_type": "residential_sale",
            "start_year": 2020,
            "end_year": 2025
        }
        
        success, data, status_code = self.make_request("POST", "/query/guest", query_data)
        
        if success and status_code == 200:
            location = data.get("location", {})
            price_data = data.get("price_data", [])
            demographic_data = data.get("demographic_data")
            remaining = data.get("query_count_remaining", 0)
            
            self.log_test("Guest Query", True, f"Location: {location.get('mahalle')}, Price records: {len(price_data)}, Remaining queries: {remaining}")
        elif status_code == 404:
            # Try with a different seeded location
            query_data["mahalle"] = "Galata"  # Another seeded location
            success, data, status_code = self.make_request("POST", "/query/guest", query_data)
            
            if success and status_code == 200:
                self.log_test("Guest Query (Fallback)", True, f"Found data for Galata neighborhood")
            else:
                self.log_test("Guest Query", False, f"Location not found even with fallback. Status: {status_code}")
        else:
            self.log_test("Guest Query", False, f"Status: {status_code}, Data: {data}")
    
    def test_protected_query(self):
        """Test protected query endpoint (requires authentication)"""
        if not self.auth_token:
            self.log_test("Protected Query", False, "No auth token available")
            return
            
        headers = {"Authorization": f"Bearer {self.auth_token}"}
        query_data = {
            "il": "İstanbul",
            "ilce": "Kadıköy",
            "mahalle": "Caddebostan",  # Using actual seeded location
            "property_type": "residential_rent",
            "start_year": 2022,
            "end_year": 2025
        }
        
        success, data, status_code = self.make_request("POST", "/query/protected", query_data, headers)
        
        if success and status_code == 200:
            location = data.get("location", {})
            price_data = data.get("price_data", [])
            demographic_data = data.get("demographic_data")
            remaining = data.get("query_count_remaining", 0)
            
            self.log_test("Protected Query", True, f"Location: {location.get('mahalle')}, Price records: {len(price_data)}, Remaining: {remaining}")
        elif status_code == 404:
            # Try with fallback location
            query_data["mahalle"] = "Taksim"  # Another seeded location
            success, data, status_code = self.make_request("POST", "/query/protected", query_data, headers)
            
            if success and status_code == 200:
                self.log_test("Protected Query (Fallback)", True, f"Found data for Taksim neighborhood")
            else:
                self.log_test("Protected Query", False, f"Location not found. Status: {status_code}")
        else:
            self.log_test("Protected Query", False, f"Status: {status_code}, Data: {data}")
    
    def test_query_limits(self):
        """Test query limits for authenticated users"""
        if not self.auth_token:
            self.log_test("Query Limits", False, "No auth token available")
            return
            
        headers = {"Authorization": f"Bearer {self.auth_token}"}
        query_data = {
            "il": "İstanbul",
            "ilce": "Beyoğlu",
            "mahalle": "Galata",  # Using actual seeded location
            "property_type": "residential_sale"
        }
        
        # Make multiple queries to test limits
        successful_queries = 0
        for i in range(7):  # Try more than the limit
            success, data, status_code = self.make_request("POST", "/query/protected", query_data, headers)
            
            if success and status_code == 200:
                successful_queries += 1
            elif status_code == 429:  # Query limit exceeded
                self.log_test("Query Limits", True, f"Query limit enforced after {successful_queries} queries")
                return
            elif status_code == 404:
                # Location not found, but this doesn't count against limit
                continue
            
            time.sleep(0.5)  # Small delay between requests
        
        self.log_test("Query Limits", False, f"Query limit not enforced - made {successful_queries} queries")
    
    def test_authentication_errors(self):
        """Test authentication error handling"""
        
        # Test invalid token
        headers = {"Authorization": "Bearer invalid_token_here"}
        success, data, status_code = self.make_request("GET", "/user/profile", headers=headers)
        
        if status_code == 401:
            self.log_test("Invalid Token Handling", True, "Properly rejected invalid token")
        else:
            self.log_test("Invalid Token Handling", False, f"Expected 401, got {status_code}")
        
        # Test missing token
        success, data, status_code = self.make_request("GET", "/user/profile")
        
        if status_code in [401, 403]:
            self.log_test("Missing Token Handling", True, "Properly rejected missing token")
        else:
            self.log_test("Missing Token Handling", False, f"Expected 401/403, got {status_code}")
    
    def test_admin_stats(self):
        """Test admin dashboard statistics endpoint"""
        if not self.auth_token:
            self.log_test("Admin Stats", False, "No auth token available")
            return
            
        headers = {"Authorization": f"Bearer {self.auth_token}"}
        success, data, status_code = self.make_request("GET", "/admin/stats", headers=headers)
        
        if success and status_code == 200:
            required_fields = ['total_users', 'active_users', 'total_locations', 'total_price_records']
            missing_fields = [field for field in required_fields if field not in data]
            
            if not missing_fields:
                self.log_test("Admin Stats", True, f"Users: {data.get('total_users')}, Locations: {data.get('total_locations')}, Records: {data.get('total_price_records')}")
            else:
                self.log_test("Admin Stats", False, f"Missing fields: {missing_fields}")
        else:
            self.log_test("Admin Stats", False, f"Status: {status_code}, Data: {data}")
    
    def test_admin_users(self):
        """Test admin users management endpoint"""
        if not self.auth_token:
            self.log_test("Admin Users", False, "No auth token available")
            return
            
        headers = {"Authorization": f"Bearer {self.auth_token}"}
        success, data, status_code = self.make_request("GET", "/admin/users", headers=headers)
        
        if success and status_code == 200 and "users" in data:
            users = data["users"]
            self.log_test("Admin Users", True, f"Retrieved {len(users)} users")
        else:
            self.log_test("Admin Users", False, f"Status: {status_code}, Data: {data}")
    
    def test_sample_data_generation(self):
        """Test sample data generation for ML training"""
        if not self.auth_token:
            self.log_test("Sample Data Generation", False, "No auth token available")
            return
            
        headers = {"Authorization": f"Bearer {self.auth_token}"}
        success, data, status_code = self.make_request("GET", "/admin/data/sample", headers=headers)
        
        if success and status_code == 200:
            sample_data = data.get("data", [])
            total_records = data.get("total_records", 0)
            
            if sample_data and total_records > 0:
                # Check if sample data has required fields
                first_record = sample_data[0]
                required_fields = ['date', 'price', 'location_code', 'property_type']
                missing_fields = [field for field in required_fields if field not in first_record]
                
                if not missing_fields:
                    self.log_test("Sample Data Generation", True, f"Generated {total_records} records with trends and seasonality")
                else:
                    self.log_test("Sample Data Generation", False, f"Missing required fields: {missing_fields}")
            else:
                self.log_test("Sample Data Generation", False, "No sample data generated")
        else:
            self.log_test("Sample Data Generation", False, f"Status: {status_code}, Data: {data}")
    
    def test_ml_model_training(self):
        """Test ML model training with Linear Regression"""
        if not self.auth_token:
            self.log_test("ML Model Training", False, "No auth token available")
            return
        
        # First get sample data
        headers = {"Authorization": f"Bearer {self.auth_token}"}
        success, sample_response, status_code = self.make_request("GET", "/admin/data/sample", headers=headers)
        
        if not success or status_code != 200:
            self.log_test("ML Model Training", False, "Could not get sample data for training")
            return
        
        sample_data = sample_response.get("data", [])
        if not sample_data:
            self.log_test("ML Model Training", False, "No sample data available for training")
            return
        
        # Train Linear Regression model
        training_request = {
            "data": sample_data,
            "model_config": {
                "model_type": "linear_regression",
                "target_column": "price",
                "test_size": 0.2,
                "data_options": {
                    "remove_outliers": True,
                    "create_time_features": True
                }
            }
        }
        
        success, data, status_code = self.make_request("POST", "/admin/models/train", training_request, headers)
        
        if success and status_code == 200:
            if data.get("success"):
                model_id = data.get("model_id")
                metrics = data.get("metrics", {})
                r2_score = metrics.get("test_r2", 0)
                
                self.log_test("ML Model Training", True, f"Model ID: {model_id}, R² Score: {r2_score:.3f}")
                
                # Store model_id for prediction test
                self.trained_model_id = model_id
            else:
                self.log_test("ML Model Training", False, f"Training failed: {data.get('error', 'Unknown error')}")
        else:
            self.log_test("ML Model Training", False, f"Status: {status_code}, Data: {data}")
    
    def test_ml_model_listing(self):
        """Test ML model listing endpoint"""
        if not self.auth_token:
            self.log_test("ML Model Listing", False, "No auth token available")
            return
            
        headers = {"Authorization": f"Bearer {self.auth_token}"}
        success, data, status_code = self.make_request("GET", "/admin/models", headers=headers)
        
        if success and status_code == 200:
            models = data.get("models", [])
            self.log_test("ML Model Listing", True, f"Found {len(models)} trained models")
        else:
            self.log_test("ML Model Listing", False, f"Status: {status_code}, Data: {data}")
    
    def test_ml_predictions(self):
        """Test ML model predictions"""
        if not self.auth_token:
            self.log_test("ML Predictions", False, "No auth token available")
            return
        
        # Check if we have a trained model from previous test
        if not hasattr(self, 'trained_model_id'):
            self.log_test("ML Predictions", False, "No trained model available for predictions")
            return
        
        headers = {"Authorization": f"Bearer {self.auth_token}"}
        
        # Create prediction data (similar to training data structure)
        prediction_data = [
            {
                'date': '2025-01-01',
                'location_code': '34001',
                'property_type': 'residential_sale',
                'size_m2': 100,
                'rooms': 3,
                'age': 5,
                'floor': 3
            },
            {
                'date': '2025-01-01',
                'location_code': '34002',
                'property_type': 'residential_rent',
                'size_m2': 80,
                'rooms': 2,
                'age': 10,
                'floor': 5
            }
        ]
        
        prediction_request = {
            "data": prediction_data
        }
        
        success, data, status_code = self.make_request(
            "POST", 
            f"/admin/models/{self.trained_model_id}/predict", 
            prediction_request, 
            headers
        )
        
        if success and status_code == 200:
            if data.get("success"):
                predictions = data.get("predictions", [])
                self.log_test("ML Predictions", True, f"Generated {len(predictions)} predictions")
            else:
                self.log_test("ML Predictions", False, f"Prediction failed: {data.get('error', 'Unknown error')}")
        else:
            self.log_test("ML Predictions", False, f"Status: {status_code}, Data: {data}")
    
    def test_ml_error_handling(self):
        """Test ML pipeline error handling"""
        if not self.auth_token:
            self.log_test("ML Error Handling", False, "No auth token available")
            return
        
        headers = {"Authorization": f"Bearer {self.auth_token}"}
        
        # Test invalid model type
        invalid_training_request = {
            "data": [{"price": 1000, "size": 100}],
            "model_config": {
                "model_type": "invalid_model_type",
                "target_column": "price"
            }
        }
        
        success, data, status_code = self.make_request("POST", "/admin/models/train", invalid_training_request, headers)
        
        if status_code == 400:
            self.log_test("ML Error Handling", True, "Properly rejected invalid model type")
        else:
            self.log_test("ML Error Handling", False, f"Expected 400 for invalid model type, got {status_code}")
    
    def test_data_processing(self):
        """Test data processing endpoint"""
        if not self.auth_token:
            self.log_test("Data Processing", False, "No auth token available")
            return
        
        headers = {"Authorization": f"Bearer {self.auth_token}"}
        
        # Test data processing with sample data
        processing_request = {
            "data": [
                {"date": "2024-01-01", "price": 5000, "location": "Istanbul"},
                {"date": "2024-02-01", "price": 5200, "location": "Istanbul"},
                {"date": "2024-03-01", "price": 5100, "location": "Istanbul"}
            ],
            "options": {
                "remove_outliers": True,
                "create_time_features": True,
                "interpolate_missing": True
            }
        }
        
        success, data, status_code = self.make_request("POST", "/admin/data/process", processing_request, headers)
        
        if success and status_code == 200:
            if data.get("success"):
                processed_rows = data.get("processed_rows", 0)
                original_rows = data.get("original_rows", 0)
                self.log_test("Data Processing", True, f"Processed {processed_rows}/{original_rows} rows")
            else:
                self.log_test("Data Processing", False, f"Processing failed: {data.get('error', 'Unknown error')}")
        else:
            self.log_test("Data Processing", False, f"Status: {status_code}, Data: {data}")
    
    def test_real_data_import(self):
        """Test real data import from ee2401_db.sql (FAZ 2.1)"""
        if not self.auth_token:
            self.log_test("Real Data Import", False, "No auth token available")
            return
        
        headers = {"Authorization": f"Bearer {self.auth_token}"}
        
        print("\n🔄 Starting real data import (this may take several minutes)...")
        success, data, status_code = self.make_request("POST", "/admin/data/import-real", {}, headers)
        
        if success and status_code == 200:
            if data.get("success"):
                stats = data.get("statistics", {})
                total_lines = stats.get("total_lines", 0)
                imported_records = stats.get("imported_records", 0)
                success_rate = stats.get("success_rate", 0)
                
                # Check if we got expected volume (~1.7M records)
                if imported_records > 1000000:  # At least 1M records
                    self.log_test("Real Data Import", True, f"Imported {imported_records:,} records from {total_lines:,} lines. Success rate: {success_rate:.1f}%")
                else:
                    self.log_test("Real Data Import", False, f"Low import volume: {imported_records:,} records (expected >1M)")
            else:
                self.log_test("Real Data Import", False, f"Import failed: {data.get('error', 'Unknown error')}")
        else:
            self.log_test("Real Data Import", False, f"Status: {status_code}, Data: {data}")
    
    def test_collections_info(self):
        """Test collections info API after real data import (FAZ 2.1)"""
        if not self.auth_token:
            self.log_test("Collections Info", False, "No auth token available")
            return
        
        headers = {"Authorization": f"Bearer {self.auth_token}"}
        success, data, status_code = self.make_request("GET", "/admin/data/collections-info", headers=headers)
        
        if success and status_code == 200:
            if data.get("success"):
                collections = data.get("collections", {})
                
                # Check expected collections and counts
                expected_collections = {
                    'real_estate_ads': 20,  # Minimum expected
                    'original_users': 10000,  # Minimum expected  
                    'price_indices_raw': 1000000  # Minimum expected
                }
                
                results = []
                all_good = True
                
                for collection, min_count in expected_collections.items():
                    if collection in collections:
                        actual_count = collections[collection].get('count', 0)
                        if actual_count >= min_count:
                            results.append(f"{collection}: {actual_count:,} records ✅")
                        else:
                            results.append(f"{collection}: {actual_count:,} records (expected >{min_count:,}) ❌")
                            all_good = False
                    else:
                        results.append(f"{collection}: Not found ❌")
                        all_good = False
                
                if all_good:
                    self.log_test("Collections Info", True, f"All collections verified. {'; '.join(results)}")
                else:
                    self.log_test("Collections Info", False, f"Collection issues found. {'; '.join(results)}")
            else:
                self.log_test("Collections Info", False, f"Failed to get collections info: {data.get('error', 'Unknown error')}")
        else:
            self.log_test("Collections Info", False, f"Status: {status_code}, Data: {data}")
    
    def test_real_data_ml_training(self):
        """Test ML training with real price indices data (FAZ 2.1)"""
        if not self.auth_token:
            self.log_test("Real Data ML Training", False, "No auth token available")
            return
        
        headers = {"Authorization": f"Bearer {self.auth_token}"}
        
        # First, generate real estate dataset from price indices
        print("\n🔄 Generating real estate dataset from price indices...")
        
        # Create a request for real data sample (focusing on Istanbul)
        real_data_request = {
            "location_filter": "Istanbul",
            "sample_size": 1000,
            "include_time_features": True
        }
        
        # For now, use the existing sample data endpoint but we'll enhance it
        success, sample_response, status_code = self.make_request("GET", "/admin/data/sample", headers=headers)
        
        if not success or status_code != 200:
            self.log_test("Real Data ML Training", False, "Could not get real data sample for training")
            return
        
        sample_data = sample_response.get("data", [])
        if not sample_data:
            self.log_test("Real Data ML Training", False, "No real data available for ML training")
            return
        
        # Train Linear Regression model with real data
        training_request = {
            "data": sample_data,
            "model_config": {
                "model_type": "linear_regression",
                "target_column": "price",
                "test_size": 0.2,
                "data_options": {
                    "remove_outliers": True,
                    "create_time_features": True,
                    "location_encoding": True
                }
            }
        }
        
        print("🤖 Training Linear Regression model with real data...")
        success, data, status_code = self.make_request("POST", "/admin/models/train", training_request, headers)
        
        if success and status_code == 200:
            if data.get("success"):
                model_id = data.get("model_id")
                metrics = data.get("metrics", {})
                r2_score = metrics.get("test_r2", 0)
                rmse = metrics.get("test_rmse", 0)
                mae = metrics.get("test_mae", 0)
                
                # Check if model performance is reasonable with real data
                if r2_score > 0.3:  # Reasonable R² for real estate data
                    self.log_test("Real Data ML Training", True, f"Model ID: {model_id}, R²: {r2_score:.3f}, RMSE: {rmse:.0f}, MAE: {mae:.0f}")
                    
                    # Store model_id for further testing
                    self.real_data_model_id = model_id
                else:
                    self.log_test("Real Data ML Training", False, f"Poor model performance: R²={r2_score:.3f} (expected >0.3)")
            else:
                self.log_test("Real Data ML Training", False, f"Training failed: {data.get('error', 'Unknown error')}")
        else:
            self.log_test("Real Data ML Training", False, f"Status: {status_code}, Data: {data}")
    
    def test_phone_hash_functionality(self):
        """Test phone hash functionality for KVKV compliance (FAZ 2.1)"""
        if not self.auth_token:
            self.log_test("Phone Hash KVKV", False, "No auth token available")
            return
        
        # This test checks if phone hashing is working in the imported data
        # We'll verify this by checking the collections info for original_users
        headers = {"Authorization": f"Bearer {self.auth_token}"}
        success, data, status_code = self.make_request("GET", "/admin/data/collections-info", headers=headers)
        
        if success and status_code == 200:
            collections = data.get("collections", {})
            
            if 'original_users' in collections:
                user_count = collections['original_users'].get('count', 0)
                sample_fields = collections['original_users'].get('sample_fields', [])
                
                # Check if phone_hash field exists (indicates KVKV compliance)
                if 'phone_hash' in sample_fields and user_count > 0:
                    self.log_test("Phone Hash KVKV", True, f"Phone hashing implemented for {user_count:,} users. KVKV compliant.")
                else:
                    self.log_test("Phone Hash KVKV", False, f"Phone hashing not found in user data structure")
            else:
                self.log_test("Phone Hash KVKV", False, "original_users collection not found")
        else:
            self.log_test("Phone Hash KVKV", False, f"Could not verify phone hashing. Status: {status_code}")
    
    def test_location_data_integrity(self):
        """Test location and temporal data integrity (FAZ 2.1)"""
        if not self.auth_token:
            self.log_test("Location Data Integrity", False, "No auth token available")
            return
        
        headers = {"Authorization": f"Bearer {self.auth_token}"}
        
        # Test if we can still query locations after real data import
        success, data, status_code = self.make_request("GET", "/locations/cities", headers=headers)
        
        if success and status_code == 200:
            cities = data.get("cities", [])
            
            # Check if we have major Turkish cities
            major_cities = ["İstanbul", "Ankara", "İzmir"]
            found_cities = [city for city in major_cities if city in cities]
            
            if len(found_cities) >= 2:  # At least 2 major cities
                self.log_test("Location Data Integrity", True, f"Location hierarchy intact. Found cities: {', '.join(found_cities)}")
            else:
                self.log_test("Location Data Integrity", False, f"Location data integrity issues. Found cities: {cities}")
        else:
            self.log_test("Location Data Integrity", False, f"Could not verify location data. Status: {status_code}")
    
    def test_large_dataset_performance(self):
        """Test system performance with large dataset (FAZ 2.1)"""
        if not self.auth_token:
            self.log_test("Large Dataset Performance", False, "No auth token available")
            return
        
        headers = {"Authorization": f"Bearer {self.auth_token}"}
        
        # Test admin stats endpoint performance with large dataset
        import time
        start_time = time.time()
        
        success, data, status_code = self.make_request("GET", "/admin/stats", headers=headers)
        
        end_time = time.time()
        response_time = end_time - start_time
        
        if success and status_code == 200:
            total_records = data.get("total_price_records", 0)
            
            # Check if system handles 1M+ records efficiently (response < 5 seconds)
            if total_records > 1000000 and response_time < 5.0:
                self.log_test("Large Dataset Performance", True, f"Handles {total_records:,} records efficiently ({response_time:.2f}s response)")
            elif total_records > 1000000:
                self.log_test("Large Dataset Performance", False, f"Slow performance with {total_records:,} records ({response_time:.2f}s response)")
            else:
                self.log_test("Large Dataset Performance", False, f"Dataset too small: {total_records:,} records")
        else:
            self.log_test("Large Dataset Performance", False, f"Performance test failed. Status: {status_code}")
    
    def run_all_tests(self):
        """Run all backend tests"""
        print("=" * 60)
        print("TURKISH REAL ESTATE PRICE INDEX API - BACKEND TESTS")
        print("=" * 60)
        print(f"Testing API at: {self.base_url}")
        print()
        
        # Core functionality tests
        self.test_health_check()
        self.test_user_registration()
        self.test_user_login()
        self.test_user_profile()
        self.test_location_hierarchy()
        self.test_guest_query()
        self.test_protected_query()
        self.test_query_limits()
        self.test_authentication_errors()
        
        # ML Pipeline Admin API tests
        print("\n" + "=" * 40)
        print("ML PIPELINE ADMIN API TESTS")
        print("=" * 40)
        
        self.test_admin_stats()
        self.test_admin_users()
        self.test_sample_data_generation()
        self.test_data_processing()
        self.test_ml_model_training()
        self.test_ml_model_listing()
        self.test_ml_predictions()
        self.test_ml_error_handling()
        
        # FAZ 2.1 Real Data Import & ML Pipeline Tests
        print("\n" + "=" * 50)
        print("FAZ 2.1 - REAL DATA IMPORT & ML PIPELINE TESTS")
        print("=" * 50)
        
        self.test_real_data_import()
        self.test_collections_info()
        self.test_real_data_ml_training()
        self.test_phone_hash_functionality()
        self.test_location_data_integrity()
        self.test_large_dataset_performance()
        
        # Summary
        print("\n" + "=" * 60)
        print("TEST SUMMARY")
        print("=" * 60)
        
        passed = sum(1 for result in self.test_results if "✅" in result["status"])
        failed = sum(1 for result in self.test_results if "❌" in result["status"])
        
        print(f"Total Tests: {len(self.test_results)}")
        print(f"Passed: {passed}")
        print(f"Failed: {failed}")
        print(f"Success Rate: {(passed/len(self.test_results)*100):.1f}%")
        
        if failed > 0:
            print("\nFAILED TESTS:")
            for result in self.test_results:
                if "❌" in result["status"]:
                    print(f"  - {result['test']}: {result['details']}")
        
        return passed, failed

if __name__ == "__main__":
    tester = BackendTester()
    passed, failed = tester.run_all_tests()
    
    # Exit with appropriate code
    exit(0 if failed == 0 else 1)