import pytest

from api.pdf_statement_service import analyze_statement
from api.fraud_service import FraudModelUnavailable


@pytest.mark.django_db
def test_analyze_statement_propagates_model_unavailable(monkeypatch):
    monkeypatch.setattr(
        "api.pdf_statement_service.extract_transactions_from_pdf",
        lambda _file_obj: [
            {
                "date": None,
                "description": "sample",
                "tx_type": "Debit",
                "amount": 1000.0,
                "balance": 5000.0,
            }
        ],
    )

    def _raise(_payload):
        raise FraudModelUnavailable("model unavailable")

    monkeypatch.setattr("api.fraud_service.predict_fraud", _raise)

    with pytest.raises(FraudModelUnavailable):
        analyze_statement(file_obj=b"dummy", customer_age=35, occupation="Engineer")
