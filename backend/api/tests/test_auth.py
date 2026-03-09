"""
Tests for authentication endpoints:
  POST /api/auth/register/
  POST /api/auth/login/
  POST /api/auth/forgot-password/
  POST /api/auth/reset-password/
"""
import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status

from api.models import PasswordResetToken, UserProfile

User = get_user_model()

REGISTER_URL = '/api/auth/register/'
LOGIN_URL = '/api/auth/login/'
FORGOT_URL = '/api/auth/forgot-password/'
RESET_URL = '/api/auth/reset-password/'


# ---------------------------------------------------------------------------
# Registration
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestRegister:
    def test_register_farmer_success(self, api_client):
        payload = {
            'email': 'newfarmer@test.com',
            'password': 'MySecret99!',
            'role': 'farmer',
            'name': 'Jean Pierre',
        }
        response = api_client.post(REGISTER_URL, payload, format='json')
        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        assert 'token' in data
        assert data['user']['role'] == 'farmer'
        assert data['user']['email'] == 'newfarmer@test.com'

    def test_register_microfinance_success(self, api_client):
        payload = {
            'email': 'mfinance@test.com',
            'password': 'MySecret99!',
            'role': 'microfinance',
        }
        response = api_client.post(REGISTER_URL, payload, format='json')
        assert response.status_code == status.HTTP_201_CREATED
        assert response.json()['user']['role'] == 'microfinance'

    def test_register_creates_user_profile(self, api_client):
        payload = {
            'email': 'farmer2@test.com',
            'password': 'MySecret99!',
            'role': 'farmer',
        }
        api_client.post(REGISTER_URL, payload, format='json')
        user = User.objects.get(username='farmer2@test.com')
        profile = UserProfile.objects.get(user=user)
        assert profile.role == 'farmer'

    def test_register_duplicate_email_fails(self, api_client, farmer_user):
        payload = {
            'email': 'farmer@test.com',  # already created by farmer_user fixture
            'password': 'AnotherPass1!',
            'role': 'farmer',
        }
        response = api_client.post(REGISTER_URL, payload, format='json')
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_register_invalid_role_fails(self, api_client):
        payload = {
            'email': 'someone@test.com',
            'password': 'MySecret99!',
            'role': 'admin',  # admin cannot self-register
        }
        response = api_client.post(REGISTER_URL, payload, format='json')
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_register_short_password_fails(self, api_client):
        payload = {
            'email': 'short@test.com',
            'password': '123',
            'role': 'farmer',
        }
        response = api_client.post(REGISTER_URL, payload, format='json')
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_register_missing_email_fails(self, api_client):
        payload = {'password': 'MySecret99!', 'role': 'farmer'}
        response = api_client.post(REGISTER_URL, payload, format='json')
        assert response.status_code == status.HTTP_400_BAD_REQUEST


# ---------------------------------------------------------------------------
# Login
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestLogin:
    def test_login_farmer_success(self, api_client, farmer_user):
        user, _ = farmer_user
        payload = {'email': 'farmer@test.com', 'password': 'StrongPass1!'}
        response = api_client.post(LOGIN_URL, payload, format='json')
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert 'token' in data
        assert data['user']['role'] == 'farmer'

    def test_login_returns_correct_role(self, api_client, mfi_user):
        payload = {'email': 'mfi@test.com', 'password': 'StrongPass1!'}
        response = api_client.post(LOGIN_URL, payload, format='json')
        assert response.status_code == status.HTTP_200_OK
        assert response.json()['user']['role'] == 'microfinance'

    def test_login_wrong_password_fails(self, api_client, farmer_user):
        payload = {'email': 'farmer@test.com', 'password': 'WrongPassword!'}
        response = api_client.post(LOGIN_URL, payload, format='json')
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        assert 'error' in response.json()

    def test_login_nonexistent_email_fails(self, api_client):
        payload = {'email': 'nobody@test.com', 'password': 'Whatever1!'}
        response = api_client.post(LOGIN_URL, payload, format='json')
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_login_case_insensitive_email(self, api_client, farmer_user):
        """Email lookup should be case-insensitive."""
        payload = {'email': 'FARMER@TEST.COM', 'password': 'StrongPass1!'}
        response = api_client.post(LOGIN_URL, payload, format='json')
        assert response.status_code == status.HTTP_200_OK

    def test_login_missing_fields_fails(self, api_client):
        response = api_client.post(LOGIN_URL, {}, format='json')
        assert response.status_code == status.HTTP_400_BAD_REQUEST


# ---------------------------------------------------------------------------
# Forgot / Reset password
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestPasswordReset:
    def test_forgot_password_known_email(self, api_client, farmer_user):
        """Should always return 200 (no email enumeration)."""
        response = api_client.post(FORGOT_URL, {'email': 'farmer@test.com'}, format='json')
        assert response.status_code == status.HTTP_200_OK
        assert 'message' in response.json()

    def test_forgot_password_unknown_email(self, api_client):
        """Unknown email still returns 200 to prevent enumeration."""
        response = api_client.post(FORGOT_URL, {'email': 'ghost@nowhere.com'}, format='json')
        assert response.status_code == status.HTTP_200_OK

    def test_forgot_password_missing_email(self, api_client):
        response = api_client.post(FORGOT_URL, {}, format='json')
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_reset_password_valid_token(self, api_client, farmer_user):
        user, _ = farmer_user
        prt = PasswordResetToken.create_for_user(user)
        response = api_client.post(
            RESET_URL,
            {'token': prt.token, 'new_password': 'NewSecure99!'},
            format='json',
        )
        assert response.status_code == status.HTTP_200_OK
        # Verify the new password actually works
        user.refresh_from_db()
        assert user.check_password('NewSecure99!')

    def test_reset_password_invalid_token(self, api_client):
        response = api_client.post(
            RESET_URL,
            {'token': 'invalid-token-xyz', 'new_password': 'NewSecure99!'},
            format='json',
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_reset_password_too_short(self, api_client, farmer_user):
        user, _ = farmer_user
        prt = PasswordResetToken.create_for_user(user)
        response = api_client.post(
            RESET_URL,
            {'token': prt.token, 'new_password': 'short'},
            format='json',
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_reset_password_missing_token(self, api_client):
        response = api_client.post(
            RESET_URL,
            {'new_password': 'NewSecure99!'},
            format='json',
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
