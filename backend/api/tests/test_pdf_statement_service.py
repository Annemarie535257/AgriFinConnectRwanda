from api.pdf_statement_service import _check_is_bank_statement, _extract_rows_from_text


def test_accepts_bank_statement_like_text():
    text = """
    BK Bank Statement
    Account Number: 1234567890
    Statement period: 01/01/2026 - 31/01/2026
    Opening balance 120,000
    Date Description Debit Credit Balance
    02/01/2026 ATM withdrawal 20,000 0 100,000
    05/01/2026 Salary credit 0 180,000 280,000
    10/01/2026 Transfer payment 50,000 0 230,000
    Closing balance 230,000
    """
    ok, reason = _check_is_bank_statement(text)
    assert ok is True, reason


def test_rejects_non_statement_report_text():
    text = """
    Monthly project report
    Attendance and activity report
    From 01/01/2026 to 31/01/2026
    Budget transfer summary 50,000
    Next month proposal and contract plan
    """
    ok, reason = _check_is_bank_statement(text)
    assert ok is False
    assert "not appear" in reason.lower() or "report" in reason.lower()


def test_rejects_empty_or_scanned_without_text():
    ok, reason = _check_is_bank_statement("  ")
    assert ok is False
    assert "extractable text" in reason.lower()


def test_accepts_statement_without_explicit_title_when_account_and_balances_exist():
    text = """
    BK Rwanda
    Account No: 001-234567-89
    Period covered: 01/01/2026 - 31/01/2026
    Opening balance 120,000
    Date Description Debit Credit Running Balance
    02/01/2026 ATM withdrawal 20,000 0 100,000
    05/01/2026 POS purchase 10,000 0 90,000
    10/01/2026 Salary credit 0 180,000 270,000
    15/01/2026 Transfer out 30,000 0 240,000
    20/01/2026 Deposit cash 0 40,000 280,000
    Closing balance 280,000
    """
    ok, reason = _check_is_bank_statement(text)
    assert ok is True, reason


def test_text_extraction_skips_balance_and_header_lines():
    text = """
    Statement period: 01/01/2026 - 31/01/2026
    Opening balance 120,000
    02/01/2026 ATM withdrawal 20,000 100,000
    03/01/2026 Available balance 98,000
    04/01/2026 Salary credit 180,000 278,000
    Closing balance 278,000
    """
    rows = _extract_rows_from_text(text)
    assert len(rows) == 2
    assert all("balance" not in r["raw_text"].lower() for r in rows)


def test_text_extraction_rejects_weak_single_amount_line_without_tx_keyword():
    text = """
    02/01/2026 Ref ABC 12345 50,000
    """
    rows = _extract_rows_from_text(text)
    assert rows == []


def test_accepts_dense_transaction_rows_even_when_keywords_are_sparse():
    lines = []
    for day in range(1, 19):
        lines.append(f"{day:02d}/01/2026 REF{day:03d} 12,000 245,000")
    text = "\n".join(lines)
    ok, reason = _check_is_bank_statement(text)
    assert ok is True, reason
