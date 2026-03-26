"""
PDF Bank Statement Parser
=========================
Extracts transactions from a PDF bank statement and runs each one
through the fraud detection model.

Supports common African/Rwandan bank statement layouts:
  - Table-based statements (BK, Equity, I&M, KCB, Cogebanque, etc.)
  - Text-based fallback using regex line scanning

Returns a list of dicts, one per detected transaction, each containing
the original fields plus the fraud prediction result.
"""
from __future__ import annotations

import io
import logging
import re
from datetime import datetime
from typing import Any

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Date patterns commonly found in Rwandan / East African bank statements
# ---------------------------------------------------------------------------
_DATE_PATTERNS = [
    r"\d{2}[/-]\d{2}[/-]\d{4}",   # 31/01/2024
    r"\d{4}[/-]\d{2}[/-]\d{2}",   # 2024-01-31
    r"\d{2}\s+\w{3}\s+\d{4}",     # 31 Jan 2024
    r"\w{3}\s+\d{2},?\s+\d{4}",   # Jan 31, 2024
    r"\d{2}\s+\w{3}",             # 31 Jan  (no year — filled from context)
]
_DATE_RE = re.compile("|".join(_DATE_PATTERNS), re.IGNORECASE)

# Amount: digits with optional commas/spaces then optional decimal part
_AMOUNT_RE = re.compile(r"\b(\d[\d,\s]*(?:\.\d{1,2})?)\b")

# Debit / credit markers
_DEBIT_KEYWORDS  = re.compile(r"\b(debit|dr|withdrawal|payment|purchase|transfer out|fee)\b", re.I)
_CREDIT_KEYWORDS = re.compile(r"\b(credit|cr|deposit|receive|transfer in|salary|income)\b", re.I)

# ---------------------------------------------------------------------------
# Bank statement document validator
# ---------------------------------------------------------------------------
# Groups of keywords — at least MIN_GROUPS must have at least one match
_STATEMENT_KEYWORD_GROUPS = [
    # Group 1 — account/statement identity
    re.compile(
        r"\b(account\s*(number|no|#)|statement of account|bank statement|account statement|"
        r"releve de compte|extrait de compte)\b",
        re.I,
    ),
    # Group 2 — balance indicators
    re.compile(
        r"\b(opening balance|closing balance|available balance|current balance|ledger balance|running balance|"
        r"solde d'ouverture|solde de cloture|solde disponible|solde courant)\b",
        re.I,
    ),
    # Group 3 — transaction table markers
    re.compile(r"\b(debit|credit|withdrawal|deposit|transfer|dr\b|cr\b|retrait|versement|virement)\b", re.I),
    # Group 4 — bank/financial institution names or generic "bank"
    re.compile(r"\b(bank|microfinance|savings|equity|cogebanque|kcb|i&m|bk|access|gt bank|zenith|brd|umurenge)\b", re.I),
    # Group 5 — statement period / date range header
    re.compile(r"\b(from|to|period|statement date|as at|date range|print date|periode|date d'impression)\b", re.I),
]
_MIN_STATEMENT_GROUPS = 3   # document must satisfy at least this many groups


def _count_transaction_like_lines(full_text: str) -> int:
    """Count lines that look like transaction rows (date + at least one amount)."""
    count = 0
    for raw_line in full_text.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        if _DATE_RE.search(line) and _AMOUNT_RE.search(line):
            count += 1
    return count


def _check_is_bank_statement(full_text: str) -> tuple[bool, str]:
    """
    Heuristically decide whether *full_text* looks like a bank statement.

    Returns (is_valid, reason_string).
    """
    if not full_text or len(full_text.strip()) < 50:
        return False, "PDF appears to be empty or contains no extractable text."

    group_matches = [bool(pat.search(full_text)) for pat in _STATEMENT_KEYWORD_GROUPS]
    matched_groups = sum(group_matches)

    # Named signals to keep heuristics strict enough for non-statement PDFs.
    has_identity_signal = group_matches[0] or group_matches[3]   # account/statement wording or bank name
    has_tx_signal = group_matches[2]                             # debit/credit markers

    # Supplemental evidence for valid statements that use unusual headers/layouts.
    date_hits = len(_DATE_RE.findall(full_text))
    amount_hits = len(_AMOUNT_RE.findall(full_text))
    tx_like_lines = _count_transaction_like_lines(full_text)

    has_tabular_evidence = (
        tx_like_lines >= 4
        or (date_hits >= 6 and amount_hits >= 12)
    )

    if matched_groups >= _MIN_STATEMENT_GROUPS:
        return True, "ok"

    # Allow likely statements when keyword groups are low but transaction evidence is strong.
    if matched_groups >= 2 and has_tabular_evidence and has_identity_signal and has_tx_signal:
        return True, "ok_heuristic"

    if matched_groups < _MIN_STATEMENT_GROUPS:
        return (
            False,
            f"This document does not appear to be a bank statement "
            f"(matched only {matched_groups}/{len(_STATEMENT_KEYWORD_GROUPS)} expected keyword groups; "
            f"found {tx_like_lines} transaction-like lines, {date_hits} date patterns, {amount_hits} amount patterns). "
            "Please upload a valid bank statement PDF.",
        )
    return True, "ok"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _parse_amount(text: str) -> float | None:
    """Return the largest numeric amount found in a string (removes commas)."""
    candidates = []
    for m in _AMOUNT_RE.finditer(text.replace(" ", "")):
        try:
            candidates.append(float(m.group(1).replace(",", "")))
        except ValueError:
            pass
    return max(candidates) if candidates else None


def _parse_date(text: str) -> datetime | None:
    m = _DATE_RE.search(text)
    if not m:
        return None
    raw = m.group(0).strip()
    for fmt in ("%d/%m/%Y", "%d-%m-%Y", "%Y-%m-%d", "%Y/%m/%d",
                "%d %b %Y", "%b %d, %Y", "%b %d %Y", "%d %b"):
        try:
            d = datetime.strptime(raw, fmt)
            if d.year == 1900:  # partial date — use current year
                d = d.replace(year=datetime.now().year)
            return d
        except ValueError:
            continue
    return None


def _detect_tx_type(row_text: str) -> str:
    if _CREDIT_KEYWORDS.search(row_text):
        return "Credit"
    if _DEBIT_KEYWORDS.search(row_text):
        return "Debit"
    return "Debit"   # safe default — most transactions are debits


def _days_since(current: datetime | None, previous: datetime | None) -> float:
    if current and previous:
        delta = (current - previous).total_seconds() / 86400
        return max(0.0, round(delta, 1))
    return 1.0


def _extract_rows_from_table(table: list[list[str | None]]) -> list[dict]:
    """
    Heuristically find date, description, debit, credit, balance columns
    from a pdfplumber table (list of rows, each a list of cell strings).
    """
    rows = []
    header_map: dict[str, int] = {}

    # Try to identify header row
    for i, row in enumerate(table[:5]):
        cells = [str(c or "").strip().lower() for c in row]
        joined = " ".join(cells)
        if any(k in joined for k in ("date", "amount", "balance", "debit", "credit")):
            header_map = {c: idx for idx, c in enumerate(cells) if c}
            table = table[i + 1:]
            break

    for row in table:
        if not row or all(c is None or str(c).strip() == "" for c in row):
            continue
        cells = [str(c or "").strip() for c in row]

        # ------ Date ------
        date_val: datetime | None = None
        date_col = next((header_map.get(k) for k in ("date", "value date", "trans date", "txn date") if k in header_map), None)
        if date_col is not None and date_col < len(cells):
            date_val = _parse_date(cells[date_col])
        if not date_val:
            for cell in cells:
                date_val = _parse_date(cell)
                if date_val:
                    break

        # ------ Description / type ------
        desc = ""
        for k in ("description", "narration", "details", "particulars", "remarks"):
            if k in header_map:
                col = header_map[k]
                if col < len(cells):
                    desc = cells[col]
                    break
        if not desc:
            # Use longest non-numeric cell
            desc = max(cells, key=lambda c: len(c) if not c.replace(",", "").replace(".", "").isdigit() else 0, default="")

        tx_type = _detect_tx_type(desc + " " + " ".join(cells))

        # ------ Amounts ------
        amount: float | None = None
        balance: float | None = None

        debit_col  = next((header_map.get(k) for k in ("debit", "dr", "withdrawals", "payment") if k in header_map), None)
        credit_col = next((header_map.get(k) for k in ("credit", "cr", "deposits", "receipts") if k in header_map), None)
        balance_col = next((header_map.get(k) for k in ("balance", "running balance", "available balance") if k in header_map), None)

        if debit_col is not None and debit_col < len(cells):
            amount = _parse_amount(cells[debit_col])
        if amount is None and credit_col is not None and credit_col < len(cells):
            amount = _parse_amount(cells[credit_col])
            if amount:
                tx_type = "Credit"
        if balance_col is not None and balance_col < len(cells):
            balance = _parse_amount(cells[balance_col])

        # Fallback: grab largest two numbers from the row
        if amount is None or balance is None:
            numeric_vals = sorted(
                [_parse_amount(c) for c in cells if _parse_amount(c) is not None],
                reverse=True,
            )
            if len(numeric_vals) >= 2 and amount is None:
                amount = numeric_vals[1]   # second largest = likely amount
            if len(numeric_vals) >= 1 and balance is None:
                balance = numeric_vals[0]  # largest = likely balance

        if amount is None or amount <= 0:
            continue  # skip rows with no amount

        rows.append({
            "date": date_val,
            "description": desc,
            "tx_type": tx_type,
            "amount": amount,
            "balance": balance or 0.0,
        })
    return rows


def _extract_rows_from_text(text: str) -> list[dict]:
    """
    Fallback: scan each line of text for a date + amount pattern.
    """
    rows = []
    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue
        date_val = _parse_date(line)
        amounts = [float(m.group(1).replace(",", "")) for m in _AMOUNT_RE.finditer(line.replace(" ", "")) if float(m.group(1).replace(",", "")) > 0]
        if not date_val or len(amounts) < 1:
            continue
        amount = amounts[0] if len(amounts) == 1 else sorted(amounts)[len(amounts) // 2]
        balance = max(amounts) if len(amounts) >= 2 else 0.0
        tx_type = _detect_tx_type(line)
        rows.append({
            "date": date_val,
            "description": line[:80],
            "tx_type": tx_type,
            "amount": amount,
            "balance": balance,
        })
    return rows


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def extract_transactions_from_pdf(file_obj: Any) -> list[dict]:
    """
    Parse a PDF bank statement and return a list of raw transaction dicts.
    Each dict has: date, description, tx_type, amount, balance.

    `file_obj` can be a Django InMemoryUploadedFile, a file path string, or
    any file-like object.
    """
    try:
        import pdfplumber
    except ImportError:
        raise RuntimeError("pdfplumber is required. Add it to requirements.txt and reinstall.")

    if hasattr(file_obj, "read"):
        pdf_bytes = file_obj.read()
        if hasattr(file_obj, "seek"):
            file_obj.seek(0)
        pdf_io = io.BytesIO(pdf_bytes)
    else:
        pdf_io = file_obj  # assume path

    all_rows: list[dict] = []

    with pdfplumber.open(pdf_io) as pdf:
        # ── Step 0: validate this is actually a bank statement ────────────
        full_text = "\n".join(
            page.extract_text() or "" for page in pdf.pages
        )
        is_statement, reason = _check_is_bank_statement(full_text)
        if not is_statement:
            raise ValueError(reason)

        for page in pdf.pages:
            # 1) Try table extraction first (most accurate)
            tables = page.extract_tables()
            for table in tables:
                if len(table) < 2:
                    continue
                rows = _extract_rows_from_table(table)
                all_rows.extend(rows)

            # 2) Fall back to text scan if no table rows found on this page
            if not any(r.get("amount") for r in all_rows):
                page_text = page.extract_text() or ""
                all_rows.extend(_extract_rows_from_text(page_text))

    return all_rows


def analyze_statement(file_obj: Any, customer_age: int = 35, occupation: str = "Engineer") -> dict:
    """
    Full pipeline: extract transactions from PDF → run each through fraud model.

    Returns:
        {
            "total_transactions": int,
            "flagged_count": int,
            "high_risk_count": int,
            "transactions": [
                {
                    "index": int,
                    "date": str,
                    "description": str,
                    "tx_type": str,
                    "amount": float,
                    "balance": float,
                    "is_fraud": bool,
                    "fraud_probability": float,
                    "risk_score": float,
                    "risk_level": str,
                    "anomaly_score": float,
                },
                ...
            ],
            "parse_warnings": [str],
        }
    """
    from api.fraud_service import predict_fraud

    raw_rows = extract_transactions_from_pdf(file_obj)
    if not raw_rows:
        return {
            "total_transactions": 0,
            "flagged_count": 0,
            "high_risk_count": 0,
            "transactions": [],
            "parse_warnings": ["No transactions could be extracted from the PDF. "
                                "Ensure the PDF contains a standard bank statement table."],
        }

    results = []
    parse_warnings = []
    prev_date: datetime | None = None

    for idx, row in enumerate(raw_rows):
        try:
            current_date: datetime | None = row.get("date")
            days_since = _days_since(current_date, prev_date)
            if current_date:
                prev_date = current_date

            tx_hour = current_date.hour if current_date else 12.0

            payload = {
                "TransactionAmount":   row["amount"],
                "AccountBalance":      row["balance"] if row["balance"] > 0 else row["amount"] * 2,
                "LoginAttempts":       1,
                "TransactionDuration": 60,
                "CustomerAge":         customer_age,
                "TransactionType":     row["tx_type"],
                "Channel":             "Branch",   # bank statement = branch/counter
                "CustomerOccupation":  occupation,
                "TxHour":              tx_hour,
                "DaysSinceLastTx":     days_since,
            }

            fraud_result = predict_fraud(payload)
            results.append({
                "index":             idx + 1,
                "date":              current_date.strftime("%Y-%m-%d %H:%M") if current_date else "—",
                "description":       row.get("description", ""),
                "tx_type":           row["tx_type"],
                "amount":            round(row["amount"], 2),
                "balance":           round(row["balance"], 2),
                "is_fraud":          fraud_result["is_fraud"],
                "fraud_probability": fraud_result["fraud_probability"],
                "risk_score":        fraud_result["risk_score"],
                "risk_level":        fraud_result["risk_level"],
                "anomaly_score":     fraud_result["anomaly_score"],
            })
        except Exception as exc:
            parse_warnings.append(f"Row {idx + 1}: {exc}")
            logger.warning("Failed to analyse row %d: %s", idx + 1, exc)

    flagged   = [r for r in results if r["is_fraud"]]
    high_risk = [r for r in results if r["risk_level"] == "HIGH"]

    return {
        "total_transactions": len(results),
        "flagged_count":      len(flagged),
        "high_risk_count":    len(high_risk),
        "transactions":       results,
        "parse_warnings":     parse_warnings,
    }


def flag_statement(file_obj: Any, customer_age: int = 35, occupation: str = "Engineer") -> dict:
    """
    High-level function: analyse a PDF bank statement and return a single
    statement-level fraud verdict.

    Logic:
      - Extract all transactions from the PDF.
      - Score each transaction with the fraud detection model.
      - The statement is flagged as fraudulent if ANY transaction is flagged as fraud.
      - The overall risk level is the worst (highest) risk level across all transactions.
      - An overall risk score is computed as the maximum individual risk score.

    Returns:
        {
            "statement_is_fraud":   bool,
            "statement_risk_level": "LOW" | "MEDIUM" | "HIGH",
            "statement_risk_score": float,          # 0-100 — worst transaction score
            "fraud_ratio":          float,          # flagged / total (0.0-1.0)
            "total_transactions":   int,
            "flagged_count":        int,
            "high_risk_count":      int,
            "worst_transaction":    dict | None,    # the single most suspicious tx
            "transactions":         list[dict],
            "parse_warnings":       list[str],
        }
    """
    analysis = analyze_statement(file_obj, customer_age=customer_age, occupation=occupation)

    transactions  = analysis["transactions"]
    flagged_count = analysis["flagged_count"]
    total         = analysis["total_transactions"]

    # Statement-level verdict
    statement_is_fraud = flagged_count > 0

    # Worst risk level (HIGH > MEDIUM > LOW)
    _level_order = {"HIGH": 3, "MEDIUM": 2, "LOW": 1}
    if transactions:
        worst_tx = max(transactions, key=lambda tx: tx["risk_score"])
        statement_risk_score = worst_tx["risk_score"]
        statement_risk_level = worst_tx["risk_level"]
    else:
        worst_tx             = None
        statement_risk_score = 0.0
        statement_risk_level = "LOW"

    fraud_ratio = round(flagged_count / total, 4) if total > 0 else 0.0

    return {
        "statement_is_fraud":   statement_is_fraud,
        "statement_risk_level": statement_risk_level,
        "statement_risk_score": statement_risk_score,
        "fraud_ratio":          fraud_ratio,
        "total_transactions":   total,
        "flagged_count":        flagged_count,
        "high_risk_count":      analysis["high_risk_count"],
        "worst_transaction":    worst_tx,
        "transactions":         transactions,
        "parse_warnings":       analysis["parse_warnings"],
    }
