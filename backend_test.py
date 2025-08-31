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
BACKEND_URL = "https://mobilize-web.preview.emergentagent.com/api"

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
        
        # Test individual user registration
        individual_user = {
            "email": "test_individual@example.com",
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
            "email": "test_corporate@example.com", 
            "password": "testpass123",
            "first_name": "Mehmet",
            "last_name": "Özkan",
            "user_type": "corporate",
            "company_name": "Emlak Şirketi A.Ş.",
            "phone": "+905559876543"
        }
        
        success, data, status_code = self.make_request("POST", "/auth/register", corporate_user)
        
        if success and status_code == 200 and "token" in data:
            self.log_test("Corporate User Registration", True, f"Company: {data.get('user', {}).get('company_name', 'N/A')}")
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
            "mahalle": "Fenerbahçe", 
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
            query_data["mahalle"] = "Merkez"
            success, data, status_code = self.make_request("POST", "/query/protected", query_data, headers)
            
            if success and status_code == 200:
                self.log_test("Protected Query (Fallback)", True, f"Found data for Merkez neighborhood")
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
            "ilce": "Kadıköy",
            "mahalle": "Merkez",
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