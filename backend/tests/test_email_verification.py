import pytest
from django.contrib.auth.tokens import default_token_generator
from django.utils.http import urlsafe_base64_encode
from django.utils.encoding import force_bytes
from rest_framework import status
from apps.authentication.models import User

@pytest.mark.django_db
def test_login_blocked_if_unverified(api_client, db_setup):
    """
    Verifies that unverified accounts (except superusers) are blocked on login.
    """
    unverified_user = db_setup['user1']
    unverified_user.is_verified = False
    unverified_user.save()

    # Attempt login via credentials
    res = api_client.post('/api/v1/auth/login/', {
        'email': unverified_user.email,
        'password': 'TestPassword123!'
    })
    
    assert res.status_code == status.HTTP_400_BAD_REQUEST
    assert 'email' in res.data
    assert 'verify' in res.data['email'][0].lower()


@pytest.mark.django_db
def test_login_allowed_if_verified(api_client, db_setup):
    """
    Verifies that verified accounts are allowed to login.
    """
    verified_user = db_setup['user1']
    verified_user.is_verified = True
    verified_user.save()

    res = api_client.post('/api/v1/auth/login/', {
        'email': verified_user.email,
        'password': 'TestPassword123!'
    })
    
    assert res.status_code == status.HTTP_200_OK
    assert 'tokens' in res.data


@pytest.mark.django_db
def test_login_allowed_for_superuser_unverified(api_client):
    """
    Verifies that superusers are allowed to login even if is_verified is False.
    """
    admin_user = User.objects.create_superuser(
        email='admin@saas.com',
        password='AdminPassword123!'
    )
    admin_user.is_verified = False
    admin_user.save()

    res = api_client.post('/api/v1/auth/login/', {
        'email': admin_user.email,
        'password': 'AdminPassword123!'
    })
    
    assert res.status_code == status.HTTP_200_OK


@pytest.mark.django_db
def test_verify_email_endpoint(api_client, db_setup):
    """
    Verifies that the /verify-email/ API endpoint successfully activates an account.
    """
    user = db_setup['user2']
    user.is_verified = False
    user.save()

    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = default_token_generator.make_token(user)

    res = api_client.post('/api/v1/auth/verify-email/', {
        'uid': uid,
        'token': token
    })

    assert res.status_code == status.HTTP_200_OK
    assert 'verified' in res.data['message'].lower()
    
    user.refresh_from_db()
    assert user.is_verified is True


@pytest.mark.django_db
def test_resend_verification_endpoint(api_client, db_setup):
    """
    Verifies that /resend-verification/ endpoint triggers a verification email.
    """
    user = db_setup['user2']
    user.is_verified = False
    user.save()

    res = api_client.post('/api/v1/auth/resend-verification/', {
        'email': user.email
    })

    assert res.status_code == status.HTTP_200_OK
    assert 'sent' in res.data['message'].lower()
