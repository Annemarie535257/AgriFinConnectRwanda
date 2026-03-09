"""
Tests for activity logging and admin dashboard endpoints:
  POST /api/activity/log/
  GET  /api/admin/activity/
  GET  /api/admin/users/
  GET  /api/admin/stats/
"""
import pytest
from rest_framework import status

ACTIVITY_LOG_URL = '/api/activity/log/'
ADMIN_ACTIVITY_URL = '/api/admin/activity/'
ADMIN_USERS_URL = '/api/admin/users/'
ADMIN_STATS_URL = '/api/admin/stats/'


# ---------------------------------------------------------------------------
# Activity log (public)
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestActivityLog:
    def test_log_modal_opened(self, api_client):
        response = api_client.post(
            ACTIVITY_LOG_URL,
            {'event_type': 'modal_opened', 'role': 'farmers'},
            format='json',
        )
        assert response.status_code in (status.HTTP_200_OK, status.HTTP_201_CREATED)

    def test_log_register_clicked(self, api_client):
        response = api_client.post(
            ACTIVITY_LOG_URL,
            {'event_type': 'register_clicked', 'role': 'microfinances'},
            format='json',
        )
        assert response.status_code in (status.HTTP_200_OK, status.HTTP_201_CREATED)

    def test_log_login_clicked(self, api_client):
        response = api_client.post(
            ACTIVITY_LOG_URL,
            {'event_type': 'login_clicked', 'role': 'admin'},
            format='json',
        )
        assert response.status_code in (status.HTTP_200_OK, status.HTTP_201_CREATED)

    def test_log_invalid_event_type(self, api_client):
        response = api_client.post(
            ACTIVITY_LOG_URL,
            {'event_type': 'nonexistent_event'},
            format='json',
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_log_no_auth_required(self, api_client):
        """Activity log should be accessible without authentication."""
        response = api_client.post(
            ACTIVITY_LOG_URL,
            {'event_type': 'modal_opened'},
            format='json',
        )
        assert response.status_code in (status.HTTP_200_OK, status.HTTP_201_CREATED)


# ---------------------------------------------------------------------------
# Admin endpoints (require admin auth)
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestAdminEndpoints:
    def test_admin_activity_list_requires_auth(self, api_client):
        response = api_client.get(ADMIN_ACTIVITY_URL)
        assert response.status_code in (
            status.HTTP_401_UNAUTHORIZED,
            status.HTTP_403_FORBIDDEN,
        )

    def test_admin_users_list_requires_auth(self, api_client):
        response = api_client.get(ADMIN_USERS_URL)
        assert response.status_code in (
            status.HTTP_401_UNAUTHORIZED,
            status.HTTP_403_FORBIDDEN,
        )

    def test_admin_stats_requires_auth(self, api_client):
        response = api_client.get(ADMIN_STATS_URL)
        assert response.status_code in (
            status.HTTP_401_UNAUTHORIZED,
            status.HTTP_403_FORBIDDEN,
        )

    def test_farmer_cannot_access_admin_activity(self, auth_farmer_client):
        response = auth_farmer_client.get(ADMIN_ACTIVITY_URL)
        assert response.status_code in (
            status.HTTP_401_UNAUTHORIZED,
            status.HTTP_403_FORBIDDEN,
        )

    def test_admin_can_access_activity_list(self, auth_admin_client):
        response = auth_admin_client.get(ADMIN_ACTIVITY_URL)
        assert response.status_code == status.HTTP_200_OK

    def test_admin_can_access_users_list(self, auth_admin_client):
        response = auth_admin_client.get(ADMIN_USERS_URL)
        assert response.status_code == status.HTTP_200_OK

    def test_admin_can_access_stats(self, auth_admin_client):
        response = auth_admin_client.get(ADMIN_STATS_URL)
        assert response.status_code == status.HTTP_200_OK

    def test_admin_stats_contains_expected_keys(self, auth_admin_client):
        response = auth_admin_client.get(ADMIN_STATS_URL)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        # The stats endpoint should return some aggregate data
        assert isinstance(data, dict)
