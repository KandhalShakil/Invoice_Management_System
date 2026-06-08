import pytest
from rest_framework import status
from decimal import Decimal
from django.utils import timezone
from apps.products.models import Product
from apps.invoices.models import Invoice, InvoiceLineItem
from apps.core.context import set_current_organization_id

@pytest.mark.django_db
def test_invoice_line_item_catalog_validation(api_client, db_setup):
    """
    Verifies that when creating or editing an invoice, sending prices or descriptions
    that do not match the product master catalog returns a 400 validation error.
    Also verifies that missing values are automatically populated from the master catalog.
    """
    user_owner = db_setup['user1']
    org_a = db_setup['org_a']
    
    api_client.force_authenticate(user=user_owner)

    # Set context
    set_current_organization_id(org_a.id)

    # 1. Create a Product catalog record
    product = Product.objects.create(
        organization=org_a,
        name='SaaS Subscription',
        sku='SAAS-SUB',
        description='Standard monthly subscription',
        price=Decimal('99.00'),
        tax_rate=Decimal('18.00'),
        is_active=True
    )

    # Create a Customer
    from apps.customers.models import Customer
    cust = Customer.objects.create(
        organization=org_a,
        contact_name='Test Cust',
        email='cust@example.com',
        phone='9999988888',
        created_by=user_owner
    )

    # Case A: Try creating invoice with modified price -> Should fail
    res_fail_price = api_client.post(
        '/api/v1/invoices/',
        {
            'customer': str(cust.id),
            'issue_date': str(timezone.now().date()),
            'due_date': str(timezone.now().date() + timezone.timedelta(days=30)),
            'status': 'draft',
            'line_items': [{
                'product': str(product.id),
                'quantity': 1,
                'unit_price': 150.00,  # Deviation! Catalog is 99.00
                'tax_rate': 18.00
            }]
        },
        format='json',
        HTTP_X_TENANT_ID=str(org_a.id)
    )
    assert res_fail_price.status_code == status.HTTP_400_BAD_REQUEST
    assert 'unit_price' in res_fail_price.data or 'unit_price' in res_fail_price.data.get('detail', {}).get('line_items', [{}])[0]

    # Case B: Try creating invoice with modified description -> Should fail
    res_fail_desc = api_client.post(
        '/api/v1/invoices/',
        {
            'customer': str(cust.id),
            'issue_date': str(timezone.now().date()),
            'due_date': str(timezone.now().date() + timezone.timedelta(days=30)),
            'status': 'draft',
            'line_items': [{
                'product': str(product.id),
                'quantity': 1,
                'description': 'Deviated description text',  # Deviation!
                'unit_price': 99.00,
                'tax_rate': 18.00
            }]
        },
        format='json',
        HTTP_X_TENANT_ID=str(org_a.id)
    )
    assert res_fail_desc.status_code == status.HTTP_400_BAD_REQUEST
    assert 'description' in res_fail_desc.data or 'description' in res_fail_desc.data.get('detail', {}).get('line_items', [{}])[0]

    # Case C: Create invoice omitting description, price, and tax rate -> Should pass and auto-fill
    res_pass = api_client.post(
        '/api/v1/invoices/',
        {
            'customer': str(cust.id),
            'issue_date': str(timezone.now().date()),
            'due_date': str(timezone.now().date() + timezone.timedelta(days=30)),
            'status': 'draft',
            'line_items': [{
                'product': str(product.id),
                'quantity': 2,
            }]
        },
        format='json',
        HTTP_X_TENANT_ID=str(org_a.id)
    )
    assert res_pass.status_code == status.HTTP_201_CREATED
    # Check that it auto-populated values from catalog product
    line_item = res_pass.data['line_items'][0]
    assert line_item['description'] == 'Standard monthly subscription'
    assert Decimal(str(line_item['unit_price'])) == Decimal('99.00')
    assert Decimal(str(line_item['tax_rate'])) == Decimal('18.00')
    assert Decimal(str(line_item['total_amount'])) == Decimal('233.64') # 2 * 99 = 198 + 18% GST (35.64) = 233.64


@pytest.mark.django_db
def test_invoice_duplication_uses_latest_catalog(api_client, db_setup):
    """
    Verifies that duplicating an invoice uses the latest product catalog details
    instead of cloning the old price/description from the original invoice.
    """
    user_owner = db_setup['user1']
    org_a = db_setup['org_a']
    api_client.force_authenticate(user=user_owner)
    set_current_organization_id(org_a.id)

    # 1. Create product and customer
    product = Product.objects.create(
        organization=org_a,
        name='Premium Consulting',
        sku='CONS-PREM',
        description='Hourly high-end consulting services',
        price=Decimal('200.00'),
        tax_rate=Decimal('18.00'),
        is_active=True
    )
    from apps.customers.models import Customer
    cust = Customer.objects.create(
        organization=org_a,
        contact_name='Test Cust B',
        email='custb@example.com',
        phone='9999988888',
        created_by=user_owner
    )

    # 2. Create invoice with current price (200.00)
    res_orig = api_client.post(
        '/api/v1/invoices/',
        {
            'customer': str(cust.id),
            'issue_date': str(timezone.now().date()),
            'due_date': str(timezone.now().date() + timezone.timedelta(days=30)),
            'status': 'approved',
            'line_items': [{
                'product': str(product.id),
                'quantity': 5,
            }]
        },
        format='json',
        HTTP_X_TENANT_ID=str(org_a.id)
    )
    assert res_orig.status_code == status.HTTP_201_CREATED
    invoice_id = res_orig.data['id']

    # 3. Modify product price/description in master catalog (simulating admin updates catalog)
    product.price = Decimal('250.00')
    product.description = 'Updated Consulting hourly tariff rate'
    product.save()

    # 4. Duplicate original invoice
    res_dup = api_client.post(
        f'/api/v1/invoices/{invoice_id}/duplicate/',
        format='json',
        HTTP_X_TENANT_ID=str(org_a.id)
    )
    assert res_dup.status_code == status.HTTP_201_CREATED

    # Check duplicated invoice totals and line items reflect updated catalog
    dup_invoice = Invoice.objects.get(id=res_dup.data['id'])
    dup_line = dup_invoice.line_items.first()
    assert dup_line.description == 'Updated Consulting hourly tariff rate'
    assert dup_line.unit_price == Decimal('250.00')
    assert dup_invoice.subtotal == Decimal('1250.00') # 5 * 250.00
