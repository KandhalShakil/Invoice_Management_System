import pytest
from rest_framework.test import APIClient
from apps.authentication.models import User
from apps.organizations.models import Organization, UserOrganizationMembership

@pytest.fixture
def api_client():
    return APIClient()

@pytest.fixture
def db_setup(db):
    """Seed base workspace users, organizations, and memberships."""
    # 1. Create two test users
    user1 = User.objects.create_user(
        email='user1@org-a.com',
        password='TestPassword123!',
        first_name='Alpha',
        last_name='User'
    )
    user2 = User.objects.create_user(
        email='user2@org-b.com',
        password='TestPassword123!',
        first_name='Beta',
        last_name='User'
    )

    # 2. Create two organizations
    org_a = Organization.objects.create(
        name='Organization Alpha',
        email='billing@org-a.com',
        created_by=user1
    )
    org_b = Organization.objects.create(
        name='Organization Beta',
        email='billing@org-b.com',
        created_by=user2
    )

    # 3. Create memberships (user1 -> org_a as owner, user2 -> org_b as owner)
    UserOrganizationMembership.objects.create(
        user=user1,
        organization=org_a,
        role='owner'
    )
    UserOrganizationMembership.objects.create(
        user=user2,
        organization=org_b,
        role='owner'
    )

    # 4. Create an employee inside org_a
    employee_user = User.objects.create_user(
        email='employee@org-a.com',
        password='TestPassword123!',
        first_name='Staff',
        last_name='Member'
    )
    UserOrganizationMembership.objects.create(
        user=employee_user,
        organization=org_a,
        role='employee'
    )

    return {
        'user1': user1,
        'user2': user2,
        'employee': employee_user,
        'org_a': org_a,
        'org_b': org_b,
    }
