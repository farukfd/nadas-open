#!/usr/bin/env python3
"""
Focused Backfill System Test
Tests the backfill system with properly formatted test data
"""

import requests
import json
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
from datetime import datetime, timedelta
import pandas as pd

# Load environment
load_dotenv('backend/.env')

BACKEND_URL = "https://realty-analysis-1.preview.emergentagent.com/api"

class BackfillSystemTester:
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
    
    def make_request(self, method: str, endpoint: str, data: dict = None, headers: dict = None, timeout: int = 30) -> tuple:
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
    
    async def setup_test_data(self):
        """Setup properly formatted test data for backfill testing"""
        client = AsyncIOMotorClient(os.environ['MONGO_URL'])
        db = client[os.environ['DB_NAME']]
        
        # Clear existing backfill test data
        await db.backfill_test_data.delete_many({})
        
        # Create test data with gaps for backfill testing
        test_data = []
        
        # Create data for Istanbul (34001) with intentional gaps
        location_code = "34001"
        base_price = 5000
        
        # Add data for 2023-2025 (current data)
        current_dates = pd.date_range(start='2023-01-01', end='2025-08-01', freq='M')
        for i, date in enumerate(current_dates):
            test_data.append({
                'location_code': location_code,
                'property_type': 'residential_sale',
                'date': date.strftime('%Y-%m-%d'),
                'price_per_m2': base_price + i * 50 + (i % 12) * 100,  # Trend + seasonality
                'is_predicted': False,
                'data_source': 'test_current'
            })
        
        # Add some data for 2020-2021 (leaving 2016-2019 and 2022 as gaps)
        historical_dates = pd.date_range(start='2020-01-01', end='2021-12-01', freq='M')
        for i, date in enumerate(historical_dates):
            test_data.append({
                'location_code': location_code,
                'property_type': 'residential_sale', 
                'date': date.strftime('%Y-%m-%d'),
                'price_per_m2': base_price - 1000 + i * 30,
                'is_predicted': False,
                'data_source': 'test_historical'
            })
        
        # Insert test data
        if test_data:
            await db.backfill_test_data.insert_many(test_data)
            print(f"✅ Inserted {len(test_data)} test records for backfill testing")
        
        client.close()
        return len(test_data)
    
    def login(self):
        """Login to get auth token"""
        login_data = {
            "email": "test@example.com",
            "password": "test123"
        }
        
        success, data, status_code = self.make_request("POST", "/auth/login", login_data)
        
        if success and status_code == 200 and "token" in data:
            self.auth_token = data["token"]
            return True
        return False
    
    def test_backfill_with_test_data(self):
        """Test backfill system with properly formatted test data"""
        if not self.auth_token:
            self.log_test("Backfill Test Data Setup", False, "No auth token available")
            return
        
        headers = {"Authorization": f"Bearer {self.auth_token}"}
        
        # Test missing period detection with test data
        detection_request = {
            "start_date": "2016-01-01",
            "end_date": "2022-12-31",
            "current_data_months": 24  # Use last 24 months as current data
        }
        
        print("\n🔍 Testing backfill with formatted test data...")
        success, data, status_code = self.make_request("POST", "/admin/backfill/detect-missing", detection_request, headers, timeout=60)
        
        if success and status_code == 200:
            if data.get("success"):
                missing_periods = data.get("missing_periods", {})
                stats = data.get("statistics", {})
                
                locations_with_missing = stats.get("locations_with_missing_data", 0)
                total_missing = stats.get("total_missing_periods", 0)
                
                self.log_test("Backfill Missing Period Detection (Test Data)", True, 
                            f"Found {locations_with_missing} locations with {total_missing} missing periods")
            else:
                self.log_test("Backfill Missing Period Detection (Test Data)", False, 
                            f"Detection failed: {data.get('error', 'Unknown error')}")
        else:
            self.log_test("Backfill Missing Period Detection (Test Data)", False, 
                        f"Status: {status_code}, Data: {data}")
    
    def test_backfill_api_endpoints(self):
        """Test all backfill API endpoints for basic functionality"""
        if not self.auth_token:
            self.log_test("Backfill API Endpoints", False, "No auth token available")
            return
        
        headers = {"Authorization": f"Bearer {self.auth_token}"}
        
        # Test 1: Missing period detection endpoint
        detection_request = {
            "start_date": "2020-01-01",
            "end_date": "2021-12-31",
            "current_data_months": 12
        }
        
        success, data, status_code = self.make_request("POST", "/admin/backfill/detect-missing", detection_request, headers, timeout=30)
        
        if success and status_code == 200:
            self.log_test("Backfill Detection API", True, "Missing period detection endpoint responding")
        else:
            self.log_test("Backfill Detection API", False, f"Status: {status_code}")
        
        # Test 2: Backfill execution endpoint
        backfill_request = {
            "start_date": "2021-01-01",
            "end_date": "2021-06-30",
            "current_data_months": 6,
            "models_to_use": ["prophet"]
        }
        
        success, data, status_code = self.make_request("POST", "/admin/backfill/run", backfill_request, headers, timeout=60)
        
        if success and status_code == 200:
            self.log_test("Backfill Execution API", True, "Backfill execution endpoint responding")
        else:
            self.log_test("Backfill Execution API", False, f"Status: {status_code}")
        
        # Test 3: Results retrieval endpoint
        success, data, status_code = self.make_request("GET", "/admin/backfill/results", headers=headers, timeout=30)
        
        if success and status_code == 200:
            self.log_test("Backfill Results API", True, "Results retrieval endpoint responding")
        else:
            self.log_test("Backfill Results API", False, f"Status: {status_code}")
        
        # Test 4: Visualization endpoint
        success, data, status_code = self.make_request("GET", "/admin/backfill/visualization?location_code=34001", headers=headers, timeout=30)
        
        if success and status_code == 200:
            self.log_test("Backfill Visualization API", True, "Visualization endpoint responding")
        else:
            self.log_test("Backfill Visualization API", False, f"Status: {status_code}")
    
    def test_backfill_error_handling(self):
        """Test backfill system error handling"""
        if not self.auth_token:
            self.log_test("Backfill Error Handling", False, "No auth token available")
            return
        
        headers = {"Authorization": f"Bearer {self.auth_token}"}
        
        # Test with invalid date range
        invalid_request = {
            "start_date": "2025-01-01",  # Future date
            "end_date": "2026-12-31",
            "current_data_months": 12
        }
        
        success, data, status_code = self.make_request("POST", "/admin/backfill/detect-missing", invalid_request, headers, timeout=30)
        
        # Should handle gracefully (either error or empty result)
        if success and (status_code == 200 or status_code in [400, 422]):
            self.log_test("Backfill Error Handling", True, "Invalid date range handled properly")
        else:
            self.log_test("Backfill Error Handling", False, f"Unexpected response: {status_code}")
    
    async def run_all_tests(self):
        """Run all backfill system tests"""
        print("=" * 60)
        print("BACKFILL SYSTEM FOCUSED TESTS")
        print("=" * 60)
        print(f"Testing API at: {self.base_url}")
        print()
        
        # Setup test data
        print("Setting up test data...")
        test_records = await self.setup_test_data()
        
        # Login
        if not self.login():
            print("❌ Failed to login - cannot continue tests")
            return
        
        # Run tests
        self.test_backfill_api_endpoints()
        self.test_backfill_with_test_data()
        self.test_backfill_error_handling()
        
        # Summary
        print("\n" + "=" * 60)
        print("BACKFILL SYSTEM TEST SUMMARY")
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
    async def main():
        tester = BackfillSystemTester()
        passed, failed = await tester.run_all_tests()
        exit(0 if failed == 0 else 1)
    
    asyncio.run(main())