import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.db import connection

print("Cleaning phone numbers via raw SQL (including soft-deleted rows)...")
with connection.cursor() as cursor:
    # 1. Clean digits and keep only the last 10 digits
    cursor.execute("""
        UPDATE customers_customer 
        SET phone = RIGHT(REGEXP_REPLACE(phone, '[^0-9]', '', 'g'), 10)
        WHERE phone IS NOT NULL AND phone != '';
    """)
    # 2. Set default for empty/null phones to be 10 digits
    cursor.execute("""
        UPDATE customers_customer
        SET phone = '0000000000'
        WHERE phone IS NULL OR phone = '';
    """)
    
    # 3. Double check if any phone number is still longer than 10 digits (e.g. if original had < 10 digits but zfill was needed)
    # Zfill to 10 characters:
    cursor.execute("""
        UPDATE customers_customer
        SET phone = LPAD(phone, 10, '0')
        WHERE LENGTH(phone) < 10;
    """)

print("Raw SQL Done!")
