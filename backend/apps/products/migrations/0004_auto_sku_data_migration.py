import re
from django.db import migrations, transaction

def generate_skus(apps, schema_editor):
    Product = apps.get_model('products', 'Product')
    Organization = apps.get_model('organizations', 'Organization')
    
    prod_pattern = re.compile(r'^PROD-\d{5}$')
    ser_pattern = re.compile(r'^SER-\d{5}$')

    # Process per organization
    for org in Organization.objects.all():
        with transaction.atomic():
            Organization.objects.select_for_update().get(id=org.id)

            # Include soft-deleted ones just in case to prevent future unique constraint issues if restored
            products = Product.objects.filter(organization=org).order_by('created_at')
            
            max_prod_counter = 0
            max_ser_counter = 0
            used_skus = set()
            products_to_update = []

            for p in products:
                # Check if it's already perfectly valid and unique
                if p.type == 'product' and p.sku and prod_pattern.match(p.sku) and p.sku not in used_skus:
                    used_skus.add(p.sku)
                    counter = int(p.sku.split('-')[-1])
                    if counter > max_prod_counter:
                        max_prod_counter = counter
                elif p.type == 'service' and p.sku and ser_pattern.match(p.sku) and p.sku not in used_skus:
                    used_skus.add(p.sku)
                    counter = int(p.sku.split('-')[-1])
                    if counter > max_ser_counter:
                        max_ser_counter = counter
                else:
                    # Needs new SKU
                    products_to_update.append(p)

            # Assign new SKUs
            for p in products_to_update:
                if p.type == 'product':
                    max_prod_counter += 1
                    p.sku = f"PROD-{max_prod_counter:05d}"
                else:
                    max_ser_counter += 1
                    p.sku = f"SER-{max_ser_counter:05d}"
                
                while p.sku in used_skus:
                    if p.type == 'product':
                        max_prod_counter += 1
                        p.sku = f"PROD-{max_prod_counter:05d}"
                    else:
                        max_ser_counter += 1
                        p.sku = f"SER-{max_ser_counter:05d}"

                used_skus.add(p.sku)
                p.save(update_fields=['sku'])

def reverse_generate_skus(apps, schema_editor):
    pass

class Migration(migrations.Migration):

    dependencies = [
        ('products', '0003_alter_category_created_at_alter_category_deleted_at_and_more'),
    ]

    operations = [
        migrations.RunPython(generate_skus, reverse_generate_skus),
    ]
