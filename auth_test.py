#!/usr/bin/env python3
"""
Authentication System Test Suite - Focused on User Reported Issues
Tests specific authentication problems reported by the user:
1. Live monitoring not working (health check)
2. Can't access user profile after login
3. Can't login to admin panel
"""

import requests
import json
import time
from typing import Dict, Any, Optional

# Get backend URL from environment
BACKEND_URL = "https://realty-analysis-1.preview.emergentagent.com/api"

class AuthenticationTester:
    def __init__(self):
        self.base_url = BACKEND_URL
        self.user_token = None
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
    
    def test_health_check(self):
        """Test 1: Health check endpoint - Live monitoring"""
        print("\n🔍 Testing Health Check (Live Monitoring)...")
        success, data, status_code = self.make_request("GET", "/health")
        
        if success and status_code == 200:
            if data.get("status") == "healthy" and "timestamp" in data:
                self.log_test("Health Check - Live Monitoring", True, 
                            f"API is healthy, timestamp: {data.get('timestamp')}")
            else:
                self.log_test("Health Check - Live Monitoring", False, 
                            f"Unhealthy response: {data}")
        else:
            self.log_test("Health Check - Live Monitoring", False, 
                        f"Status: {status_code}, Error: {data}")
    
    def test_mongodb_connection(self):
        """Test MongoDB connection through admin stats"""
        print("\n🔍 Testing MongoDB Connection...")
        
        # First need admin token
        if not self.admin_token:
            self.test_admin_login()
        
        if not self.admin_token:
            self.log_test("MongoDB Connection", False, "No admin token available")
            return
            
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        success, data, status_code = self.make_request("GET", "/admin/stats", headers=headers)
        
        if success and status_code == 200:
            # Check if we can get database statistics
            total_users = data.get("total_users", 0)
            total_locations = data.get("total_locations", 0)
            
            if isinstance(total_users, int) and isinstance(total_locations, int):
                self.log_test("MongoDB Connection", True, 
                            f"Database accessible - Users: {total_users}, Locations: {total_locations}")
            else:
                self.log_test("MongoDB Connection", False, 
                            f"Invalid database response: {data}")
        else:
            self.log_test("MongoDB Connection", False, 
                        f"Cannot access database - Status: {status_code}, Error: {data}")
    
    def test_admin_login(self):
        """Test 2: Admin login system"""
        print("\n🔍 Testing Admin Login System...")
        
        admin_credentials = {
            "username": "superadmin",
            "password": "emlakadmin2025"
        }
        
        success, data, status_code = self.make_request("POST", "/admin/login", admin_credentials)
        
        if success and status_code == 200:
            if "token" in data and data.get("admin", {}).get("is_admin") == True:
                self.admin_token = data["token"]
                admin_info = data.get("admin", {})
                self.log_test("Admin Login", True, 
                            f"Admin: {admin_info.get('username')}, Type: {admin_info.get('type')}")
            else:
                self.log_test("Admin Login", False, 
                            f"Invalid admin login response: {data}")
        else:
            self.log_test("Admin Login", False, 
                        f"Status: {status_code}, Error: {data}")
    
    def test_admin_endpoints_access(self):
        """Test admin endpoints access after login"""
        print("\n🔍 Testing Admin Endpoints Access...")
        
        if not self.admin_token:
            self.log_test("Admin Endpoints Access", False, "No admin token available")
            return
            
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        # Test admin stats endpoint
        success, data, status_code = self.make_request("GET", "/admin/stats", headers=headers)
        
        if success and status_code == 200:
            required_fields = ['total_users', 'active_users', 'total_locations', 'system_status']
            missing_fields = [field for field in required_fields if field not in data]
            
            if not missing_fields:
                self.log_test("Admin Endpoints Access", True, 
                            f"Admin stats accessible - System: {data.get('system_status')}")
            else:
                self.log_test("Admin Endpoints Access", False, 
                            f"Missing admin stats fields: {missing_fields}")
        else:
            self.log_test("Admin Endpoints Access", False, 
                        f"Cannot access admin stats - Status: {status_code}")
    
    def test_user_login(self):
        """Test 3: User login with sample credentials"""
        print("\n🔍 Testing User Login...")
        
        user_credentials = {
            "email": "test@example.com",
            "password": "test123"
        }
        
        success, data, status_code = self.make_request("POST", "/auth/login", user_credentials)
        
        if success and status_code == 200:
            if "token" in data and "user" in data:
                self.user_token = data["token"]
                user_info = data.get("user", {})
                self.log_test("User Login", True, 
                            f"User: {user_info.get('email')}, Type: {user_info.get('user_type')}")
            else:
                self.log_test("User Login", False, 
                            f"Invalid user login response: {data}")
        else:
            self.log_test("User Login", False, 
                        f"Status: {status_code}, Error: {data}")
    
    def test_user_profile_access(self):
        """Test 4: User profile access after login"""
        print("\n🔍 Testing User Profile Access After Login...")
        
        if not self.user_token:
            self.log_test("User Profile Access", False, "No user token available")
            return
            
        headers = {"Authorization": f"Bearer {self.user_token}"}
        success, data, status_code = self.make_request("GET", "/user/profile", headers=headers)
        
        if success and status_code == 200:
            required_fields = ['id', 'email', 'first_name', 'last_name', 'user_type']
            missing_fields = [field for field in required_fields if field not in data]
            
            if not missing_fields:
                self.log_test("User Profile Access", True, 
                            f"Profile: {data.get('email')}, Queries: {data.get('query_count')}/{data.get('query_limit')}")
            else:
                self.log_test("User Profile Access", False, 
                            f"Missing profile fields: {missing_fields}")
        else:
            self.log_test("User Profile Access", False, 
                        f"Cannot access profile - Status: {status_code}, Error: {data}")
    
    def test_token_validation(self):
        """Test token validation functionality"""
        print("\n🔍 Testing Token Validation...")
        
        # Test valid token
        if self.user_token:
            headers = {"Authorization": f"Bearer {self.user_token}"}
            success, data, status_code = self.make_request("GET", "/user/profile", headers=headers)
            
            if success and status_code == 200:
                self.log_test("Valid Token Validation", True, "Valid token accepted")
            else:
                self.log_test("Valid Token Validation", False, f"Valid token rejected - Status: {status_code}")
        
        # Test invalid token
        invalid_headers = {"Authorization": "Bearer invalid_token_12345"}
        success, data, status_code = self.make_request("GET", "/user/profile", headers=invalid_headers)
        
        if status_code == 401:
            self.log_test("Invalid Token Validation", True, "Invalid token properly rejected")
        else:
            self.log_test("Invalid Token Validation", False, f"Invalid token not rejected - Status: {status_code}")
        
        # Test missing token
        success, data, status_code = self.make_request("GET", "/user/profile")
        
        if status_code in [401, 403]:
            self.log_test("Missing Token Validation", True, "Missing token properly rejected")
        else:
            self.log_test("Missing Token Validation", False, f"Missing token not rejected - Status: {status_code}")
    
    def test_invalid_credentials_scenarios(self):
        """Test error scenarios with invalid credentials"""
        print("\n🔍 Testing Invalid Credentials Scenarios...")
        
        # Test invalid user login
        invalid_user = {
            "email": "nonexistent@example.com",
            "password": "wrongpassword"
        }
        
        success, data, status_code = self.make_request("POST", "/auth/login", invalid_user)
        
        if status_code == 401:
            self.log_test("Invalid User Credentials", True, "Invalid user credentials properly rejected")
        else:
            self.log_test("Invalid User Credentials", False, f"Invalid credentials not rejected - Status: {status_code}")
        
        # Test invalid admin login
        invalid_admin = {
            "username": "wrongadmin",
            "password": "wrongpassword"
        }
        
        success, data, status_code = self.make_request("POST", "/admin/login", invalid_admin)
        
        if status_code == 401:
            self.log_test("Invalid Admin Credentials", True, "Invalid admin credentials properly rejected")
        else:
            self.log_test("Invalid Admin Credentials", False, f"Invalid admin credentials not rejected - Status: {status_code}")
    
    def test_non_admin_access_to_admin_endpoints(self):
        """Test that regular users cannot access admin endpoints"""
        print("\n🔍 Testing Non-Admin Access to Admin Endpoints...")
        
        if not self.user_token:
            self.log_test("Non-Admin Access Block", False, "No user token available")
            return
            
        # Try to access admin endpoint with user token
        headers = {"Authorization": f"Bearer {self.user_token}"}
        success, data, status_code = self.make_request("GET", "/admin/stats", headers=headers)
        
        if status_code == 403:
            self.log_test("Non-Admin Access Block", True, "Regular user properly blocked from admin endpoints")
        elif status_code == 401:
            self.log_test("Non-Admin Access Block", True, "Regular user token rejected for admin access")
        else:
            self.log_test("Non-Admin Access Block", False, f"Regular user not blocked - Status: {status_code}")
    
    def test_expired_token_scenario(self):
        """Test expired token handling (simulated)"""
        print("\n🔍 Testing Expired Token Scenario...")
        
        # Use a malformed JWT that looks expired
        expired_token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoidGVzdCIsImV4cCI6MTYwMDAwMDAwMH0.invalid"
        headers = {"Authorization": f"Bearer {expired_token}"}
        
        success, data, status_code = self.make_request("GET", "/user/profile", headers=headers)
        
        if status_code == 401:
            self.log_test("Expired Token Handling", True, "Expired/invalid token properly rejected")
        else:
            self.log_test("Expired Token Handling", False, f"Expired token not handled - Status: {status_code}")
    
    def run_authentication_tests(self):
        """Run all authentication-focused tests"""
        print("=" * 70)
        print("AUTHENTICATION SYSTEM TEST SUITE - USER REPORTED ISSUES")
        print("=" * 70)
        print(f"Testing API at: {self.base_url}")
        print()
        
        # Test 1: Live monitoring (health check)
        print("🔍 ISSUE 1: Canlı izleme çalışmıyor (Live monitoring not working)")
        self.test_health_check()
        self.test_mongodb_connection()
        
        # Test 2: Admin panel login
        print("\n🔍 ISSUE 2: Admin paneline giriş yapamıyorum (Can't login to admin panel)")
        self.test_admin_login()
        self.test_admin_endpoints_access()
        
        # Test 3: User profile access after login
        print("\n🔍 ISSUE 3: Üyelik giriş yapıldıktan sonra kullanıcı profiline ulaşamıyorum")
        print("(Can't access user profile after login)")
        self.test_user_login()
        self.test_user_profile_access()
        
        # Additional authentication tests
        print("\n🔍 ADDITIONAL AUTHENTICATION TESTS:")
        self.test_token_validation()
        self.test_invalid_credentials_scenarios()
        self.test_non_admin_access_to_admin_endpoints()
        self.test_expired_token_scenario()
        
        # Summary
        print("\n" + "=" * 70)
        print("AUTHENTICATION TEST SUMMARY")
        print("=" * 70)
        
        passed = sum(1 for result in self.test_results if "✅" in result["status"])
        failed = sum(1 for result in self.test_results if "❌" in result["status"])
        
        print(f"Total Tests: {len(self.test_results)}")
        print(f"Passed: {passed}")
        print(f"Failed: {failed}")
        print(f"Success Rate: {(passed/len(self.test_results)*100):.1f}%")
        
        # Detailed results for each reported issue
        print("\n📋 DETAILED RESULTS FOR REPORTED ISSUES:")
        
        # Issue 1: Live monitoring
        health_tests = [r for r in self.test_results if "Health" in r["test"] or "MongoDB" in r["test"]]
        health_passed = sum(1 for r in health_tests if "✅" in r["status"])
        print(f"1. Live Monitoring: {health_passed}/{len(health_tests)} tests passed")
        
        # Issue 2: Admin login
        admin_tests = [r for r in self.test_results if "Admin" in r["test"]]
        admin_passed = sum(1 for r in admin_tests if "✅" in r["status"])
        print(f"2. Admin Panel Access: {admin_passed}/{len(admin_tests)} tests passed")
        
        # Issue 3: User profile access
        user_tests = [r for r in self.test_results if "User" in r["test"] and "Profile" in r["test"]]
        user_passed = sum(1 for r in user_tests if "✅" in r["status"])
        print(f"3. User Profile Access: {user_passed}/{len(user_tests)} tests passed")
        
        if failed > 0:
            print("\n❌ FAILED TESTS:")
            for result in self.test_results:
                if "❌" in result["status"]:
                    print(f"  - {result['test']}: {result['details']}")
        
        print("\n📊 RECOMMENDATIONS:")
        if health_passed < len(health_tests):
            print("- Check backend server status and MongoDB connection")
        if admin_passed < len(admin_tests):
            print("- Verify admin credentials and admin authentication system")
        if user_passed < len(user_tests):
            print("- Check user authentication flow and token validation")
        
        return passed, failed

if __name__ == "__main__":
    tester = AuthenticationTester()
    passed, failed = tester.run_authentication_tests()
    
    # Exit with appropriate code
    exit(0 if failed == 0 else 1)