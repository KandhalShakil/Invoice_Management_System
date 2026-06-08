import pytest
from rest_framework import status
from django.core.exceptions import ValidationError
from apps.customers.models import Customer
from apps.organizations.models import Organization
from apps.core.context import set_current_organization_id

@pytest.mark.django_db
def test_phone_number_validation_rules(db_setup):
    """
    Verifies that phone numbers containing spaces, country codes, alphabets, 
    or wrong lengths are rejected at the model/database validation layer.
    """
    user_owner = db_setup['user1']
    org_a = db_setup['org_a']
    set_current_organization_id(org_a.id)

    # Valid phone (exactly 10 digits)
    cust = Customer(
        organization=org_a,
        contact_name='John Doe',
        email='john@example.com',
        phone='9876543210',
        created_by=user_owner
    )
    cust.full_clean()  # Should not raise any error
    cust.save()

    # Invalid phones
    invalid_phones = [
        '+919876543210',  # Country code
        '98765 43210',   # Space
        '987654321',     # 9 digits
        '98765432101',    # 11 digits
        '98765abc12',    # Alpha characters
        '98765-43210',   # Hyphen
    ]

    for bad_phone in invalid_phones:
        cust.phone = bad_phone
        with pytest.raises(ValidationError):
            cust.full_clean()


@pytest.mark.django_db
def test_organization_phone_validation(db_setup):
    """
    Verifies that organization phone numbers also enforce the 10-digit policy.
    """
    org = db_setup['org_a']
    org.phone = '9999988888'
    org.full_clean()  # Should pass

    invalid_phones = ['+919999988888', '99999-88888', '999', '12345678901']
    for bad_phone in invalid_phones:
        org.phone = bad_phone
        with pytest.raises(ValidationError):
            org.full_clean()


@pytest.mark.django_db
def test_api_validation_errors(api_client, db_setup):
    """
    Verifies that the APIs return 400 Bad Request when receiving invalid phone numbers.
    """
    user_owner = db_setup['user1']
    org_a = db_setup['org_a']
    
    api_client.force_authenticate(user=user_owner)

    # 1. Test Customer Create endpoint with bad phone
    res_cust = api_client.post(
        '/api/v1/customers/',
        {
            'contact_name': 'Bad Customer',
            'email': 'bad@example.com',
            'phone': '98765 43210',  # Invalid phone
            'billing_address': {},
            'shipping_address': {}
        },
        format='json',
        HTTP_X_TENANT_ID=str(org_a.id)
    )
    assert res_cust.status_code == status.HTTP_400_BAD_REQUEST
    assert 'phone' in res_cust.data or 'phone' in res_cust.data.get('detail', {})

    # 2. Test Organization Update endpoint with bad phone
    res_org = api_client.put(
        f'/api/v1/organizations/{org_a.id}/',
        {
            'name': 'Org New Name',
            'tax_number': '123456',
            'email': 'billing@org-a.com',
            'phone': '+91-1234567890',  # Invalid phone
            'logo_url': '',
            'billing_address': {}
        },
        format='json',
        HTTP_X_TENANT_ID=str(org_a.id)
    )
    assert res_org.status_code == status.HTTP_400_BAD_REQUEST
    assert 'phone' in res_org.data or 'phone' in res_org.data.get('detail', {})
