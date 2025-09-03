from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timedelta
import bcrypt
import jwt
from enum import Enum
import numpy as np
from ml_pipeline import ml_pipeline, MLModelType
from sql_data_importer import import_ee2401_data
from backfill_pipeline import run_backfill_pipeline, BackfillConfig

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'your-secret-key-here')
JWT_ALGORITHM = 'HS256'
JWT_EXPIRATION_HOURS = 24

security = HTTPBearer()

# Create the main app
app = FastAPI(title="Emlak Endeksi API", description="Emlak Endeksi Mobil Uygulama API")
api_router = APIRouter(prefix="/api")

# Enums
class UserType(str, Enum):
    GUEST = "guest"
    INDIVIDUAL = "individual"  # bireysel
    CORPORATE = "corporate"    # kurumsal

class PropertyType(str, Enum):
    RESIDENTIAL_SALE = "residential_sale"      # satılık konut
    RESIDENTIAL_RENT = "residential_rent"      # kiralık konut
    COMMERCIAL_SALE = "commercial_sale"        # satılık işyeri
    COMMERCIAL_RENT = "commercial_rent"        # kiralık işyeri
    LAND_SALE = "land_sale"                   # satılık arsa

# Models
class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: str
    password_hash: str
    first_name: str
    last_name: str
    user_type: UserType
    phone: Optional[str] = None
    company_name: Optional[str] = None  # For corporate users
    query_count: int = 0
    query_limit: int = 3  # Default for guest users
    created_at: datetime = Field(default_factory=datetime.utcnow)
    is_active: bool = True

class UserCreate(BaseModel):
    email: str
    password: str
    first_name: str
    last_name: str
    user_type: UserType
    phone: Optional[str] = None
    company_name: Optional[str] = None

class UserLogin(BaseModel):
    email: str
    password: str

class Location(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    il: str          # city
    il_code: str     # city code
    ilce: str        # district
    ilce_code: str   # district code
    mahalle: str     # neighborhood
    mahalle_code: str # neighborhood code
    lat: Optional[float] = None
    lng: Optional[float] = None

class PriceIndex(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    location_code: str  # mahalle_code
    property_type: PropertyType
    year: int
    month: int
    avg_price_per_m2: float
    transaction_count: int = 0
    created_at: datetime = Field(default_factory=datetime.utcnow)

class DemographicData(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    location_code: str  # mahalle_code
    population: Optional[int] = None
    avg_income: Optional[float] = None
    education_level: Optional[Dict[str, float]] = None  # {"ilkokul": 30.5, "lise": 40.2, "universite": 29.3}
    age_distribution: Optional[Dict[str, float]] = None
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class QueryRequest(BaseModel):
    il: str
    ilce: str
    mahalle: str
    property_type: PropertyType
    start_year: Optional[int] = 2020
    end_year: Optional[int] = 2025

class QueryResponse(BaseModel):
    location: Location
    price_data: List[PriceIndex]
    demographic_data: Optional[DemographicData] = None
    query_count_remaining: int

# Utility functions
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_jwt_token(user_id: str, user_type: str) -> str:
    payload = {
        'user_id': user_id,
        'user_type': user_type,
        'exp': datetime.utcnow() + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> Dict[str, Any]:
    try:
        token = credentials.credentials
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get('user_id')
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        user = await db.users.find_one({"id": user_id})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# Authentication Routes
@api_router.post("/auth/register")
async def register_user(user_data: UserCreate):
    # Check if user already exists
    existing_user = await db.users.find_one({"email": user_data.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Set query limits based on user type
    query_limit = 3 if user_data.user_type == UserType.GUEST else 5
    
    # Create user
    user = User(
        **user_data.dict(exclude={'password'}),
        password_hash=hash_password(user_data.password),
        query_limit=query_limit
    )
    
    await db.users.insert_one(user.dict())
    
    # Create JWT token
    token = create_jwt_token(user.id, user.user_type.value)
    
    return {
        "message": "User registered successfully",
        "user": {
            "id": user.id,
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "user_type": user.user_type,
            "query_limit": user.query_limit,
            "query_count": user.query_count
        },
        "token": token
    }

@api_router.post("/auth/login")
async def login_user(login_data: UserLogin):
    user = await db.users.find_one({"email": login_data.email})
    if not user or not verify_password(login_data.password, user['password_hash']):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    if not user['is_active']:
        raise HTTPException(status_code=401, detail="Account is deactivated")
    
    token = create_jwt_token(user['id'], user['user_type'])
    
    return {
        "message": "Login successful",
        "user": {
            "id": user['id'],
            "email": user['email'],
            "first_name": user['first_name'],
            "last_name": user['last_name'],
            "user_type": user['user_type'],
            "query_limit": user['query_limit'],
            "query_count": user['query_count']
        },
        "token": token
    }

# Guest query endpoint (no authentication required)
@api_router.post("/query/guest")
async def guest_query(query_data: QueryRequest):
    # Find location
    location = await db.locations.find_one({
        "il": query_data.il,
        "ilce": query_data.ilce,
        "mahalle": query_data.mahalle
    })
    
    if not location:
        raise HTTPException(status_code=404, detail="Location not found")
    
    # Get price data
    price_data = await db.price_indices.find({
        "location_code": location['mahalle_code'],
        "property_type": query_data.property_type.value,
        "year": {"$gte": query_data.start_year, "$lte": query_data.end_year}
    }).sort("year", 1).sort("month", 1).to_list(1000)
    
    # Get demographic data
    demographic_data = await db.demographic_data.find_one({
        "location_code": location['mahalle_code']
    })
    
    return QueryResponse(
        location=Location(**location),
        price_data=[PriceIndex(**price) for price in price_data],
        demographic_data=DemographicData(**demographic_data) if demographic_data else None,
        query_count_remaining=2  # Guest users get 3 queries, this is their first
    )

# Protected query endpoint (requires authentication)
@api_router.post("/query/protected")
async def protected_query(query_data: QueryRequest, current_user: Dict = Depends(get_current_user)):
    # Check query limit
    if current_user['query_count'] >= current_user['query_limit']:
        raise HTTPException(status_code=429, detail="Query limit exceeded. Please upgrade your plan.")
    
    # Find location
    location = await db.locations.find_one({
        "il": query_data.il,
        "ilce": query_data.ilce,
        "mahalle": query_data.mahalle
    })
    
    if not location:
        raise HTTPException(status_code=404, detail="Location not found")
    
    # Get price data
    price_data = await db.price_indices.find({
        "location_code": location['mahalle_code'],
        "property_type": query_data.property_type.value,
        "year": {"$gte": query_data.start_year, "$lte": query_data.end_year}
    }).sort("year", 1).sort("month", 1).to_list(1000)
    
    # Get demographic data
    demographic_data = await db.demographic_data.find_one({
        "location_code": location['mahalle_code']
    })
    
    # Update user query count
    await db.users.update_one(
        {"id": current_user['id']},
        {"$inc": {"query_count": 1}}
    )
    
    return QueryResponse(
        location=Location(**location),
        price_data=[PriceIndex(**price) for price in price_data],
        demographic_data=DemographicData(**demographic_data) if demographic_data else None,
        query_count_remaining=current_user['query_limit'] - current_user['query_count'] - 1
    )

# Location endpoints
@api_router.get("/locations/cities")
async def get_cities():
    cities = await db.locations.distinct("il")
    return {"cities": sorted(cities)}

@api_router.get("/locations/districts/{city}")
async def get_districts(city: str):
    districts = await db.locations.find({"il": city}).distinct("ilce")
    return {"districts": sorted(districts)}

@api_router.get("/locations/neighborhoods/{city}/{district}")
async def get_neighborhoods(city: str, district: str):
    neighborhoods = await db.locations.find({"il": city, "ilce": district}).distinct("mahalle")
    return {"neighborhoods": sorted(neighborhoods)}

# Map endpoints
@api_router.get("/map/locations")
async def get_map_locations():
    """Get all locations with coordinates for map display"""
    locations = await db.locations.find(
        {"lat": {"$exists": True, "$ne": None}, "lng": {"$exists": True, "$ne": None}},
        {"_id": 0}
    ).to_list(1000)
    return {"locations": locations}

@api_router.get("/map/locations/{city}")
async def get_city_map_locations(city: str):
    """Get locations with coordinates for a specific city"""
    locations = await db.locations.find(
        {
            "il": city,
            "lat": {"$exists": True, "$ne": None}, 
            "lng": {"$exists": True, "$ne": None}
        },
        {"_id": 0}
    ).to_list(1000)
    return {"locations": locations}

@api_router.post("/map/price-data")
async def get_map_price_data(location_codes: List[str], property_type: PropertyType):
    """Get latest price data for multiple locations"""
    price_data = {}
    
    for location_code in location_codes:
        latest_price = await db.price_indices.find_one(
            {"location_code": location_code, "property_type": property_type.value},
            sort=[("year", -1), ("month", -1)]
        )
        
        if latest_price:
            price_data[location_code] = {
                "avg_price_per_m2": latest_price["avg_price_per_m2"],
                "year": latest_price["year"],
                "month": latest_price["month"],
                "transaction_count": latest_price.get("transaction_count", 0)
            }
    
    return {"price_data": price_data}

# User profile endpoint
@api_router.get("/user/profile")
async def get_user_profile(current_user: Dict = Depends(get_current_user)):
    return {
        "id": current_user['id'],
        "email": current_user['email'],
        "first_name": current_user['first_name'],
        "last_name": current_user['last_name'],
        "user_type": current_user['user_type'],
        "query_limit": current_user['query_limit'],
        "query_count": current_user['query_count'],
        "company_name": current_user.get('company_name'),
        "tax_number": current_user.get('tax_number'),
        "phone": current_user.get('phone'),
        "phone_verified": current_user.get('phone_verified', False),
        "created_at": current_user['created_at']
    }

# Profile update endpoint
@api_router.put("/user/update-profile")
async def update_user_profile(
    profile_data: dict, 
    current_user: Dict = Depends(get_current_user)
):
    # Update user profile
    update_fields = {}
    
    if 'first_name' in profile_data:
        update_fields['first_name'] = profile_data['first_name'].strip()
    if 'last_name' in profile_data:
        update_fields['last_name'] = profile_data['last_name'].strip()
    if 'phone' in profile_data:
        update_fields['phone'] = profile_data['phone'].strip()
    if 'company_name' in profile_data:
        update_fields['company_name'] = profile_data['company_name'].strip()
    
    if update_fields:
        await db.users.update_one(
            {"id": current_user['id']},
            {"$set": update_fields}
        )
    
    # Return updated user
    updated_user = await db.users.find_one({"id": current_user['id']})
    return {
        "id": updated_user['id'],
        "email": updated_user['email'],
        "first_name": updated_user['first_name'],
        "last_name": updated_user['last_name'],
        "user_type": updated_user['user_type'],
        "query_limit": updated_user['query_limit'],
        "query_count": updated_user['query_count'],
        "company_name": updated_user.get('company_name'),
        "phone": updated_user.get('phone'),
        "phone_verified": updated_user.get('phone_verified', False),
        "created_at": updated_user['created_at']
    }

# Phone verification endpoints
@api_router.post("/user/send-verification-code")
async def send_verification_code(
    phone_data: dict,
    current_user: Dict = Depends(get_current_user)
):
    phone = phone_data.get('phone', '').strip()
    
    # Phone validation
    import re
    phone_regex = r'^(\+90|0)?[5][0-9]{9}$'
    if not re.match(phone_regex, phone.replace(' ', '')):
        raise HTTPException(status_code=400, detail="Geçerli bir telefon numarası girin")
    
    # Generate verification code (in production, use SMS service)
    import random
    verification_code = f"{random.randint(100000, 999999)}"
    
    # Store verification code temporarily (in production, use Redis or cache)
    await db.verification_codes.replace_one(
        {"user_id": current_user['id']},
        {
            "user_id": current_user['id'],
            "phone": phone,
            "code": verification_code,
            "created_at": datetime.utcnow(),
            "expires_at": datetime.utcnow() + timedelta(minutes=5)
        },
        upsert=True
    )
    
    # In production, send SMS here
    logger.info(f"Verification code for {phone}: {verification_code}")
    
    return {"message": "Doğrulama kodu gönderildi", "phone": phone}

@api_router.post("/user/verify-phone")
async def verify_phone_code(
    verification_data: dict,
    current_user: Dict = Depends(get_current_user)
):
    phone = verification_data.get('phone', '').strip()
    code = verification_data.get('verification_code', '').strip()
    
    # Check verification code
    stored_code = await db.verification_codes.find_one({
        "user_id": current_user['id'],
        "phone": phone,
        "expires_at": {"$gt": datetime.utcnow()}
    })
    
    if not stored_code or stored_code['code'] != code:
        raise HTTPException(status_code=400, detail="Geçersiz veya süresi dolmuş kod")
    
    # Update user as phone verified and increase query limit
    new_query_limit = current_user['query_limit'] + 5
    await db.users.update_one(
        {"id": current_user['id']},
        {
            "$set": {
                "phone": phone,
                "phone_verified": True,
                "query_limit": new_query_limit
            }
        }
    )
    
    # Delete verification code
    await db.verification_codes.delete_one({"user_id": current_user['id']})
    
    return {
        "message": "Telefon başarıyla doğrulandı",
        "new_query_limit": new_query_limit,
        "bonus_queries": 5
    }

# Query history endpoint
@api_router.get("/user/query-history")
async def get_query_history(current_user: Dict = Depends(get_current_user)):
    # Get user's query history (you'll need to modify query endpoints to log history)
    history = await db.query_history.find(
        {"user_id": current_user['id']}
    ).sort("created_at", -1).limit(50).to_list(50)
    
    return {"query_history": history}

# Health check
@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.utcnow()}

# Admin ML API endpoints

# Admin authentication decorator
async def verify_admin_user(current_user: Dict = Depends(get_current_user)) -> Dict[str, Any]:
    """Verify user is admin (for now, check if user is active - in production, add admin role)"""
    if not current_user.get('is_active', False):
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user

@api_router.get("/admin/stats")
async def get_admin_stats(admin_user: Dict = Depends(verify_admin_user)):
    """Get admin dashboard statistics"""
    try:
        # Get user statistics
        total_users = await db.users.count_documents({})
        active_users = await db.users.count_documents({"is_active": True})
        
        # Get query statistics
        total_locations = await db.locations.count_documents({})
        total_price_records = await db.price_indices.count_documents({})
        
        # Get recent activity (mock data for now)
        recent_queries = 145  # In production, track this
        monthly_revenue = 12500  # Mock data
        
        return {
            "total_users": total_users,
            "active_users": active_users,
            "total_locations": total_locations,
            "total_price_records": total_price_records,
            "recent_queries": recent_queries,
            "monthly_revenue": monthly_revenue,
            "system_status": "healthy"
        }
    except Exception as e:
        logger.error(f"Error getting admin stats: {str(e)}")
        raise HTTPException(status_code=500, detail="Error retrieving statistics")

@api_router.get("/admin/users")
async def get_admin_users(admin_user: Dict = Depends(verify_admin_user)):
    """Get all users for admin management"""
    try:
        users = await db.users.find({}, {
            "_id": 0,
            "password_hash": 0  # Don't return password hash
        }).to_list(1000)
        
        return {"users": users}
    except Exception as e:
        logger.error(f"Error getting users: {str(e)}")
        raise HTTPException(status_code=500, detail="Error retrieving users")

@api_router.post("/admin/data/process")
async def process_data_admin(
    request_data: Dict[str, Any],
    admin_user: Dict = Depends(verify_admin_user)
):
    """Process data with ML pipeline for admin"""
    try:
        data = request_data.get('data', [])
        options = request_data.get('options', {})
        
        result = await ml_pipeline.process_data(data, options)
        return result
        
    except Exception as e:
        logger.error(f"Error processing data: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Data processing error: {str(e)}")

@api_router.post("/admin/models/train")
async def train_model_admin(
    request_data: Dict[str, Any],
    admin_user: Dict = Depends(verify_admin_user)
):
    """Train ML model for admin"""
    try:
        data = request_data.get('data', [])
        model_config = request_data.get('model_config', {})
        
        # Validate model type
        model_type = model_config.get('model_type')
        valid_models = [
            MLModelType.LINEAR_REGRESSION,
            MLModelType.RIDGE_REGRESSION,
            MLModelType.LASSO_REGRESSION,
            MLModelType.RANDOM_FOREST,
            MLModelType.XGBOOST,
            MLModelType.PROPHET
        ]
        
        if not model_type:
            raise HTTPException(status_code=400, detail="model_type is required")
        
        if model_type not in valid_models:
            raise HTTPException(status_code=400, detail=f"Invalid model type '{model_type}'. Must be one of: {valid_models}")
        
        if not data:
            raise HTTPException(status_code=400, detail="Training data is required")
        
        result = await ml_pipeline.train_model(data, model_config)
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error training model: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Model training error: {str(e)}")

@api_router.get("/admin/models")
async def get_models_admin(admin_user: Dict = Depends(verify_admin_user)):
    """Get all trained models for admin"""
    try:
        models = await ml_pipeline.get_model_list()
        return {"models": models}
        
    except Exception as e:
        logger.error(f"Error getting models: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error retrieving models: {str(e)}")

@api_router.post("/admin/models/{model_id}/predict")
async def predict_with_model_admin(
    model_id: str,
    request_data: Dict[str, Any],
    admin_user: Dict = Depends(verify_admin_user)
):
    """Make predictions with a trained model"""
    try:
        data = request_data.get('data', [])
        result = await ml_pipeline.predict(model_id, data)
        return result
        
    except Exception as e:
        logger.error(f"Error making predictions: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Prediction error: {str(e)}")

@api_router.get("/admin/data/sample")
async def get_sample_data_admin(admin_user: Dict = Depends(verify_admin_user)):
    """Get sample data for ML training (mock data for testing)"""
    try:
        # Generate sample real estate data for testing
        import random
        from datetime import datetime, timedelta
        
        sample_data = []
        base_date = datetime.now() - timedelta(days=365*5)  # 5 years ago
        base_price = 5000  # Base price per m2
        
        for i in range(100):
            date = base_date + timedelta(days=i*18)  # Every 18 days
            # Add some trend and seasonality
            trend = i * 2  # Upward trend
            seasonal = 200 * np.sin(2 * np.pi * i / 20)  # Seasonal pattern
            noise = random.gauss(0, 100)  # Random noise
            
            price = base_price + trend + seasonal + noise
            
            sample_data.append({
                'date': date.strftime('%Y-%m-%d'),
                'price': max(price, 1000),  # Minimum price
                'location_code': random.choice(['34001', '34002', '06001', '06002']),
                'property_type': random.choice(['residential_sale', 'residential_rent']),
                'size_m2': random.randint(70, 200),
                'rooms': random.choice([1, 2, 3, 4, 5]),
                'age': random.randint(0, 30),
                'floor': random.randint(1, 15)
            })
        
        return {
            "data": sample_data,
            "total_records": len(sample_data),
            "date_range": {
                "start": sample_data[0]['date'],
                "end": sample_data[-1]['date']
            }
        }
        
    except Exception as e:
        logger.error(f"Error generating sample data: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error generating sample data: {str(e)}")

@api_router.post("/admin/data/import-real")
async def import_real_data_admin(admin_user: Dict = Depends(verify_admin_user)):
    """Import real data from ee2401_db.sql"""
    try:
        logger.info("Starting real data import from ee2401_db.sql")
        
        # Run the import process
        stats = await import_ee2401_data()
        
        return {
            "success": True,
            "message": "Real data import completed",
            "statistics": {
                "total_lines": stats.total_lines,
                "parsed_records": stats.parsed_records,
                "imported_records": stats.imported_records,
                "errors": stats.errors,
                "tables": stats.processed_tables,
                "success_rate": (stats.imported_records / stats.parsed_records * 100) if stats.parsed_records > 0 else 0
            }
        }
        
    except Exception as e:
        logger.error(f"Error importing real data: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Import error: {str(e)}")

@api_router.get("/admin/data/collections-info")
async def get_collections_info_admin(admin_user: Dict = Depends(verify_admin_user)):
    """Get information about all collections in database"""
    try:
        collections_info = {}
        
        # Get all collection names
        collection_names = await db.list_collection_names()
        
        for collection_name in collection_names:
            collection = db[collection_name]
            count = await collection.count_documents({})
            
            # Get sample document
            sample = await collection.find_one({})
            
            collections_info[collection_name] = {
                "count": count,
                "sample_fields": list(sample.keys()) if sample else []
            }
        
        return {
            "success": True,
            "collections": collections_info,
            "total_collections": len(collection_names)
        }
        
    except Exception as e:
        logger.error(f"Error getting collections info: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error retrieving collections info: {str(e)}")

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("startup")
async def startup_event():
    logger.info("Starting Emlak Endeksi API...")
    # Create indices for better performance
    await db.users.create_index("email", unique=True)
    await db.locations.create_index([("il", 1), ("ilce", 1), ("mahalle", 1)])
    await db.price_indices.create_index([("location_code", 1), ("property_type", 1), ("year", 1), ("month", 1)])
    
@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()