#!/usr/bin/env python3
"""
Sample data seeder for Emlak Endeksi application
"""
import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime
import json

# Sample Turkish cities and districts data
SAMPLE_LOCATIONS = [
    # İstanbul
    {"il": "İstanbul", "il_code": "34", "ilce": "Beyoğlu", "ilce_code": "3404", "mahalle": "Galata", "mahalle_code": "340404001", "lat": 41.025, "lng": 28.974},
    {"il": "İstanbul", "il_code": "34", "ilce": "Beyoğlu", "ilce_code": "3404", "mahalle": "Taksim", "mahalle_code": "340404002", "lat": 41.037, "lng": 28.985},
    {"il": "İstanbul", "il_code": "34", "ilce": "Kadıköy", "ilce_code": "3418", "mahalle": "Moda", "mahalle_code": "341818001", "lat": 40.987, "lng": 29.031},
    {"il": "İstanbul", "il_code": "34", "ilce": "Kadıköy", "ilce_code": "3418", "mahalle": "Caddebostan", "mahalle_code": "341818002", "lat": 40.969, "lng": 29.062},
    {"il": "İstanbul", "il_code": "34", "ilce": "Beşiktaş", "ilce_code": "3403", "mahalle": "Ortaköy", "mahalle_code": "340303001", "lat": 41.055, "lng": 29.027},
    {"il": "İstanbul", "il_code": "34", "ilce": "Şişli", "ilce_code": "3434", "mahalle": "Nişantaşı", "mahalle_code": "343434001", "lat": 41.046, "lng": 28.988},
    {"il": "İstanbul", "il_code": "34", "ilce": "Arnavutköy", "ilce_code": "3402", "mahalle": "Hadımköy", "mahalle_code": "340202001", "lat": 41.153, "lng": 28.623},
    
    # Ankara
    {"il": "Ankara", "il_code": "06", "ilce": "Çankaya", "ilce_code": "0608", "mahalle": "Kavaklıdere", "mahalle_code": "060808001", "lat": 39.905, "lng": 32.854},
    {"il": "Ankara", "il_code": "06", "ilce": "Çankaya", "ilce_code": "0608", "mahalle": "Bahçelievler", "mahalle_code": "060808002", "lat": 39.871, "lng": 32.845},
    {"il": "Ankara", "il_code": "06", "ilce": "Keçiören", "ilce_code": "0615", "mahalle": "Etlik", "mahalle_code": "061515001", "lat": 39.970, "lng": 32.832},
    
    # İzmir
    {"il": "İzmir", "il_code": "35", "ilce": "Konak", "ilce_code": "3515", "mahalle": "Alsancak", "mahalle_code": "351515001", "lat": 38.440, "lng": 27.146},
    {"il": "İzmir", "il_code": "35", "ilce": "Karşıyaka", "ilce_code": "3514", "mahalle": "Mavişehir", "mahalle_code": "351414001", "lat": 38.477, "lng": 27.089},
    {"il": "İzmir", "il_code": "35", "ilce": "Bornova", "ilce_code": "3506", "mahalle": "Erzene", "mahalle_code": "350606001", "lat": 38.464, "lng": 27.206},
    
    # Bursa
    {"il": "Bursa", "il_code": "16", "ilce": "Osmangazi", "ilce_code": "1614", "mahalle": "Heykel", "mahalle_code": "161414001", "lat": 40.191, "lng": 29.061},
    {"il": "Bursa", "il_code": "16", "ilce": "Nilüfer", "ilce_code": "1613", "mahalle": "Görükle", "mahalle_code": "161313001", "lat": 40.227, "lng": 28.884},
    
    # Antalya
    {"il": "Antalya", "il_code": "07", "ilce": "Muratpaşa", "ilce_code": "0713", "mahalle": "Lara", "mahalle_code": "071313001", "lat": 36.834, "lng": 30.784},
    {"il": "Antalya", "il_code": "07", "ilce": "Konyaaltı", "ilce_code": "0712", "mahalle": "Hurma", "mahalle_code": "071212001", "lat": 36.896, "lng": 30.646},
]

# Sample property types
PROPERTY_TYPES = [
    "residential_sale",
    "residential_rent", 
    "commercial_sale",
    "commercial_rent",
    "land_sale"
]

async def seed_locations(db):
    """Seed location data"""
    print("Seeding location data...")
    
    # Clear existing locations
    await db.locations.delete_many({})
    
    # Insert sample locations
    for location in SAMPLE_LOCATIONS:
        location['id'] = f"loc_{location['mahalle_code']}"
        await db.locations.insert_one(location)
    
    print(f"Inserted {len(SAMPLE_LOCATIONS)} locations")

async def seed_price_indices(db):
    """Seed price index data"""
    print("Seeding price index data...")
    
    # Clear existing price indices
    await db.price_indices.delete_many({})
    
    price_data = []
    
    # Generate price data for each location and property type
    for location in SAMPLE_LOCATIONS:
        mahalle_code = location['mahalle_code']
        
        # Base prices for different areas (per m2)
        base_prices = {
            # Istanbul premium areas
            "340404001": 25000,  # Galata
            "340404002": 30000,  # Taksim
            "341818001": 28000,  # Moda
            "341818002": 32000,  # Caddebostan
            "340303001": 35000,  # Ortaköy
            "343434001": 40000,  # Nişantaşı
            "340202001": 8000,   # Hadımköy
            
            # Ankara
            "060808001": 18000,  # Kavaklıdere
            "060808002": 12000,  # Bahçelievler
            "061515001": 8000,   # Etlik
            
            # İzmir
            "351515001": 15000,  # Alsancak
            "351414001": 12000,  # Mavişehir
            "350606001": 10000,  # Erzene
            
            # Bursa
            "161414001": 11000,  # Heykel
            "161313001": 9000,   # Görükle
            
            # Antalya
            "071313001": 14000,  # Lara
            "071212001": 12000,  # Hurma
        }
        
        base_price = base_prices.get(mahalle_code, 10000)
        
        for property_type in PROPERTY_TYPES:
            # Adjust base price by property type
            if property_type == "residential_rent":
                type_multiplier = 0.05  # 5% of sale price as monthly rent
            elif property_type == "commercial_sale":
                type_multiplier = 1.5
            elif property_type == "commercial_rent":
                type_multiplier = 0.08
            elif property_type == "land_sale":
                type_multiplier = 0.6
            else:  # residential_sale
                type_multiplier = 1.0
            
            adjusted_base_price = base_price * type_multiplier
            
            # Generate monthly data from 2020 to 2025
            for year in range(2020, 2026):
                for month in range(1, 13):
                    # Add some realistic price variation
                    # Prices generally increase over time with some monthly fluctuation
                    time_factor = 1 + (year - 2020) * 0.08 + (month - 6) * 0.001  # 8% yearly increase
                    
                    # Add some random variation
                    import random
                    random.seed(f"{mahalle_code}{property_type}{year}{month}")
                    variation = random.uniform(0.9, 1.1)
                    
                    final_price = adjusted_base_price * time_factor * variation
                    
                    price_entry = {
                        'id': f"price_{mahalle_code}_{property_type}_{year}_{month:02d}",
                        'location_code': mahalle_code,
                        'property_type': property_type,
                        'year': year,
                        'month': month,
                        'avg_price_per_m2': round(final_price, 2),
                        'transaction_count': random.randint(5, 50),
                        'created_at': datetime.utcnow()
                    }
                    
                    price_data.append(price_entry)
    
    # Batch insert
    if price_data:
        await db.price_indices.insert_many(price_data)
    
    print(f"Inserted {len(price_data)} price index records")

async def seed_demographic_data(db):
    """Seed demographic data"""
    print("Seeding demographic data...")
    
    # Clear existing demographic data
    await db.demographic_data.delete_many({})
    
    demographic_data = []
    
    for location in SAMPLE_LOCATIONS:
        mahalle_code = location['mahalle_code']
        
        import random
        random.seed(mahalle_code)
        
        # Generate realistic demographic data
        population = random.randint(5000, 50000)
        avg_income = random.randint(15000, 100000)  # Monthly average income
        
        # Education distribution (percentages)
        education_level = {
            "ilkokul": round(random.uniform(15, 35), 1),
            "ortaokul": round(random.uniform(20, 30), 1),
            "lise": round(random.uniform(25, 45), 1),
            "universite": round(random.uniform(15, 35), 1)
        }
        
        # Age distribution
        age_distribution = {
            "0-18": round(random.uniform(15, 25), 1),
            "18-35": round(random.uniform(25, 40), 1),
            "35-55": round(random.uniform(25, 35), 1),
            "55+": round(random.uniform(10, 20), 1)
        }
        
        demographic_entry = {
            'id': f"demo_{mahalle_code}",
            'location_code': mahalle_code,
            'population': population,
            'avg_income': avg_income,
            'education_level': education_level,
            'age_distribution': age_distribution,
            'updated_at': datetime.utcnow()
        }
        
        demographic_data.append(demographic_entry)
    
    if demographic_data:
        await db.demographic_data.insert_many(demographic_data)
    
    print(f"Inserted {len(demographic_data)} demographic records")

async def create_sample_user(db):
    """Create a sample user for testing"""
    print("Creating sample user...")
    
    import bcrypt
    
    # Hash password
    password_hash = bcrypt.hashpw("test123".encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    sample_user = {
        'id': 'user_sample_001',
        'email': 'test@example.com',
        'password_hash': password_hash,
        'first_name': 'Test',
        'last_name': 'User',
        'user_type': 'individual',
        'phone': '+90 555 123 4567',
        'query_count': 0,
        'query_limit': 5,
        'created_at': datetime.utcnow(),
        'is_active': True
    }
    
    # Check if user already exists
    existing_user = await db.users.find_one({"email": sample_user['email']})
    if not existing_user:
        await db.users.insert_one(sample_user)
        print("Sample user created: test@example.com / test123")
    else:
        print("Sample user already exists")

async def main():
    """Main seeding function"""
    # Connect to MongoDB
    mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    db_name = os.environ.get('DB_NAME', 'emlak_endeksi_db')
    
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    try:
        print("Starting data seeding...")
        
        # Seed all data
        await seed_locations(db)
        await seed_price_indices(db)
        await seed_demographic_data(db)
        await create_sample_user(db)
        
        # Create indices for performance
        print("Creating database indices...")
        await db.users.create_index("email", unique=True)
        await db.locations.create_index([("il", 1), ("ilce", 1), ("mahalle", 1)])
        await db.price_indices.create_index([("location_code", 1), ("property_type", 1), ("year", 1), ("month", 1)])
        await db.demographic_data.create_index("location_code", unique=True)
        
        print("Data seeding completed successfully!")
        
    finally:
        client.close()

if __name__ == "__main__":
    import sys
    sys.path.append('/app/backend')
    
    # Load environment variables
    from dotenv import load_dotenv
    load_dotenv('/app/backend/.env')
    
    asyncio.run(main())