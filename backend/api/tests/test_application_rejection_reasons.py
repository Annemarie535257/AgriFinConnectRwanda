import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework import status

from api.models import ApplicationStatusUpdate, LoanApplication, LoanApplicationDocument


FARMER_APPLICATIONS_URL = '/api/farmer/applications/'


def _make_application(user, **overrides):
    payload = {
        'user': user,
        'age': 38,
        'annual_income': 450000,
        'credit_score': 540,
        'loan_amount_requested': 1500000,
        'loan_duration_months': 24,
        'employment_status': 'Self-Employed',
        'education_level': 'Primary',
        'marital_status': 'Married',
        'loan_purpose': 'Farm expansion',
        'eligibility_approved': False,
        'eligibility_reason': 'The requested loan amount is too high compared with the declared income.',
        'status': 'pending',
    }
    payload.update(overrides)
    return LoanApplication.objects.create(**payload)


@pytest.mark.django_db
class TestApplicationRejectionReasons:
    def test_mfi_reject_builds_combined_rejection_reason(self, auth_mfi_client, farmer_user):
        farmer, _ = farmer_user
        app = _make_application(farmer)

        response = auth_mfi_client.post(
            f'/api/mfi/applications/{app.id}/update-status/',
            {
                'status': 'rejected',
                'note': 'The submitted ID scan is unreadable and the proof of income does not match the figures entered.',
            },
            format='json',
        )

        assert response.status_code == status.HTTP_200_OK
        app.refresh_from_db()
        assert 'requested loan amount is too high compared with the declared income' in app.rejection_reason
        assert 'National ID or Passport' in app.rejection_reason
        assert 'Proof of income / Bank statements' in app.rejection_reason
        assert 'Spouse ID (if married)' in app.rejection_reason
        assert 'ID scan is unreadable' in app.rejection_reason
        assert ApplicationStatusUpdate.objects.filter(application=app, status='rejected', note=app.rejection_reason).exists()

    def test_documents_requested_without_note_generates_document_guidance(self, auth_mfi_client, farmer_user):
        farmer, _ = farmer_user
        app = _make_application(farmer)
        LoanApplicationDocument.objects.create(
            application=app,
            document_type='national_id',
            file=SimpleUploadedFile('id.pdf', b'id-content', content_type='application/pdf'),
        )

        response = auth_mfi_client.post(
            f'/api/mfi/applications/{app.id}/update-status/',
            {'status': 'documents_requested'},
            format='json',
        )

        assert response.status_code == status.HTTP_200_OK
        latest_update = ApplicationStatusUpdate.objects.filter(application=app, status='documents_requested').latest('created_at')
        assert 'Proof of income / Bank statements' in latest_update.note
        assert 'Recommendation letter' in latest_update.note
        assert 'correct and re-upload the documents' in latest_update.note

    def test_farmer_application_list_includes_rejection_reason(self, auth_farmer_client, farmer_user):
        farmer, _ = farmer_user
        app = _make_application(
            farmer,
            status='rejected',
            rejection_reason='Rejected because income evidence is missing and uploaded documents are inconsistent.',
        )

        response = auth_farmer_client.get(FARMER_APPLICATIONS_URL)

        assert response.status_code == status.HTTP_200_OK
        applications = response.json()['applications']
        matching = next(item for item in applications if item['id'] == app.id)
        assert matching['eligibility_reason'] == app.eligibility_reason
        assert matching['rejection_reason'] == app.rejection_reason