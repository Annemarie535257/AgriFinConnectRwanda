"""
Shared pytest fixtures for AgriFinConnect Rwanda backend tests.
"""
import pytest
from django.contrib.auth import get_user_model
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient

from api.models import UserProfile

User = get_user_model()


@pytest.fixture
def api_client():
    """Unauthenticated DRF test client."""
    return APIClient()


@pytest.fixture
def farmer_user(db):
    """A registered farmer user with a token."""
    user = User.objects.create_user(
        username='farmer@test.com',
        email='farmer@test.com',
        password='StrongPass1!',
        first_name='Alice',
    )
    UserProfile.objects.create(user=user, role='farmer')
    token, _ = Token.objects.get_or_create(user=user)
    return user, token.key


@pytest.fixture
def mfi_user(db):
    """A registered microfinance user with a token."""
    user = User.objects.create_user(
        username='mfi@test.com',
        email='mfi@test.com',
        password='StrongPass1!',
        first_name='BankCorp',
    )
    UserProfile.objects.create(user=user, role='microfinance')
    token, _ = Token.objects.get_or_create(user=user)
    return user, token.key


@pytest.fixture
def admin_user(db):
    """A superuser (admin) with a token."""
    user = User.objects.create_superuser(
        username='admin@test.com',
        email='admin@test.com',
        password='AdminPass1!',
    )
    token, _ = Token.objects.get_or_create(user=user)
    return user, token.key


@pytest.fixture
def auth_farmer_client(farmer_user):
    """APIClient pre-authenticated as a farmer."""
    _, token = farmer_user
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f'Token {token}')
    return client


@pytest.fixture
def auth_mfi_client(mfi_user):
    """APIClient pre-authenticated as a microfinance user."""
    _, token = mfi_user
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f'Token {token}')
    return client


@pytest.fixture
def auth_admin_client(admin_user):
    """APIClient pre-authenticated as an admin."""
    _, token = admin_user
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f'Token {token}')
    return client
