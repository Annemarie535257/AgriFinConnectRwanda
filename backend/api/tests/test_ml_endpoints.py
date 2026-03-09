"""
Tests for ML prediction endpoints:
  POST /api/eligibility/
  POST /api/risk/
  POST /api/recommend-amount/
  POST /api/chat/

ML model functions are mocked so tests run without needing the trained model files.
"""
import pytest
from unittest.mock import patch, MagicMock
from rest_framework import status

ELIGIBILITY_URL = '/api/eligibility/'
RISK_URL = '/api/risk/'
RECOMMEND_URL = '/api/recommend-amount/'
CHAT_URL = '/api/chat/'

# A realistic feature payload matching what the frontend sends
SAMPLE_ML_PAYLOAD = {
    'Age': 35,
    'AnnualIncome': 5000,
    'CreditScore': 650,
    'LoanAmount': 3000,
    'LoanDuration': 24,
    'EmploymentStatus': 'Employed',
    'EducationLevel': "Bachelor's",
    'MaritalStatus': 'Single',
    'NumberOfDependents': 1,
    'HomeOwnershipStatus': 'Rent',
    'MonthlyDebtPayments': 100,
    'CreditCardUtilizationRate': 0.3,
    'NumberOfOpenCreditLines': 2,
    'NumberOfCreditInquiries': 1,
    'DebtToIncomeRatio': 0.25,
    'BankruptcyHistory': 0,
    'LoanPurpose': 'Agriculture',
    'PreviousLoanDefaults': 0,
    'PaymentHistory': 95,
    'LengthOfCreditHistory': 5,
    'SavingsAccountBalance': 1000,
    'CheckingAccountBalance': 500,
    'TotalAssets': 10000,
    'TotalLiabilities': 2000,
    'MonthlyIncome': 416,
    'UtilityBillsPaymentHistory': 0.9,
    'JobTenure': 3,
    'NetWorth': 8000,
    'BaseInterestRate': 0.07,
    'InterestRate': 0.09,
    'MonthlyLoanPayment': 150,
    'TotalDebtToIncomeRatio': 0.35,
}


# ---------------------------------------------------------------------------
# /api/eligibility/
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestEligibilityEndpoint:
    def test_eligibility_approved(self, api_client):
        with patch('api.views.predict_eligibility', return_value=True), \
             patch('api.views.eligibility_reason', return_value='Good credit score'), \
             patch('api.views.eligibility_description', return_value='Eligibility check'):
            response = api_client.post(ELIGIBILITY_URL, SAMPLE_ML_PAYLOAD, format='json')
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data['approved'] is True
        assert data['prediction'] == 1

    def test_eligibility_denied(self, api_client):
        with patch('api.views.predict_eligibility', return_value=False), \
             patch('api.views.eligibility_reason', return_value='Low credit score'), \
             patch('api.views.eligibility_description', return_value='Eligibility check'):
            response = api_client.post(ELIGIBILITY_URL, SAMPLE_ML_PAYLOAD, format='json')
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data['approved'] is False
        assert data['prediction'] == 0

    def test_eligibility_response_has_reason(self, api_client):
        with patch('api.views.predict_eligibility', return_value=True), \
             patch('api.views.eligibility_reason', return_value='Stable income'), \
             patch('api.views.eligibility_description', return_value='desc'):
            response = api_client.post(ELIGIBILITY_URL, SAMPLE_ML_PAYLOAD, format='json')
        assert 'reason' in response.json()

    def test_eligibility_model_unavailable_returns_503(self, api_client):
        with patch('api.views.predict_eligibility', side_effect=FileNotFoundError('model missing')):
            response = api_client.post(ELIGIBILITY_URL, SAMPLE_ML_PAYLOAD, format='json')
        assert response.status_code == status.HTTP_503_SERVICE_UNAVAILABLE

    def test_eligibility_no_auth_required(self, api_client):
        """ML endpoints are public — no token needed."""
        with patch('api.views.predict_eligibility', return_value=True), \
             patch('api.views.eligibility_reason', return_value='ok'), \
             patch('api.views.eligibility_description', return_value='ok'):
            response = api_client.post(ELIGIBILITY_URL, SAMPLE_ML_PAYLOAD, format='json')
        assert response.status_code == status.HTTP_200_OK


# ---------------------------------------------------------------------------
# /api/risk/
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestRiskEndpoint:
    def test_risk_returns_score(self, api_client):
        with patch('api.views.predict_risk', return_value=0.42), \
             patch('api.views.risk_score_description', return_value={
                 'interpretation': 'Medium risk',
                 'description': 'desc',
                 'score_meaning': 'moderate',
             }):
            response = api_client.post(RISK_URL, SAMPLE_ML_PAYLOAD, format='json')
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert 'risk_score' in data
        assert data['risk_score'] == pytest.approx(0.42)

    def test_risk_response_structure(self, api_client):
        with patch('api.views.predict_risk', return_value=0.8), \
             patch('api.views.risk_score_description', return_value={
                 'interpretation': 'High risk',
                 'description': 'desc',
                 'score_meaning': 'high',
             }):
            response = api_client.post(RISK_URL, SAMPLE_ML_PAYLOAD, format='json')
        data = response.json()
        for field in ('risk_score', 'score', 'interpretation'):
            assert field in data, f"Missing field: {field}"

    def test_risk_model_unavailable_returns_503(self, api_client):
        with patch('api.views.predict_risk', side_effect=FileNotFoundError('model missing')):
            response = api_client.post(RISK_URL, SAMPLE_ML_PAYLOAD, format='json')
        assert response.status_code == status.HTTP_503_SERVICE_UNAVAILABLE


# ---------------------------------------------------------------------------
# /api/recommend-amount/
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestRecommendAmountEndpoint:
    def test_recommend_returns_amount(self, api_client):
        with patch('api.views.recommend_loan_amount', return_value=3000.0), \
             patch('api.views.recommend_amount_explanation', return_value={
                 'explanation': 'Based on income',
                 'basis': 'DTI',
             }):
            response = api_client.post(RECOMMEND_URL, SAMPLE_ML_PAYLOAD, format='json')
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert 'recommended_amount' in data
        assert data['recommended_amount'] > 0

    def test_recommend_caps_at_dti_ceiling(self, api_client):
        """Recommended amount must not exceed 35% DTI limit."""
        # AnnualIncome=5000 USD, duration=24 months → max = (5000/12)*0.35*24 ≈ 3500 USD → RWF
        with patch('api.views.recommend_loan_amount', return_value=999_999.0), \
             patch('api.views.recommend_amount_explanation', return_value={
                 'explanation': 'capped',
                 'basis': 'DTI',
             }):
            response = api_client.post(RECOMMEND_URL, SAMPLE_ML_PAYLOAD, format='json')
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        # With AnnualIncome=5000 and duration=24, the cap should limit the amount
        # (5000/12)*0.35*24 = 3500 USD; model returned 999_999 USD, so it must be capped
        # _RWF_TO_USD = 1350.0 in views.py
        monthly = 5000 / 12
        max_usd = monthly * 0.35 * 24
        rwf_rate = 1350
        assert data['recommended_amount'] <= max_usd * rwf_rate * 1.01  # small tolerance

    def test_recommend_model_unavailable_returns_503(self, api_client):
        with patch('api.views.recommend_loan_amount', side_effect=FileNotFoundError('model missing')):
            response = api_client.post(RECOMMEND_URL, SAMPLE_ML_PAYLOAD, format='json')
        assert response.status_code == status.HTTP_503_SERVICE_UNAVAILABLE


# ---------------------------------------------------------------------------
# /api/chat/
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestChatEndpoint:
    def test_chat_empty_message(self, api_client):
        response = api_client.post(CHAT_URL, {'message': '', 'language': 'en'}, format='json')
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert 'reply' in data

    def test_chat_english_reply(self, api_client):
        mock_generate = MagicMock(return_value='You are eligible for a loan.')
        with patch('api.chatbot_service.generate_reply', mock_generate):
            response = api_client.post(
                CHAT_URL,
                {'message': 'Am I eligible for a loan?', 'language': 'en'},
                format='json',
            )
        assert response.status_code == status.HTTP_200_OK
        assert 'reply' in response.json()

    def test_chat_model_unavailable_returns_fallback(self, api_client):
        """If chatbot model is unavailable, a 200 with a fallback message is returned."""
        with patch('api.chatbot_service.generate_reply', return_value=None), \
             patch('api.chatbot_service.get_load_error', return_value='model not loaded'):
            response = api_client.post(
                CHAT_URL,
                {'message': 'Hello', 'language': 'en'},
                format='json',
            )
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert 'reply' in data
        assert len(data['reply']) > 0

    def test_chat_exception_never_returns_500(self, api_client):
        """Chat endpoint must never return 500 — always graceful fallback."""
        with patch('api.chatbot_service.generate_reply', side_effect=RuntimeError('boom')):
            response = api_client.post(
                CHAT_URL,
                {'message': 'Test', 'language': 'en'},
                format='json',
            )
        assert response.status_code == status.HTTP_200_OK
