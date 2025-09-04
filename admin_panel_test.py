#!/usr/bin/env python3
"""
Admin Panel Comprehensive Test Suite
Tests all admin panel functionality as requested in the review.
"""

import requests
import json
import time
import base64
from typing import Dict, Any, Optional

# Get backend URL from environment
BACKEND_URL = "https://realty-analysis-1.preview.emergentagent.com/api"

class AdminPanelTester:
    def __init__(self):
        self.base_url = BACKEND_URL
        self.admin_token = None
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
    
    def make_request(self, method: str, endpoint: str, data: Dict = None, headers: Dict = None, timeout: int = 30) -> tuple:
        """Make HTTP request and return (success, response_data, status_code)"""
        url = f"{self.base_url}{endpoint}"
        
        try:
            if method.upper() == "GET":
                response = requests.get(url, headers=headers, timeout=timeout)
            elif method.upper() == "POST":
                response = requests.post(url, json=data, headers=headers, timeout=timeout)
            else:
                return False, f"Unsupported method: {method}", 0
                
            return True, response.json() if response.content else {}, response.status_code
            
        except requests.exceptions.RequestException as e:
            return False, f"Request failed: {str(e)}", 0
        except json.JSONDecodeError:
            return False, "Invalid JSON response", response.status_code if 'response' in locals() else 0
    
    def test_admin_login(self):
        """Test admin authentication with superadmin credentials"""
        print("\n🔐 Testing Admin Authentication Flow...")
        
        admin_credentials = {
            "username": "superadmin",
            "password": "emlakadmin2025"
        }
        
        success, data, status_code = self.make_request("POST", "/admin/login", admin_credentials)
        
        if success and status_code == 200 and "token" in data:
            self.admin_token = data["token"]
            admin_info = data.get("admin", {})
            self.log_test("Admin Login", True, f"Admin: {admin_info.get('username')}, Type: {admin_info.get('type')}")
            
            # Verify token is properly stored
            if self.admin_token and len(self.admin_token) > 50:
                self.log_test("Admin Token Storage", True, f"Token length: {len(self.admin_token)} characters")
            else:
                self.log_test("Admin Token Storage", False, "Token not properly stored")
        else:
            self.log_test("Admin Login", False, f"Status: {status_code}, Data: {data}")
    
    def test_admin_token_validation(self):
        """Test admin token validation and access control"""
        print("\n🛡️ Testing Admin Token Validation...")
        
        if not self.admin_token:
            self.log_test("Admin Token Validation", False, "No admin token available")
            return
        
        # Test admin access with valid token
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        success, data, status_code = self.make_request("GET", "/admin/stats", headers=headers)
        
        if success and status_code == 200:
            self.log_test("Admin Token Validation", True, "Admin token properly validated for protected endpoints")
        else:
            self.log_test("Admin Token Validation", False, f"Admin token validation failed: {status_code}")
    
    def test_admin_dashboard_stats(self):
        """Test admin dashboard statistics endpoint"""
        print("\n📊 Testing Admin Dashboard Stats...")
        
        if not self.admin_token:
            self.log_test("Admin Dashboard Stats", False, "No admin token available")
            return
            
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        success, data, status_code = self.make_request("GET", "/admin/stats", headers=headers)
        
        if success and status_code == 200:
            required_fields = ['total_users', 'active_users', 'total_locations', 'total_price_records']
            missing_fields = [field for field in required_fields if field not in data]
            
            if not missing_fields:
                self.log_test("Admin Dashboard Stats", True, 
                            f"Users: {data.get('total_users')}, Locations: {data.get('total_locations')}, Records: {data.get('total_price_records')}")
            else:
                self.log_test("Admin Dashboard Stats", False, f"Missing fields: {missing_fields}")
        else:
            self.log_test("Admin Dashboard Stats", False, f"Status: {status_code}, Data: {data}")
    
    def test_admin_users_management(self):
        """Test admin users management endpoint"""
        print("\n👥 Testing Admin Users Management...")
        
        if not self.admin_token:
            self.log_test("Admin Users Management", False, "No admin token available")
            return
            
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        success, data, status_code = self.make_request("GET", "/admin/users", headers=headers)
        
        if success and status_code == 200 and "users" in data:
            users = data["users"]
            
            # Check if users have required fields
            if users and len(users) > 0:
                first_user = users[0]
                required_fields = ['id', 'email', 'first_name', 'last_name', 'user_type']
                missing_fields = [field for field in required_fields if field not in first_user]
                
                if not missing_fields:
                    self.log_test("Admin Users Management", True, f"Retrieved {len(users)} users with complete data")
                else:
                    self.log_test("Admin Users Management", False, f"User data missing fields: {missing_fields}")
            else:
                self.log_test("Admin Users Management", False, "No users found in database")
        else:
            self.log_test("Admin Users Management", False, f"Status: {status_code}, Data: {data}")
    
    def test_admin_models_listing(self):
        """Test admin ML models listing"""
        print("\n🤖 Testing Admin ML Models Listing...")
        
        if not self.admin_token:
            self.log_test("Admin ML Models", False, "No admin token available")
            return
            
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        success, data, status_code = self.make_request("GET", "/admin/models", headers=headers)
        
        if success and status_code == 200:
            models = data.get("models", [])
            self.log_test("Admin ML Models", True, f"Found {len(models)} trained models")
        else:
            self.log_test("Admin ML Models", False, f"Status: {status_code}, Data: {data}")
    
    def test_sample_data_generation(self):
        """Test sample data generation for ML training"""
        print("\n📈 Testing Sample Data Generation...")
        
        if not self.admin_token:
            self.log_test("Sample Data Generation", False, "No admin token available")
            return
            
        headers = {"Authorization": f"Bearer {self.admin_token}"}
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
                    self.log_test("Sample Data Generation", True, 
                                f"Generated {total_records} records with trends and seasonality")
                else:
                    self.log_test("Sample Data Generation", False, f"Missing required fields: {missing_fields}")
            else:
                self.log_test("Sample Data Generation", False, "No sample data generated")
        else:
            self.log_test("Sample Data Generation", False, f"Status: {status_code}, Data: {data}")
    
    def test_ml_model_training(self):
        """Test ML model training with Linear Regression"""
        print("\n🧠 Testing ML Model Training...")
        
        if not self.admin_token:
            self.log_test("ML Model Training", False, "No admin token available")
            return
        
        # First get sample data
        headers = {"Authorization": f"Bearer {self.admin_token}"}
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
    
    def test_csv_upload_feature(self):
        """Test CSV upload functionality for admin panel"""
        print("\n📄 Testing CSV Upload Feature...")
        
        if not self.admin_token:
            self.log_test("CSV Upload Feature", False, "No admin token available")
            return
        
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        # Create sample CSV data for users
        csv_content = """email,first_name,last_name,user_type
test_csv1@example.com,Ahmet,Yılmaz,individual
test_csv2@example.com,Mehmet,Özkan,corporate
test_csv3@example.com,Ayşe,Demir,individual"""
        
        # Encode to base64
        csv_base64 = base64.b64encode(csv_content.encode('utf-8')).decode('utf-8')
        
        upload_request = {
            "file_content": csv_base64,
            "file_name": "test_users.csv",
            "data_type": "users"
        }
        
        success, data, status_code = self.make_request("POST", "/admin/data/upload-csv", upload_request, headers)
        
        if success and status_code == 200:
            records_processed = data.get("records_processed", 0)
            total_rows = data.get("total_rows", 0)
            errors_count = data.get("errors_count", 0)
            
            if records_processed > 0:
                self.log_test("CSV Upload Feature", True, 
                            f"Processed {records_processed}/{total_rows} records, {errors_count} errors")
            else:
                self.log_test("CSV Upload Feature", False, f"No records processed from CSV upload")
        else:
            self.log_test("CSV Upload Feature", False, f"Status: {status_code}, Data: {data}")
    
    def test_real_data_import(self):
        """Test real data import functionality"""
        print("\n🗄️ Testing Real Data Import...")
        
        if not self.admin_token:
            self.log_test("Real Data Import", False, "No admin token available")
            return
        
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        print("   Starting real data import (this may take several minutes)...")
        success, data, status_code = self.make_request("POST", "/admin/data/import-real", {}, headers, timeout=600)
        
        if success and status_code == 200:
            if data.get("success"):
                stats = data.get("statistics", {})
                total_lines = stats.get("total_lines", 0)
                imported_records = stats.get("imported_records", 0)
                success_rate = stats.get("success_rate", 0)
                
                if imported_records > 100000:  # At least 100K records
                    self.log_test("Real Data Import", True, 
                                f"Imported {imported_records:,} records from {total_lines:,} lines. Success rate: {success_rate:.1f}%")
                else:
                    self.log_test("Real Data Import", False, 
                                f"Low import volume: {imported_records:,} records (expected >100K)")
            else:
                self.log_test("Real Data Import", False, f"Import failed: {data.get('error', 'Unknown error')}")
        else:
            self.log_test("Real Data Import", False, f"Status: {status_code}, Data: {data}")
    
    def test_collections_info(self):
        """Test collections info API"""
        print("\n📋 Testing Collections Info...")
        
        if not self.admin_token:
            self.log_test("Collections Info", False, "No admin token available")
            return
        
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        success, data, status_code = self.make_request("GET", "/admin/data/collections-info", headers=headers, timeout=60)
        
        if success and status_code == 200:
            if data.get("success"):
                collections = data.get("collections", {})
                total_collections = data.get("total_collections", 0)
                
                # Calculate total records across all collections
                total_records = sum(coll.get('count', 0) for coll in collections.values())
                
                self.log_test("Collections Info", True, 
                            f"Found {total_collections} collections with {total_records:,} total records")
            else:
                self.log_test("Collections Info", False, f"Failed to get collections info: {data.get('error', 'Unknown error')}")
        else:
            self.log_test("Collections Info", False, f"Status: {status_code}, Data: {data}")
    
    def test_backfill_detect_missing_periods(self):
        """Test backfill missing period detection"""
        print("\n🔍 Testing Backfill Missing Period Detection...")
        
        if not self.admin_token:
            self.log_test("Backfill Missing Period Detection", False, "No admin token available")
            return
        
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        detection_request = {
            "start_date": "2016-01-01",
            "end_date": "2022-12-31",
            "current_data_months": 12
        }
        
        print("   Detecting missing periods in historical data (2016-2022)...")
        success, data, status_code = self.make_request("POST", "/admin/backfill/detect-missing", detection_request, headers, timeout=120)
        
        if success and status_code == 200:
            if data.get("success"):
                stats = data.get("statistics", {})
                locations_with_missing = stats.get("locations_with_missing_data", 0)
                total_missing = stats.get("total_missing_periods", 0)
                
                self.log_test("Backfill Missing Period Detection", True, 
                            f"Found {locations_with_missing} locations with {total_missing} missing periods")
            else:
                self.log_test("Backfill Missing Period Detection", False, f"Detection failed: {data.get('error', 'Unknown error')}")
        else:
            self.log_test("Backfill Missing Period Detection", False, f"Status: {status_code}, Data: {data}")
    
    def test_backfill_pipeline_execution(self):
        """Test backfill pipeline execution"""
        print("\n🚀 Testing Backfill Pipeline Execution...")
        
        if not self.admin_token:
            self.log_test("Backfill Pipeline Execution", False, "No admin token available")
            return
        
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        backfill_request = {
            "start_date": "2020-01-01",
            "end_date": "2021-12-31",
            "current_data_months": 12,
            "confidence_threshold": 0.7,
            "models_to_use": ["prophet", "xgboost"]
        }
        
        print("   Running backfill pipeline with Prophet + XGBoost models...")
        success, data, status_code = self.make_request("POST", "/admin/backfill/run", backfill_request, headers, timeout=300)
        
        if success and status_code == 200:
            if data.get("success"):
                backfilled_locations = data.get("backfilled_locations", 0)
                total_predictions = data.get("total_predictions", 0)
                avg_confidence = data.get("avg_confidence", 0)
                models_used = data.get("models_used", [])
                
                self.log_test("Backfill Pipeline Execution", True, 
                            f"Backfilled {backfilled_locations} locations, {total_predictions} predictions, avg confidence: {avg_confidence:.3f}")
            else:
                self.log_test("Backfill Pipeline Execution", False, f"Pipeline failed: {data.get('error', 'Unknown error')}")
        else:
            self.log_test("Backfill Pipeline Execution", False, f"Status: {status_code}, Data: {data}")
    
    def test_backfill_visualization(self):
        """Test backfill visualization API"""
        print("\n📊 Testing Backfill Visualization...")
        
        if not self.admin_token:
            self.log_test("Backfill Visualization", False, "No admin token available")
            return
        
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        # Test visualization for Istanbul location
        test_location = "34001"
        test_session = "test_session_123"
        
        success, data, status_code = self.make_request("GET", 
            f"/admin/backfill/visualization?location_code={test_location}&session_id={test_session}", 
            headers=headers, timeout=60)
        
        if success and status_code == 200:
            visualization = data.get("visualization")
            stats = data.get("statistics", {})
            
            if visualization:
                self.log_test("Backfill Visualization", True, 
                            f"Generated visualization for location {test_location}")
            else:
                self.log_test("Backfill Visualization", False, 
                            f"No visualization data for location {test_location}")
        else:
            self.log_test("Backfill Visualization", False, f"Status: {status_code}, Data: {data}")
    
    def run_admin_panel_tests(self):
        """Run all admin panel tests"""
        print("=" * 80)
        print("🔧 ADMIN PANEL COMPREHENSIVE FUNCTIONALITY TEST")
        print("=" * 80)
        print(f"Testing API at: {self.base_url}")
        print()
        
        # 1. Admin Authentication Flow
        print("🔐 ADMIN AUTHENTICATION FLOW")
        print("-" * 40)
        self.test_admin_login()
        self.test_admin_token_validation()
        
        # 2. Admin Panel Core Features
        print("\n📊 ADMIN PANEL CORE FEATURES")
        print("-" * 40)
        self.test_admin_dashboard_stats()
        self.test_admin_users_management()
        self.test_admin_models_listing()
        self.test_sample_data_generation()
        self.test_ml_model_training()
        
        # 3. Advanced Admin Features
        print("\n🚀 ADVANCED ADMIN FEATURES")
        print("-" * 40)
        self.test_real_data_import()
        self.test_collections_info()
        self.test_backfill_detect_missing_periods()
        self.test_backfill_pipeline_execution()
        self.test_backfill_visualization()
        
        # 4. CSV Upload Feature
        print("\n📄 CSV UPLOAD FEATURE")
        print("-" * 40)
        self.test_csv_upload_feature()
        
        # Summary
        print("\n" + "=" * 80)
        print("📋 ADMIN PANEL TEST SUMMARY")
        print("=" * 80)
        
        passed = sum(1 for result in self.test_results if "✅" in result["status"])
        failed = sum(1 for result in self.test_results if "❌" in result["status"])
        
        print(f"Total Tests: {len(self.test_results)}")
        print(f"Passed: {passed}")
        print(f"Failed: {failed}")
        print(f"Success Rate: {(passed/len(self.test_results)*100):.1f}%")
        
        if failed > 0:
            print("\n❌ FAILED TESTS:")
            for result in self.test_results:
                if "❌" in result["status"]:
                    print(f"  - {result['test']}: {result['details']}")
        
        print("\n✅ PASSED TESTS:")
        for result in self.test_results:
            if "✅" in result["status"]:
                print(f"  - {result['test']}")
        
        return passed, failed

if __name__ == "__main__":
    tester = AdminPanelTester()
    passed, failed = tester.run_admin_panel_tests()
    
    # Exit with appropriate code
    exit(0 if failed == 0 else 1)