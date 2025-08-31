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
    except jwt.PyJWTError:
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
        "phone": current_user.get('phone'),
        "created_at": current_user['created_at']
    }

# Health check
@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.utcnow()}

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