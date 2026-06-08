import os
import django
import sys
from decimal import Decimal
from datetime import date, timedelta

# 1. Setup Django environment settings
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.authentication.models import User
from apps.organizations.models import Organization, UserOrganizationMembership
from apps.customers.models import Customer
from apps.products.models import Product
from apps.invoices.models import Invoice, InvoiceLineItem

def seed():
    print("Initializing Database Seeding Sequence...")
    
    # 1. Create Default Admin User
    admin_email = 'admin@invoicemanager.com'
    admin_user, created = User.objects.get_or_create(
        email=admin_email,
        defaults={
            'username': admin_email,
            'first_name': 'Saas',
            'last_name': 'Owner',
            'is_verified': True,
        }
    )
    if created:
        admin_user.set_password('AdminPassword123!')
        admin_user.save()
        print(f"Created Default Owner User: {admin_email} / AdminPassword123!")
    else:
        print("Default Owner User already exists.")

    # 2. Create Default Organization Tenant
    org, org_created = Organization.objects.get_or_create(
        name='Acme Corporate Solutions',
        defaults={
            'email': 'billing@acmecorp.com',
            'phone': '+91-9876543210',
            'currency': 'INR',
            'tax_number': '27ACME1234F1Z5',
            'billing_address': {
                'street': 'Suite 101, Innovators Hub',
                'city': 'Mumbai',
                'state': 'Maharashtra',
                'zip': '400001',
                'country': 'India'
            },
            'created_by': admin_user
        }
    )
    if org_created:
        print("Created Tenant Organization: Acme Corporate Solutions")
    else:
        print("Tenant Organization already exists.")

    # 3. Bind Owner membership
    membership, mem_created = UserOrganizationMembership.objects.get_or_create(
        user=admin_user,
        organization=org,
        defaults={'role': 'owner'}
    )
    if mem_created:
        print("Mapped Owner user membership workspace.")

    # 4. Create Default Customers
    cust1, c1_created = Customer.objects.get_or_create(
        organization=org,
        contact_name='Amit Sharma',
        defaults={
            'email': 'billing@delhitech.in',
            'phone': '9988776655',
            'billing_address': {
                'street': 'Sec 10, Rohini Block B',
                'city': 'New Delhi',
                'state': 'Delhi',
                'zip': '110085',
                'country': 'India'
            },
            'shipping_address': {
                'street': 'Sec 10, Rohini Block B',
                'city': 'New Delhi',
                'state': 'Delhi',
                'zip': '110085',
                'country': 'India'
            },
            'notes': 'Preferred client. Delhi state CGST/SGST taxes apply.',
            'tags': ['premium', 'corporate']
        }
    )
    
    cust2, c2_created = Customer.objects.get_or_create(
        organization=org,
        contact_name='Ramesh Kumar',
        defaults={
            'email': 'finance@karnataka-dv.com',
            'phone': '8877665544',
            'billing_address': {
                'street': '10th Main, Indiranagar',
                'city': 'Bengaluru',
                'state': 'Karnataka',
                'zip': '560038',
                'country': 'India'
            },
            'shipping_address': {
                'street': '10th Main, Indiranagar',
                'city': 'Bengaluru',
                'state': 'Karnataka',
                'zip': '560038',
                'country': 'India'
            },
            'notes': 'Out of state IGST tax rule compiles here.',
            'tags': ['partner', 'technology']
        }
    )
    
    print(f"Loaded Customers database (Delhi: {c1_created}, Karnataka: {c2_created})")

    # 5. Create Catalog Products and services
    prod1, p1_created = Product.objects.get_or_create(
        organization=org,
        sku='SRV-CNS-01',
        defaults={
            'name': 'Cloud Infrastructure Consultation',
            'description': 'AWS architecture reviews and serverless migration design sessions',
            'price': Decimal('8500.00'),
            'tax_rate': Decimal('18.00'),
            'hsn_sac_code': '998311',
            'type': 'service'
        }
    )

    prod2, p2_created = Product.objects.get_or_create(
        organization=org,
        sku='SRV-DEV-02',
        defaults={
            'name': 'Custom Software Development',
            'description': 'React & Django backend REST API development hours',
            'price': Decimal('4500.00'),
            'tax_rate': Decimal('18.00'),
            'hsn_sac_code': '998313',
            'type': 'service'
        }
    )

    prod3, p3_created = Product.objects.get_or_create(
        organization=org,
        sku='PRD-LIC-03',
        defaults={
            'name': 'Enterprise SaaS Billing License',
            'description': 'Annual multi-tenant invoice manager hosting license key',
            'price': Decimal('15000.00'),
            'tax_rate': Decimal('12.00'),
            'hsn_sac_code': '997331',
            'type': 'product',
            'inventory_count': 150
        }
    )
    
    print(f"Loaded Product Catalog (Consult: {p1_created}, Software: {p2_created}, Lic: {p3_created})")

    # 6. Create test Invoice
    inv_count = Invoice.objects.global_all().filter(organization=org).count()
    if inv_count == 0:
        # Build first Invoice (Paid)
        invoice1 = Invoice.objects.create(
            organization=org,
            customer=cust1,
            status='paid',
            issue_date=date.today() - timedelta(days=20),
            due_date=date.today() + timedelta(days=10),
            discount_amount=Decimal('1000.00'),
            currency='INR',
            terms='Payment is due immediately.',
            notes='Pre-seeded transaction.',
            created_by=admin_user
        )
        
        # Line items
        InvoiceLineItem.objects.create(
            invoice=invoice1,
            product=prod1,
            description=prod1.description,
            quantity=Decimal('3.00'),
            unit_price=prod1.price,
            tax_rate=prod1.tax_rate,
            tax_amount=Decimal('4590.00'),
            total_amount=Decimal('30090.00')
        )
        
        # Calculate subtotal/totals
        invoice1.subtotal = Decimal('25500.00')
        invoice1.tax_amount = Decimal('4590.00')
        invoice1.total_amount = Decimal('29090.00')
        invoice1.save()
        
        # Build second Invoice (Draft pending approval)
        invoice2 = Invoice.objects.create(
            organization=org,
            customer=cust2,
            status='pending',
            issue_date=date.today() - timedelta(days=2),
            due_date=date.today() + timedelta(days=28),
            discount_amount=Decimal('0.00'),
            currency='INR',
            terms='Net 30 invoice policy.',
            notes='Review approval status.',
            created_by=admin_user
        )
        
        InvoiceLineItem.objects.create(
            invoice=invoice2,
            product=prod2,
            description=prod2.description,
            quantity=Decimal('8.00'),
            unit_price=prod2.price,
            tax_rate=prod2.tax_rate,
            tax_amount=Decimal('6480.00'),
            total_amount=Decimal('42480.00')
        )
        
        invoice2.subtotal = Decimal('36000.00')
        invoice2.tax_amount = Decimal('6480.00')
        invoice2.total_amount = Decimal('42480.00')
        invoice2.save()
        
        print("Generated pre-seeded invoices registry.")
    else:
        print("Test invoices registry already seeded.")

    print("Database seeding completed successfully.")

if __name__ == '__main__':
    seed()
