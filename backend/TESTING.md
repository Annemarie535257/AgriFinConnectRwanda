# AgriFinConnect Rwanda — Backend Testing Documentation

## Overview

The backend test suite uses **pytest** with the **pytest-django** plugin against a dedicated in-memory SQLite database. All 138 tests pass with no failures.

| Attribute | Value |
|---|---|
| Framework | pytest 9.0.2 + pytest-django 4.12.0 |
| Python | 3.11.9 |
| Django | 5.0.14 |
| Database | In-memory SQLite (created fresh for every test run) |
| Run date | March 9, 2026 |

---

## Running the Tests

```bash
# From the backend/ directory, with venv active
..\venv\Scripts\Activate.ps1
python -m pytest api/tests/ -v
```

To run a single test file:

```bash
python -m pytest api/tests/test_models.py -v
python -m pytest api/tests/test_auth.py -v
python -m pytest api/tests/test_activity.py -v
python -m pytest api/tests/test_ml_endpoints.py -v
python -m pytest api/tests/test_serializers.py -v
```

---

## Test Files

| File | Tests | Area |
|---|---|---|
| `api/tests/test_models.py` | 78 | Database models |
| `api/tests/test_auth.py` | 21 | Authentication API endpoints |
| `api/tests/test_activity.py` | 13 | Activity logging & admin API |
| `api/tests/test_ml_endpoints.py` | 15 | ML prediction & chatbot endpoints |
| `api/tests/test_serializers.py` | 12 | DRF serializer validation |
| **Total** | **138** | |

Supporting files:

- `conftest.py` — shared pytest fixtures (users, tokens, authenticated clients)
- `pytest.ini` — pytest configuration (Django settings module, verbosity)

---

## Shared Fixtures (`conftest.py`)

| Fixture | Description |
|---|---|
| `api_client` | Unauthenticated DRF `APIClient` |
| `farmer_user` | Farmer user + auth token |
| `mfi_user` | Microfinance user + auth token |
| `admin_user` | Superuser + auth token |
| `auth_farmer_client` | `APIClient` pre-authenticated as farmer |
| `auth_mfi_client` | `APIClient` pre-authenticated as microfinance |
| `auth_admin_client` | `APIClient` pre-authenticated as admin |

---

## Test Results — March 9, 2026

```
============================= test session info =============================
platform win32 -- Python 3.11.9, pytest-9.0.2, pluggy-1.6.0
django: version 5.0.14, settings: config.settings
collected 138 items

================== 138 passed, 50 warnings in 76.46s (0:01:16) ==================
```

**Result: 138/138 PASSED — 0 failures**

---

## Detailed Test Coverage

### 1. Model Tests (`test_models.py`) — 78 tests

Tests every Django model for correct creation, field defaults, string representation, relationship integrity, cascade delete behaviour, and business-logic class methods.

#### `UserProfile`
| Test | What it verifies |
|---|---|
| `test_create_farmer_profile` | A farmer UserProfile can be created and saved |
| `test_create_microfinance_profile` | A microfinance UserProfile can be created |
| `test_str_representation` | `__str__` returns `"<email> (<role>)"` |
| `test_one_to_one_user_link` | `user.agrifin_profile` reverse accessor works |
| `test_duplicate_profile_raises` | Creating two profiles for the same user raises `IntegrityError` |
| `test_cascade_delete_with_user` | Deleting the User also deletes the UserProfile |

#### `GetStartedEvent`
| Test | What it verifies |
|---|---|
| `test_create_event` | Event saved with correct `event_type` |
| `test_str_contains_event_type` | `__str__` includes the event type |
| `test_default_role_is_empty_string` | `role` defaults to `""` |
| `test_ip_address_optional` | `ip_address` can be `None` |
| `test_ordering_newest_first` | Records are ordered by `-created_at` |

#### `PasswordResetToken`
| Test | What it verifies |
|---|---|
| `test_create_for_user_generates_token` | `create_for_user()` generates a non-empty token |
| `test_token_is_unique` | Two different users get different tokens |
| `test_create_for_user_deletes_previous_tokens` | Old tokens for the same user are invalidated |
| `test_get_valid_user_returns_user` | Valid token returns the correct user |
| `test_get_valid_user_deletes_token_after_use` | Token is deleted after one use (one-time) |
| `test_get_valid_user_with_expired_token` | Expired token returns `None` |
| `test_get_valid_user_with_wrong_token` | Unknown token returns `None` |
| `test_default_expiry_is_one_hour_from_now` | Token expires exactly 1 hour after creation |
| `test_cascade_delete_with_user` | Tokens are deleted when the user is deleted |
| `test_str_contains_email` | `__str__` includes the user's email |

#### `FarmerProfile`
| Test | What it verifies |
|---|---|
| `test_create_minimal` | Profile created with just a user |
| `test_str_contains_username` | `__str__` includes the username |
| `test_optional_fields_default_blank` | `location`, `phone`, `cooperative_name` default to `""` |
| `test_reverse_relation` | `user.farmer_profile` reverse accessor works |
| `test_cascade_delete_with_user` | Deleting user deletes FarmerProfile |

#### `AgriculturalRecord`
| Test | What it verifies |
|---|---|
| `test_create` | Record created with crop and land size |
| `test_str_contains_crop_and_user` | `__str__` includes crop type and username |
| `test_default_land_size_is_zero` | `land_size_hectares` defaults to `0` |
| `test_estimated_yield_can_be_null` | `estimated_yield` is nullable |
| `test_multiple_records_per_user` | A user can have many agricultural records |
| `test_cascade_delete_with_user` | Deleting user deletes all their records |

#### `FarmEmployee`
| Test | What it verifies |
|---|---|
| `test_create` | Employee created with correct defaults (`currency='RWF'`, `status='active'`) |
| `test_str` | `__str__` includes the employee full name |
| `test_status_default_active` | `status` defaults to `'active'` |
| `test_pay_amount_optional` | `pay_amount` can be `None` |

#### `SeedStock`
| Test | What it verifies |
|---|---|
| `test_create` | Stock created with defaults (`unit='kg'`, `quantity=0`) |
| `test_str` | `__str__` includes the stock name |
| `test_purchase_date_optional` | `purchase_date` can be `None` |

#### `ProductionRecord`
| Test | What it verifies |
|---|---|
| `test_create` | Record created with correct unit defaults |
| `test_str` | `__str__` includes crop name |
| `test_optional_date_fields` | `planting_date` and `harvest_date` can be `None` |

#### `LoanApplication`
| Test | What it verifies |
|---|---|
| `test_create_with_defaults` | Application created with `status='pending'` |
| `test_str` | `__str__` returns `"Loan #<id> (<username>)"` |
| `test_ai_fields_default_null` | `eligibility_approved`, `risk_score`, `recommended_amount` start as `None` |
| `test_status_default_pending` | Status defaults to `'pending'` |
| `test_update_status` | Status can be updated and persisted |
| `test_set_ai_outputs` | AI outputs (eligibility, risk, amount) can be saved and retrieved |
| `test_multiple_applications_per_user` | A user can have multiple loan applications |
| `test_cascade_delete_with_user` | Deleting user deletes their applications |
| `test_reviewed_by_set_null_on_user_delete` | `reviewed_by` is set to `NULL` if the reviewer is deleted |

#### `ApplicationStatusUpdate`
| Test | What it verifies |
|---|---|
| `test_create` | Status update created for an application |
| `test_str` | `__str__` references the application ID and status |
| `test_ordering_oldest_first` | Updates are ordered by `created_at` ascending |
| `test_cascade_delete_with_application` | Deleting application deletes its status updates |

#### `LoanApplicationMessage`
| Test | What it verifies |
|---|---|
| `test_create` | Message created between MFI sender and farmer recipient |
| `test_str` | `__str__` references the application ID |
| `test_message_max_length_respected` | Messages up to 2000 characters are accepted |

#### `LoanApplicationDocument`
| Test | What it verifies |
|---|---|
| `test_create` | Document record created for an application |
| `test_str_contains_document_type_display` | `__str__` uses the human-readable label (e.g. "National ID") |
| `test_unique_together_document_type_per_application` | Uploading the same document type twice raises `IntegrityError` |
| `test_different_types_allowed_on_same_application` | Different document types can coexist on one application |
| `test_cascade_delete_with_application` | Deleting application deletes its documents |

#### `Loan`
| Test | What it verifies |
|---|---|
| `test_create` | Loan created with default interest rate of 12% |
| `test_str` | `__str__` includes the loan amount |
| `test_default_interest_rate` | `interest_rate` defaults to `0.12` |
| `test_one_to_one_application` | `application.approved_loan` reverse accessor works |
| `test_cascade_delete_with_application` | Deleting application deletes the loan |

#### `Repayment`
| Test | What it verifies |
|---|---|
| `test_create` | Repayment created with `status='pending'` and no `paid_at` |
| `test_str` | `__str__` includes the amount |
| `test_mark_paid` | Status can be updated to `'paid'` with a `paid_at` timestamp |
| `test_ordered_by_due_date` | Repayments are ordered by `due_date` ascending |
| `test_cascade_delete_with_loan` | Deleting loan deletes its repayments |

#### `ChatInteraction`
| Test | What it verifies |
|---|---|
| `test_create_authenticated` | Chat interaction created with linked user |
| `test_create_anonymous` | Chat interaction created with `user=None` (unauthenticated) |
| `test_str` | `__str__` returns `"Chat <id>"` |
| `test_default_language_is_en` | `language` defaults to `'en'` |
| `test_user_set_null_on_delete` | `user` is set to `NULL` when the user account is deleted |

---

### 2. Authentication Tests (`test_auth.py`) — 21 tests

Tests the auth API endpoints at the HTTP layer using DRF's `APIClient`.

#### `POST /api/auth/register/`
| Test | What it verifies |
|---|---|
| `test_register_farmer_success` | Returns 201 with token and farmer role |
| `test_register_microfinance_success` | Returns 201 with microfinance role |
| `test_register_creates_user_profile` | `UserProfile` is created in DB with correct role |
| `test_register_duplicate_email_fails` | Returns 400 when email already exists |
| `test_register_invalid_role_fails` | Returns 400 when `role='admin'` (self-registration not allowed) |
| `test_register_short_password_fails` | Returns 400 for passwords under 8 characters |
| `test_register_missing_email_fails` | Returns 400 when email field is absent |

#### `POST /api/auth/login/`
| Test | What it verifies |
|---|---|
| `test_login_farmer_success` | Returns 200 with token for a valid farmer |
| `test_login_returns_correct_role` | Role in response matches the user's UserProfile |
| `test_login_wrong_password_fails` | Returns 401 for incorrect password |
| `test_login_nonexistent_email_fails` | Returns 401 for unknown email |
| `test_login_case_insensitive_email` | Email lookup is case-insensitive |
| `test_login_missing_fields_fails` | Returns 400 when fields are missing |

#### `POST /api/auth/forgot-password/` and `POST /api/auth/reset-password/`
| Test | What it verifies |
|---|---|
| `test_forgot_password_known_email` | Returns 200 (no email enumeration) |
| `test_forgot_password_unknown_email` | Returns 200 even for unknown email (prevents enumeration) |
| `test_forgot_password_missing_email` | Returns 400 when email is absent |
| `test_reset_password_valid_token` | Returns 200 and the new password actually works |
| `test_reset_password_invalid_token` | Returns 400 for a bogus token |
| `test_reset_password_too_short` | Returns 400 for a new password under 8 characters |
| `test_reset_password_missing_token` | Returns 400 when token is absent |

---

### 3. Activity & Admin Tests (`test_activity.py`) — 13 tests

#### `POST /api/activity/log/`
| Test | What it verifies |
|---|---|
| `test_log_modal_opened` | Accepts `modal_opened` event |
| `test_log_register_clicked` | Accepts `register_clicked` event |
| `test_log_login_clicked` | Accepts `login_clicked` event |
| `test_log_invalid_event_type` | Rejects unknown event types with 400 |
| `test_log_no_auth_required` | Endpoint is public — no token needed |

#### `GET /api/admin/activity/`, `/api/admin/users/`, `/api/admin/stats/`
| Test | What it verifies |
|---|---|
| `test_admin_activity_list_requires_auth` | Unauthenticated request is rejected (401/403) |
| `test_admin_users_list_requires_auth` | Unauthenticated request is rejected |
| `test_admin_stats_requires_auth` | Unauthenticated request is rejected |
| `test_farmer_cannot_access_admin_activity` | Farmer role is forbidden from admin endpoints |
| `test_admin_can_access_activity_list` | Admin user receives 200 |
| `test_admin_can_access_users_list` | Admin user receives 200 |
| `test_admin_can_access_stats` | Admin user receives 200 |
| `test_admin_stats_contains_expected_keys` | Response body is a dict (aggregate data) |

---

### 4. ML Endpoint Tests (`test_ml_endpoints.py`) — 15 tests

ML model functions are mocked with `unittest.mock.patch` so tests run instantly without loading the trained model files.

#### `POST /api/eligibility/`
| Test | What it verifies |
|---|---|
| `test_eligibility_approved` | `approved=True`, `prediction=1` when model returns `True` |
| `test_eligibility_denied` | `approved=False`, `prediction=0` when model returns `False` |
| `test_eligibility_response_has_reason` | Response always includes a `reason` field |
| `test_eligibility_model_unavailable_returns_503` | Returns 503 when model file is missing |
| `test_eligibility_no_auth_required` | Endpoint is public |

#### `POST /api/risk/`
| Test | What it verifies |
|---|---|
| `test_risk_returns_score` | `risk_score` in response matches mock value |
| `test_risk_response_structure` | Response includes `risk_score`, `score`, `interpretation` |
| `test_risk_model_unavailable_returns_503` | Returns 503 when model file is missing |

#### `POST /api/recommend-amount/`
| Test | What it verifies |
|---|---|
| `test_recommend_returns_amount` | `recommended_amount` is positive |
| `test_recommend_caps_at_dti_ceiling` | Amount is capped at 35% DTI ceiling (income-based limit) |
| `test_recommend_model_unavailable_returns_503` | Returns 503 when model file is missing |

#### `POST /api/chat/`
| Test | What it verifies |
|---|---|
| `test_chat_empty_message` | Empty input returns 200 with a prompt message |
| `test_chat_english_reply` | Valid English message returns a reply |
| `test_chat_model_unavailable_returns_fallback` | Returns 200 with graceful fallback when model is unavailable |
| `test_chat_exception_never_returns_500` | Unhandled exceptions are caught — never returns 500 |

---

### 5. Serializer Tests (`test_serializers.py`) — 12 tests

Unit tests that validate serializer logic directly without the HTTP layer.

#### `RegisterSerializer`
| Test | What it verifies |
|---|---|
| `test_valid_farmer_data` | Valid farmer payload passes validation |
| `test_valid_microfinance_data` | Valid microfinance payload passes validation |
| `test_invalid_role_rejected` | `role='admin'` fails validation |
| `test_short_password_rejected` | Password under 8 characters fails |
| `test_invalid_email_rejected` | Non-email string fails |
| `test_duplicate_email_rejected` | Email already in DB fails via `validate_email()` |
| `test_name_is_optional` | Registration succeeds without a `name` field |
| `test_create_makes_user_and_profile` | `serializer.save()` creates both `User` and `UserProfile` |

#### `LoginSerializer`
| Test | What it verifies |
|---|---|
| `test_valid_data` | Valid email + password passes |
| `test_missing_email` | Missing email field fails |
| `test_missing_password` | Missing password field fails |
| `test_invalid_email_format` | Non-email string for email field fails |

---

## Security Considerations Tested

- **No email enumeration** — forgot-password always returns 200 regardless of whether the email exists
- **Role-based access control** — farmer users cannot access admin endpoints
- **Authentication enforcement** — all admin and user-specific endpoints reject unauthenticated requests
- **Password minimum length** — enforced at both serializer and reset-password endpoint level
- **Self-registration restriction** — admin role cannot be self-registered via the public API
- **One-time tokens** — password reset tokens are deleted immediately after use
- **Token expiry** — password reset tokens expire after 1 hour
- **Chatbot error containment** — all chatbot errors return 200 with a fallback, never 500
