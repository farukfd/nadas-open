"""
SQL Data Importer for Real Estate Database (ee2401_db.sql)
Imports real estate data from SQL dump to MongoDB with proper processing
"""

import re
import logging
from typing import Dict, List, Any, Generator, Tuple
from pathlib import Path
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from datetime import datetime
import json
from dataclasses import dataclass
import hashlib

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@dataclass
class ImportStats:
    """Statistics for import process"""
    total_lines: int = 0
    parsed_records: int = 0
    imported_records: int = 0
    errors: int = 0
    duplicates: int = 0
    processed_tables: Dict[str, int] = None
    
    def __post_init__(self):
        if self.processed_tables is None:
            self.processed_tables = {}

class SQLDataImporter:
    """Imports data from ee2401_db.sql to MongoDB"""
    
    def __init__(self, mongo_url: str, db_name: str):
        self.mongo_url = mongo_url
        self.db_name = db_name
        self.client = None
        self.db = None
        self.stats = ImportStats()
        
        # Table mappings - focusing on key tables
        self.target_tables = {
            'ad_adverts': 'real_estate_ads',
            'us_users': 'original_users', 
            'ix_index': 'price_indices_raw'
        }
        
        # Phone hashing for KVKV compliance
        self.salt = "emlakekspertizi_2025_kvkv"
        
    async def connect(self):
        """Connect to MongoDB"""
        self.client = AsyncIOMotorClient(self.mongo_url)
        self.db = self.client[self.db_name]
        logger.info(f"Connected to MongoDB: {self.db_name}")
        
    async def disconnect(self):
        """Disconnect from MongoDB"""
        if self.client:
            self.client.close()
            logger.info("Disconnected from MongoDB")
    
    def hash_phone(self, phone: str) -> str:
        """Hash phone number for KVKV compliance"""
        if not phone or phone in ('', '0', 'NULL'):
            return None
        
        # Clean phone number
        clean_phone = re.sub(r'[\s\-\(\)]', '', str(phone))
        
        # Hash with salt
        phone_with_salt = f"{clean_phone}_{self.salt}"
        return hashlib.sha256(phone_with_salt.encode()).hexdigest()[:16]
    
    def parse_insert_statement(self, line: str) -> Tuple[str, List[Dict[str, Any]]]:
        """Parse SQL INSERT statement and extract data"""
        try:
            # Extract table name
            table_match = re.match(r'INSERT INTO `?(\w+)`?\s+', line)
            if not table_match:
                return None, []
                
            table_name = table_match.group(1)
            
            # Skip if not a target table
            if table_name not in self.target_tables:
                return None, []
            
            # Extract VALUES part
            values_match = re.search(r'VALUES\s+(.+);?$', line, re.IGNORECASE)
            if not values_match:
                return table_name, []
            
            values_part = values_match.group(1)
            
            # Parse multiple value sets: (val1,val2,val3),(val4,val5,val6)
            records = []
            value_sets = self.extract_value_sets(values_part)
            
            for value_set in value_sets:
                record = self.parse_value_set(table_name, value_set)
                if record:
                    records.append(record)
                    
            return table_name, records
            
        except Exception as e:
            logger.error(f"Error parsing line: {str(e)[:100]}")
            self.stats.errors += 1
            return None, []
    
    def extract_value_sets(self, values_part: str) -> List[str]:
        """Extract individual value sets from VALUES clause"""
        value_sets = []
        depth = 0
        current_set = ""
        i = 0
        
        while i < len(values_part):
            char = values_part[i]
            
            if char == '(':
                if depth == 0:
                    current_set = ""
                else:
                    current_set += char
                depth += 1
            elif char == ')':
                depth -= 1
                if depth == 0:
                    if current_set.strip():
                        value_sets.append(current_set.strip())
                else:
                    current_set += char
            elif depth > 0:
                current_set += char
            
            i += 1
        
        return value_sets
    
    def parse_value_set(self, table_name: str, value_set: str) -> Dict[str, Any]:
        """Parse individual value set into record"""
        try:
            values = self.split_values(value_set)
            
            if table_name == 'ad_adverts':
                return self.parse_ad_record(values)
            elif table_name == 'us_users':
                return self.parse_user_record(values)
            elif table_name == 'ix_index':
                return self.parse_index_record(values)
                
        except Exception as e:
            logger.error(f"Error parsing value set for {table_name}: {str(e)}")
            return None
    
    def split_values(self, value_set: str) -> List[str]:
        """Split comma-separated values handling quoted strings"""
        values = []
        current_value = ""
        in_quotes = False
        escape_next = False
        
        for char in value_set:
            if escape_next:
                current_value += char
                escape_next = False
            elif char == '\\':
                escape_next = True
                current_value += char
            elif char == "'" and not escape_next:
                in_quotes = not in_quotes
                current_value += char
            elif char == ',' and not in_quotes:
                values.append(current_value.strip())
                current_value = ""
            else:
                current_value += char
        
        if current_value.strip():
            values.append(current_value.strip())
            
        return values
    
    def clean_value(self, value: str) -> Any:
        """Clean and convert SQL value to Python type"""
        if not value or value.upper() == 'NULL':
            return None
            
        value = value.strip()
        
        # Remove quotes
        if value.startswith("'") and value.endswith("'"):
            value = value[1:-1]
            # Unescape SQL strings
            value = value.replace("\\'", "'").replace('\\"', '"').replace('\\\\', '\\')
            return value
        
        # Try to convert to number
        try:
            if '.' in value:
                return float(value)
            else:
                return int(value)
        except ValueError:
            return value
    
    def parse_ad_record(self, values: List[str]) -> Dict[str, Any]:
        """Parse ad_adverts record"""
        if len(values) < 10:
            return None
            
        try:
            # Map to key fields from ad_adverts table structure
            record = {
                'original_id': self.clean_value(values[0]) if len(values) > 0 else None,
                'ad_id': self.clean_value(values[1]) if len(values) > 1 else None,
                'user_id': self.clean_value(values[2]) if len(values) > 2 else None,
                'category_id': self.clean_value(values[3]) if len(values) > 3 else None,
                'subcategory_id': self.clean_value(values[4]) if len(values) > 4 else None,
                'title': self.clean_value(values[5]) if len(values) > 5 else None,
                'description': self.clean_value(values[7]) if len(values) > 7 else None,
                'city': self.clean_value(values[10]) if len(values) > 10 else None,
                'district': self.clean_value(values[11]) if len(values) > 11 else None,
                'neighborhood': self.clean_value(values[12]) if len(values) > 12 else None,
                'size_m2': self.clean_value(values[16]) if len(values) > 16 else None,
                'price': self.clean_value(values[17]) if len(values) > 17 else None,
                'currency': self.clean_value(values[18]) if len(values) > 18 else 1,  # Default TL
                'latitude': self.clean_value(values[20]) if len(values) > 20 else None,
                'longitude': self.clean_value(values[21]) if len(values) > 21 else None,
                'created_at': self.clean_value(values[25]) if len(values) > 25 else None,
                'updated_at': self.clean_value(values[26]) if len(values) > 26 else None,
                'is_active': self.clean_value(values[36]) if len(values) > 36 else 1,
                'imported_at': datetime.utcnow().isoformat(),
                'data_source': 'ee2401_db'
            }
            
            # Calculate price per m2 if possible
            if record.get('price') and record.get('size_m2') and record['size_m2'] > 0:
                record['price_per_m2'] = float(record['price']) / float(record['size_m2'])
            
            # Determine property type
            record['property_type'] = self.determine_property_type(
                record.get('category_id'), 
                record.get('subcategory_id')
            )
            
            return record
            
        except Exception as e:
            logger.error(f"Error parsing ad record: {str(e)}")
            return None
    
    def parse_user_record(self, values: List[str]) -> Dict[str, Any]:
        """Parse us_users record with phone hashing"""
        if len(values) < 5:
            return None
            
        try:
            phone_raw = self.clean_value(values[4]) if len(values) > 4 else None
            phone_hash = self.hash_phone(phone_raw) if phone_raw else None
            
            record = {
                'original_user_id': self.clean_value(values[0]) if len(values) > 0 else None,
                'username': self.clean_value(values[1]) if len(values) > 1 else None,
                'email': self.clean_value(values[2]) if len(values) > 2 else None,
                'phone_hash': phone_hash,
                'phone_active_score': 1.0 if phone_hash else 0.0,  # Initial active score
                'registration_date': self.clean_value(values[5]) if len(values) > 5 else None,
                'user_type': self.clean_value(values[6]) if len(values) > 6 else 'individual',
                'is_active': self.clean_value(values[7]) if len(values) > 7 else 1,
                'imported_at': datetime.utcnow().isoformat(),
                'data_source': 'ee2401_db'
            }
            
            return record
            
        except Exception as e:
            logger.error(f"Error parsing user record: {str(e)}")
            return None
    
    def parse_index_record(self, values: List[str]) -> Dict[str, Any]:
        """Parse ix_index record"""
        if len(values) < 5:
            return None
            
        try:
            record = {
                'index_id': self.clean_value(values[0]) if len(values) > 0 else None,
                'location_code': self.clean_value(values[1]) if len(values) > 1 else None,
                'property_type': self.clean_value(values[2]) if len(values) > 2 else None,
                'date': self.clean_value(values[3]) if len(values) > 3 else None,
                'price_index': self.clean_value(values[4]) if len(values) > 4 else None,
                'volume': self.clean_value(values[5]) if len(values) > 5 else None,
                'imported_at': datetime.utcnow().isoformat(),
                'data_source': 'ee2401_db'
            }
            
            return record
            
        except Exception as e:
            logger.error(f"Error parsing index record: {str(e)}")
            return None
    
    def determine_property_type(self, category_id: Any, subcategory_id: Any) -> str:
        """Determine property type from category IDs"""
        # Map category/subcategory to property types
        # This is a simplified mapping - can be enhanced
        
        if category_id == 1:  # Residential
            return 'residential_sale'
        elif category_id == 2:  # Commercial
            return 'commercial_sale'
        elif category_id == 3:  # Land
            return 'land_sale'
        else:
            return 'residential_sale'  # Default
    
    async def import_batch(self, table_name: str, records: List[Dict[str, Any]]) -> int:
        """Import batch of records to MongoDB"""
        if not records:
            return 0
            
        try:
            collection_name = self.target_tables[table_name]
            collection = self.db[collection_name]
            
            # Insert records
            result = await collection.insert_many(records, ordered=False)
            
            imported_count = len(result.inserted_ids)
            self.stats.imported_records += imported_count
            self.stats.processed_tables[table_name] = self.stats.processed_tables.get(table_name, 0) + imported_count
            
            return imported_count
            
        except Exception as e:
            logger.error(f"Error importing batch for {table_name}: {str(e)}")
            self.stats.errors += len(records)
            return 0
    
    async def process_sql_file(self, file_path: str, batch_size: int = 1000) -> ImportStats:
        """Process SQL file and import to MongoDB"""
        logger.info(f"Starting SQL file processing: {file_path}")
        
        await self.connect()
        
        try:
            current_batch = {}  # table_name -> records
            
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as file:
                for line_num, line in enumerate(file, 1):
                    self.stats.total_lines += 1
                    
                    # Progress logging
                    if line_num % 10000 == 0:
                        logger.info(f"Processed {line_num} lines. Imported: {self.stats.imported_records}")
                    
                    # Skip non-INSERT lines
                    if not line.strip().startswith('INSERT INTO'):
                        continue
                    
                    # Parse INSERT statement
                    table_name, records = self.parse_insert_statement(line)
                    
                    if not table_name or not records:
                        continue
                    
                    # Add to current batch
                    if table_name not in current_batch:
                        current_batch[table_name] = []
                    
                    current_batch[table_name].extend(records)
                    self.stats.parsed_records += len(records)
                    
                    # Import batch when it reaches batch_size
                    for table in list(current_batch.keys()):
                        if len(current_batch[table]) >= batch_size:
                            await self.import_batch(table, current_batch[table])
                            current_batch[table] = []
            
            # Import remaining records
            for table_name, records in current_batch.items():
                if records:
                    await self.import_batch(table_name, records)
            
            logger.info("SQL file processing completed")
            
        except Exception as e:
            logger.error(f"Error processing SQL file: {str(e)}")
            self.stats.errors += 1
        
        finally:
            await self.disconnect()
        
        return self.stats
    
    def print_stats(self):
        """Print import statistics"""
        print("\n" + "="*50)
        print("📊 SQL IMPORT STATISTICS")
        print("="*50)
        print(f"Total lines processed: {self.stats.total_lines:,}")
        print(f"Records parsed: {self.stats.parsed_records:,}")
        print(f"Records imported: {self.stats.imported_records:,}")
        print(f"Errors: {self.stats.errors:,}")
        
        print("\n📋 Table Statistics:")
        for table, count in self.stats.processed_tables.items():
            collection = self.target_tables[table]
            print(f"  {table} → {collection}: {count:,} records")
        
        if self.stats.parsed_records > 0:
            success_rate = (self.stats.imported_records / self.stats.parsed_records) * 100
            print(f"\n✅ Success Rate: {success_rate:.1f}%")

# Main import function
async def import_ee2401_data():
    """Main function to import ee2401_db.sql data"""
    
    # Load environment variables
    from dotenv import load_dotenv
    load_dotenv()
    
    mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    db_name = os.environ.get('DB_NAME', 'emlak_endeksi')
    
    # Initialize importer
    importer = SQLDataImporter(mongo_url, db_name)
    
    # Process SQL file
    sql_file = '/app/ee2401_db.sql'
    stats = await importer.process_sql_file(sql_file, batch_size=500)
    
    # Print results
    importer.print_stats()
    
    return stats

if __name__ == "__main__":
    asyncio.run(import_ee2401_data())