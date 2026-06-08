import pytest
from rest_framework import status
from apps.customers.models import Customer
from apps.core.context import set_current_organization_id

@pytest.mark.django_db
def test_rbac_role_enforcement(api_client, db_setup):
    """
    Verifies that roles (Owner vs Employee) have correct granular API permissions.
    """
    user_owner = db_setup['user1']
    user_staff = db_setup['employee']
    org_a = db_setup['org_a']

    # 1. Create a customer inside Org A
    set_current_organization_id(org_a.id)
    cust = Customer.objects.create(
        organization=org_a,
        contact_name='Existing Corporation Contact',
        email='finance@existing.com',
        phone='9876543210',
        created_by=user_owner
    )

    # 2. Authenticate as Employee: Try to update customer name
    api_client.force_authenticate(user=user_staff)
    res_staff = api_client.put(
        f'/api/v1/customers/{cust.id}/',
        {'contact_name': 'Hacked Contact', 'email': 'finance@existing.com', 'phone': '9876543210'},
        HTTP_X_TENANT_ID=str(org_a.id)
    )
    # Must yield 403 Forbidden because Employee does not have 'manage_customers' permission!
    assert res_staff.status_code == status.HTTP_403_FORBIDDEN

    # 3. Authenticate as Owner: Try to update customer name
    api_client.force_authenticate(user=user_owner)
    res_owner = api_client.put(
        f'/api/v1/customers/{cust.id}/',
        {'contact_name': 'Owner Approved Contact', 'email': 'finance@existing.com', 'phone': '9876543210'},
        HTTP_X_TENANT_ID=str(org_a.id)
    )
    # Must yield 200 OK because Owner has wildcard '*' permission!
    assert res_owner.status_code == status.HTTP_200_OK
    assert res_owner.data['contact_name'] == 'Owner Approved Contact'
