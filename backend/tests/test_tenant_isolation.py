import pytest
from rest_framework import status
from apps.customers.models import Customer
from apps.core.context import set_current_organization_id

@pytest.mark.django_db
def test_tenant_data_leakage_protection(api_client, db_setup):
    """
    Verifies that customers created in Org A cannot be read or leaked by Org B users.
    """
    user1 = db_setup['user1']
    user2 = db_setup['user2']
    org_a = db_setup['org_a']
    org_b = db_setup['org_b']

    # 1. Create a customer inside Org A
    # Set organization context manually for the Manager scope
    set_current_organization_id(org_a.id)
    cust_a = Customer.objects.create(
        organization=org_a,
        contact_name='Client Alpha Ltd Contact',
        email='billing@client-a.com',
        phone='9876543210',
        created_by=user1
    )

    # 2. Query Org A customer list using Org A credentials
    api_client.force_authenticate(user=user1)
    # Pass Tenant ID header
    res_a = api_client.get('/api/v1/customers/', HTTP_X_TENANT_ID=str(org_a.id))
    assert res_a.status_code == status.HTTP_200_OK
    assert len(res_a.data['results']) == 1
    assert res_a.data['results'][0]['contact_name'] == 'Client Alpha Ltd Contact'

    # 3. Try to access Org A customers listing using Org B credentials
    api_client.force_authenticate(user=user2)
    res_b = api_client.get('/api/v1/customers/', HTTP_X_TENANT_ID=str(org_b.id))
    assert res_b.status_code == status.HTTP_200_OK
    # Must be empty because Org B user is scoped to Org B tenant!
    assert len(res_b.data['results']) == 0

    # 4. Try to direct GET Org A customer ID with Org B tenant context
    res_direct_b = api_client.get(
        f'/api/v1/customers/{cust_a.id}/', 
        HTTP_X_TENANT_ID=str(org_b.id)
    )
    # Must yield 404 because Org B's TenantManager filters it out!
    assert res_direct_b.status_code == status.HTTP_404_NOT_FOUND

    # 5. Try to direct GET Org A customer using mismatching tenant ID header
    res_mismatch = api_client.get(
        f'/api/v1/customers/{cust_a.id}/', 
        HTTP_X_TENANT_ID=str(org_a.id)
    )
    # Yields 403 Forbidden because User B doesn't belong to Org A!
    assert res_mismatch.status_code == status.HTTP_403_FORBIDDEN
