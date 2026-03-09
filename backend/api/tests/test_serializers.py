"""
Unit tests for DRF serializers (no HTTP layer, no DB hit for most cases).
  RegisterSerializer
  LoginSerializer
"""
import pytest
from django.contrib.auth import get_user_model

from api.models import UserProfile
from api.serializers import LoginSerializer, RegisterSerializer

User = get_user_model()


# ---------------------------------------------------------------------------
# RegisterSerializer
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestRegisterSerializer:
    def _valid_data(self, email='user@example.com', role='farmer'):
        return {'email': email, 'password': 'SecurePass1!', 'role': role, 'name': 'Test User'}

    def test_valid_farmer_data(self):
        s = RegisterSerializer(data=self._valid_data())
        assert s.is_valid(), s.errors

    def test_valid_microfinance_data(self):
        s = RegisterSerializer(data=self._valid_data(role='microfinance'))
        assert s.is_valid(), s.errors

    def test_invalid_role_rejected(self):
        s = RegisterSerializer(data=self._valid_data(role='admin'))
        assert not s.is_valid()
        assert 'role' in s.errors

    def test_short_password_rejected(self):
        data = self._valid_data()
        data['password'] = '1234'
        s = RegisterSerializer(data=data)
        assert not s.is_valid()
        assert 'password' in s.errors

    def test_invalid_email_rejected(self):
        data = self._valid_data(email='not-an-email')
        s = RegisterSerializer(data=data)
        assert not s.is_valid()
        assert 'email' in s.errors

    def test_duplicate_email_rejected(self):
        """validate_email raises if username already exists."""
        User.objects.create_user(username='existing@test.com', email='existing@test.com', password='x')
        data = self._valid_data(email='existing@test.com')
        s = RegisterSerializer(data=data)
        assert not s.is_valid()
        assert 'email' in s.errors

    def test_name_is_optional(self):
        data = {'email': 'noname@test.com', 'password': 'SecurePass1!', 'role': 'farmer'}
        s = RegisterSerializer(data=data)
        assert s.is_valid(), s.errors

    def test_create_makes_user_and_profile(self):
        s = RegisterSerializer(data=self._valid_data(email='create@test.com'))
        assert s.is_valid()
        user = s.save()
        assert user.pk is not None
        profile = UserProfile.objects.get(user=user)
        assert profile.role == 'farmer'


# ---------------------------------------------------------------------------
# LoginSerializer
# ---------------------------------------------------------------------------

class TestLoginSerializer:
    def test_valid_data(self):
        s = LoginSerializer(data={'email': 'user@example.com', 'password': 'anything'})
        assert s.is_valid(), s.errors

    def test_missing_email(self):
        s = LoginSerializer(data={'password': 'anything'})
        assert not s.is_valid()
        assert 'email' in s.errors

    def test_missing_password(self):
        s = LoginSerializer(data={'email': 'user@example.com'})
        assert not s.is_valid()
        assert 'password' in s.errors

    def test_invalid_email_format(self):
        s = LoginSerializer(data={'email': 'not-valid', 'password': 'anything'})
        assert not s.is_valid()
        assert 'email' in s.errors
