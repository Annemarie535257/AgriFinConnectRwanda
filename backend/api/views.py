import json
import logging
import re
import zipfile
from collections.abc import Mapping
from io import BytesIO
from django.conf import settings
from django.contrib.auth import authenticate, get_user_model
from django.http import HttpResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from drf_yasg import openapi
from drf_yasg.utils import swagger_auto_schema
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

logger = logging.getLogger(__name__)

from .explanations import (
    application_rejection_reason,
    eligibility_reason,
    eligibility_description,
    recommend_amount_explanation,
    risk_score_description,
)
from .ml_service import predict_eligibility, predict_risk, recommend_amount as recommend_loan_amount
from .sms_service import send_sms
from .models import (
    GetStartedEvent,
    PasswordResetToken,
    UserProfile,
    FarmerProfile,
    AgriculturalRecord,
    ApplicationStatusUpdate,
    LoanApplication,
    LoanApplicationDocument,
    DOCUMENT_TYPE_CHOICES,
    LOAN_STATUS_CHOICES,
    Loan,
    Repayment,
    LoanApplicationMessage,
)
from .serializers import LoginSerializer, RegisterSerializer

User = get_user_model()

# Swagger: generic JSON body for ML endpoints
_ml_request_body = openapi.Schema(
    type=openapi.TYPE_OBJECT,
    description='JSON with feature keys (e.g. Age, AnnualIncome, CreditScore, LoanAmount, LoanDuration, EmploymentStatus, EducationLevel, etc.). See ML model feature list.',
)
_eligibility_response = openapi.Response('approved (bool), prediction (0/1)', openapi.Schema(type=openapi.TYPE_OBJECT, properties={'approved': openapi.Schema(type=openapi.TYPE_BOOLEAN), 'prediction': openapi.Schema(type=openapi.TYPE_INTEGER)}))
_risk_response = openapi.Response('risk_score (float)', openapi.Schema(type=openapi.TYPE_OBJECT, properties={'risk_score': openapi.Schema(type=openapi.TYPE_NUMBER)}))
_amount_response = openapi.Response('recommended_amount (float)', openapi.Schema(type=openapi.TYPE_OBJECT, properties={'recommended_amount': openapi.Schema(type=openapi.TYPE_NUMBER)}))
_chat_request = openapi.Schema(type=openapi.TYPE_OBJECT, required=['message'], properties={'message': openapi.Schema(type=openapi.TYPE_STRING), 'language': openapi.Schema(type=openapi.TYPE_STRING, enum=['en', 'fr', 'rw'])})
_chat_response = openapi.Response('reply (string)', openapi.Schema(type=openapi.TYPE_OBJECT, properties={'reply': openapi.Schema(type=openapi.TYPE_STRING)}))


def _get_payload(request):
    """Get JSON body from request (works for both DRF Request and Django request)."""
    if hasattr(request, 'data') and request.data is not None:
        return request.data if isinstance(request.data, Mapping) else {}
    try:
        return json.loads(request.body) if request.body else {}
    except (json.JSONDecodeError, TypeError):
        return {}


def _find_user_by_login_identifier(identifier):
    """Find a user by email first, then fall back to username for legacy accounts."""
    normalized = (identifier or '').strip().lower()
    if not normalized:
        return None

    user = User.objects.filter(email__iexact=normalized).first()
    if user is not None:
        return user

    return User.objects.filter(username__iexact=normalized).first()


def _farmer_phone_for_application(app):
    try:
        profile = getattr(app.user, 'farmer_profile', None)
    except Exception:
        profile = None
    return (getattr(profile, 'phone', '') or '').strip()


def _normalize_location_value(value, max_length=80):
    return str(value or '').strip()[:max_length]


def _parse_farmer_location(location):
    raw = str(location or '').strip()
    parts = {'district': '', 'sector': '', 'cell': '', 'village': ''}
    if not raw:
        return parts

    chunks = [chunk.strip() for chunk in raw.split(',') if chunk.strip()]
    if len(chunks) >= 4:
        parts['district'] = chunks[0][:80]
        parts['sector'] = chunks[1][:80]
        parts['cell'] = chunks[2][:80]
        parts['village'] = ', '.join(chunks[3:])[:80]
        return parts

    # Backward-compatible fallback for old single-value locations.
    parts['district'] = raw[:80]
    return parts


def _format_farmer_location(district='', sector='', cell='', village=''):
    ordered = [
        _normalize_location_value(district),
        _normalize_location_value(sector),
        _normalize_location_value(cell),
        _normalize_location_value(village),
    ]
    return ', '.join([value for value in ordered if value])[:200]


def _notify_farmer_sms(app, message, context='application_update'):
    phone = _farmer_phone_for_application(app)
    if not phone:
        return {'sent': False, 'reason': 'no_phone_on_profile'}
    return send_sms(phone, message, context=context)


@swagger_auto_schema(method='post', operation_description='Model 1: Loan eligibility (approval/denial) prediction. POST JSON with features.', request_body=_ml_request_body, responses={200: _eligibility_response, 400: 'Error', 503: 'Models not loaded'}, tags=['ML Models'])
@api_view(['POST'])
@permission_classes([AllowAny])
def eligibility(request):
    """POST /api/eligibility/ — Model 1: loan approval prediction. Accepts optional 'language' (en|fr|rw)."""
    payload = _get_payload(request)
    language = (payload.get('language') or payload.get('lang') or 'en')
    language = str(language).strip().lower()[:2]
    if language not in ('en', 'fr', 'rw'):
        language = 'en'
    try:
        approved = predict_eligibility(payload)
        reason = eligibility_reason(payload, approved, language)
        return Response({
            'approved': approved,
            'prediction': 1 if approved else 0,
            'reason': reason,
            'description': eligibility_description(language),
        })
    except FileNotFoundError as e:
        return Response({'error': str(e)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


@swagger_auto_schema(method='post', operation_description='Model 2: Default risk score (credit risk assessment). POST JSON with features.', request_body=_ml_request_body, responses={200: _risk_response, 400: 'Error', 503: 'Models not loaded'}, tags=['ML Models'])
@api_view(['POST'])
@permission_classes([AllowAny])
def risk(request):
    """POST /api/risk/ — Model 2: default risk score. Accepts optional 'language' (en|fr|rw)."""
    payload = _get_payload(request)
    language = (payload.get('language') or payload.get('lang') or 'en')
    language = str(language).strip().lower()[:2]
    if language not in ('en', 'fr', 'rw'):
        language = 'en'
    try:
        risk_score = predict_risk(payload)
        risk_info = risk_score_description(risk_score, language)
        return Response({
            'risk_score': risk_score,
            'score': risk_score,
            'interpretation': risk_info['interpretation'],
            'description': risk_info['description'],
            'score_meaning': risk_info['score_meaning'],
        })
    except FileNotFoundError as e:
        return Response({'error': str(e)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


@swagger_auto_schema(method='post', operation_description='Model 3: Recommended loan amount for approved profile. POST JSON with features.', request_body=_ml_request_body, responses={200: _amount_response, 400: 'Error', 503: 'Models not loaded'}, tags=['ML Models'])
@api_view(['POST'])
@permission_classes([AllowAny])
def recommend_amount(request):
    """POST /api/recommend-amount/ — Model 3: recommended loan amount. Accepts optional 'language' (en|fr|rw)."""
    payload = _get_payload(request)
    language = (payload.get('language') or payload.get('lang') or 'en')
    language = str(language).strip().lower()[:2]
    if language not in ('en', 'fr', 'rw'):
        language = 'en'
    try:
        amount_usd = recommend_loan_amount(payload)
        # Cap at what the income can actually afford (35% DTI ceiling).
        # payload has AnnualIncome in USD already (converted by frontend formToMlPayload).
        monthly_income_usd = float(payload.get('AnnualIncome', 1)) / 12
        duration = int(payload.get('LoanDuration') or 24)
        max_affordable_usd = monthly_income_usd * _MAX_DTI * duration
        amount_usd = min(amount_usd, max_affordable_usd)
        # Convert USD-scale model output back to RWF for display
        amount = amount_usd * _RWF_TO_USD
        amount_info = recommend_amount_explanation(payload, amount_usd, language)
        return Response({
            'recommended_amount': amount,
            'recommendedAmount': amount,
            'amount': amount,
            'prediction': amount,
            'explanation': amount_info['explanation'],
            'basis': amount_info['basis'],
        })
    except FileNotFoundError as e:
        return Response({'error': str(e)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


# ── Fraud detection schema helpers ────────────────────────────────────────────
_fraud_request = openapi.Schema(
    type=openapi.TYPE_OBJECT,
    required=['TransactionAmount', 'AccountBalance', 'LoginAttempts'],
    properties={
        'TransactionAmount': openapi.Schema(type=openapi.TYPE_NUMBER, description='Amount of the transaction'),
        'TransactionDuration': openapi.Schema(type=openapi.TYPE_INTEGER, description='Duration in seconds'),
        'LoginAttempts': openapi.Schema(type=openapi.TYPE_INTEGER, description='Number of login attempts before transaction'),
        'AccountBalance': openapi.Schema(type=openapi.TYPE_NUMBER, description='Account balance after transaction'),
        'CustomerAge': openapi.Schema(type=openapi.TYPE_INTEGER, description='Customer age'),
        'DaysSinceLastTx': openapi.Schema(type=openapi.TYPE_NUMBER, description='Days elapsed since previous transaction (velocity indicator)'),
        'AmountToBalanceRatio': openapi.Schema(type=openapi.TYPE_NUMBER, description='TransactionAmount / AccountBalance (auto-computed if omitted)'),
        'TxHour': openapi.Schema(type=openapi.TYPE_INTEGER, description='Hour of transaction 0-23 (derived from TransactionDate if omitted)'),
        'IsNightTx': openapi.Schema(type=openapi.TYPE_INTEGER, description='1 if transaction occurred between 11pm-5am'),
        'TransactionType': openapi.Schema(type=openapi.TYPE_STRING, enum=['Credit', 'Debit']),
        'Channel': openapi.Schema(type=openapi.TYPE_STRING, enum=['Online', 'ATM', 'Branch']),
        'CustomerOccupation': openapi.Schema(type=openapi.TYPE_STRING, enum=['Doctor', 'Engineer', 'Retired', 'Student']),
        'TransactionDate': openapi.Schema(type=openapi.TYPE_STRING, description='ISO timestamp, used to derive TxHour if not supplied'),
    },
)
_fraud_response = openapi.Response(
    'Fraud detection result',
    openapi.Schema(
        type=openapi.TYPE_OBJECT,
        properties={
            'is_fraud': openapi.Schema(type=openapi.TYPE_BOOLEAN),
            'fraud_probability': openapi.Schema(type=openapi.TYPE_NUMBER),
            'anomaly_score': openapi.Schema(type=openapi.TYPE_NUMBER),
            'risk_score': openapi.Schema(type=openapi.TYPE_NUMBER, description='0-100'),
            'risk_level': openapi.Schema(type=openapi.TYPE_STRING, enum=['LOW', 'MEDIUM', 'HIGH']),
        },
    ),
)


@swagger_auto_schema(
    method='post',
    operation_description=(
        'Fraud Detection: analyse a microfinance transaction for fraud risk. '
        'Uses three models: Isolation Forest anomaly detector, Random Forest binary classifier, '
        'and Gradient Boosting risk scorer (0-100). '
        'Returns is_fraud (bool), fraud_probability (0-1), anomaly_score, risk_score (0-100), and risk_level (LOW/MEDIUM/HIGH).'
    ),
    request_body=_fraud_request,
    responses={200: _fraud_response, 400: 'Error', 503: 'Models not loaded'},
    tags=['Fraud Detection'],
)
@api_view(['POST'])
@permission_classes([AllowAny])
def fraud_detect(request):
    """POST /api/fraud-detect/ — Analyse a transaction for fraud risk using 3 ML models."""
    payload = _get_payload(request)
    try:
        from api.fraud_service import predict_fraud
        result = predict_fraud(payload)
        return Response(result)
    except FileNotFoundError as e:
        return Response({'error': str(e)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


@swagger_auto_schema(
    method='post',
    operation_description='Send SMS fallback notification (provider-backed or log fallback). Requires authentication.',
    request_body=openapi.Schema(
        type=openapi.TYPE_OBJECT,
        required=['to_phone', 'message'],
        properties={
            'to_phone': openapi.Schema(type=openapi.TYPE_STRING),
            'message': openapi.Schema(type=openapi.TYPE_STRING),
            'context': openapi.Schema(type=openapi.TYPE_STRING),
        },
    ),
    tags=['Fallback'],
)
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def fallback_sms(request):
    payload = _get_payload(request)
    to_phone = str(payload.get('to_phone') or '').strip()
    message = str(payload.get('message') or '').strip()
    context = str(payload.get('context') or 'manual_fallback').strip()
    if not to_phone or not message:
        return Response({'error': 'to_phone and message are required.'}, status=status.HTTP_400_BAD_REQUEST)
    result = send_sms(to_phone, message, context=context)
    return Response({'success': bool(result.get('sent')), 'delivery': result}, status=status.HTTP_202_ACCEPTED)


@api_view(['POST'])
@permission_classes([AllowAny])
def analyze_bank_statement(request):
    """
    POST /api/fraud-detect/statement/
    Upload a PDF bank statement and get fraud analysis for every extracted transaction.

    Multipart form fields:
      - file         (required): the PDF bank statement
      - customer_age (optional, int): customer age, default 35
      - occupation   (optional): Doctor|Engineer|Retired|Student, default Engineer

    Returns:
      {
        "statement_is_fraud":   bool,
        "statement_risk_level": "LOW"|"MEDIUM"|"HIGH",
        "statement_risk_score": float,
        "fraud_ratio":          float,
        "total_transactions":   int,
        "flagged_count":        int,
        "high_risk_count":      int,
        "worst_transaction":    {...} | null,
        "transactions":         [...],
        "parse_warnings":       [...]
      }
    """
    pdf_file = request.FILES.get('file')
    if not pdf_file:
        return Response({'error': 'No file uploaded. Send the PDF as "file" in multipart form data.'},
                        status=status.HTTP_400_BAD_REQUEST)

    if not pdf_file.name.lower().endswith('.pdf'):
        return Response({'error': 'Only PDF files are supported.'},
                        status=status.HTTP_400_BAD_REQUEST)

    # Limit to 10 MB to prevent abuse
    if pdf_file.size > 10 * 1024 * 1024:
        return Response({'error': 'File too large. Maximum size is 10 MB.'},
                        status=status.HTTP_400_BAD_REQUEST)

    try:
        customer_age = int(request.data.get('customer_age', 35))
    except (ValueError, TypeError):
        customer_age = 35
    occupation = request.data.get('occupation', 'Engineer')

    try:
        from api.pdf_statement_service import flag_statement
        result = flag_statement(pdf_file, customer_age=customer_age, occupation=occupation)
        return Response(result)
    except RuntimeError as e:
        return Response({'error': str(e)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
    except FileNotFoundError as e:
        return Response({'error': str(e)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
    except Exception as e:
        logger.exception("Bank statement analysis failed")
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def analyze_application_statement(request, pk):
    """
    POST /api/mfi/applications/<pk>/analyze-statement/

    Retrieve the proof_of_income document already submitted by the farmer for this
    loan application, run the full fraud analysis pipeline on it, and return the
    statement-level verdict.

    Optional JSON body:
      { "occupation": "Engineer" }   (overrides the default if known)

    Returns: same shape as /api/fraud-detect/statement/ (flag_statement result).
    """
    if not _is_microfinance(request.user):
        return Response({'error': 'Microfinance access required'}, status=status.HTTP_403_FORBIDDEN)

    try:
        application = LoanApplication.objects.get(pk=pk)
    except LoanApplication.DoesNotExist:
        return Response({'error': 'Application not found'}, status=status.HTTP_404_NOT_FOUND)

    # Find the bank-statement / proof-of-income document
    bank_statement_doc = application.documents.filter(document_type='proof_of_income').first()
    if not bank_statement_doc or not bank_statement_doc.file:
        return Response(
            {'error': 'No bank statement (proof_of_income) document found for this application.'},
            status=status.HTTP_404_NOT_FOUND,
        )

    if not bank_statement_doc.file.name.lower().endswith('.pdf'):
        return Response(
            {'error': 'The submitted bank statement is not a PDF file. Only PDF statements can be scanned.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Derive age from application data if available
    try:
        customer_age = int(request.data.get('customer_age', 35))
    except (ValueError, TypeError):
        customer_age = 35
    occupation = request.data.get('occupation', 'Engineer')

    try:
        from api.pdf_statement_service import flag_statement
        with bank_statement_doc.file.open('rb') as pdf_file:
            result = flag_statement(pdf_file, customer_age=customer_age, occupation=occupation)

        # Attach application metadata for context
        result['application_id']   = application.id
        result['applicant_name']   = application.user.get_full_name() or application.user.username
        result['applicant_email']  = application.user.email
        result['document_name']    = bank_statement_doc.file.name.split('/')[-1]
        return Response(result)
    except ValueError as e:
        # Raised by _check_is_bank_statement when the PDF is not a bank statement
        return Response({'error': str(e)}, status=status.HTTP_422_UNPROCESSABLE_ENTITY)
    except RuntimeError as e:
        return Response({'error': str(e)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
    except FileNotFoundError as e:
        return Response({'error': str(e)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
    except Exception as e:
        logger.exception("Application statement analysis failed for app %s", pk)
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


def _chat_fallback_payload(language: str, err_msg: str = None):
    """Shared fallback when chatbot model is unavailable or any error occurs."""
    replies = {
        'en': (
            "Thank you for your message. The chatbot model is not available right now. "
            "To apply for a loan, use the Loan Eligibility and Loan Amount Recommendation tools. "
            "We support Kinyarwanda, English, and French."
        ),
        'fr': (
            "Merci pour votre message. Le modèle du chatbot n'est pas disponible. "
            "Pour demander un prêt, utilisez les outils d'éligibilité et de recommandation ci-dessus."
        ),
        'rw': (
            "Murakoze kubutumwa. Modèle y'ikibazo ntabwo iri. "
            "Kugira ngo usabe inguzanyo, koresha ibikoresho by'emera no gutoranya inguzanyo hejuru."
        ),
    }
    reply = replies.get(language, replies['en'])
    payload = {'reply': reply, 'response': reply}
    if getattr(settings, 'DEBUG', False) and err_msg:
        payload['chatbot_load_error'] = err_msg
    return payload


def _looks_untranslated(target_lang: str, source_en: str, translated_text: str) -> bool:
    """Best-effort guard: if FR/RW output is identical to English source, translation likely failed."""
    lang = (target_lang or 'en').lower()
    if lang not in ('fr', 'rw'):
        return False
    src = (source_en or '').strip()
    out = (translated_text or '').strip()
    return bool(src and out and src == out)


@swagger_auto_schema(method='post', operation_description='Multilingual chatbot (Kinyarwanda, English, French). POST message + language. Uses saved T5 model when available, with separate translation models for FR/RW.', request_body=_chat_request, responses={200: _chat_response}, tags=['Chatbot'])
@api_view(['POST'])
@permission_classes([AllowAny])
def chat(request):
    """POST /api/chat/ — Chatbot using saved T5 model (saved-model/); falls back to placeholder if unavailable."""
    payload = _get_payload(request)
    raw_message = (payload.get('message') or '').strip()
    language = (payload.get('language') or 'en').lower()
    if not raw_message:
        return Response({'reply': 'Please send a message.', 'response': 'Please send a message.'})

    try:
        from api.chatbot_service import generate_reply, get_load_error
        # English-only path: avoid importing translation_service so we never load
        # MarianMT/transformers on Render (prevents worker timeout and OOM).
        if language == 'en':
            reply_en = generate_reply(raw_message, language='en')
            if reply_en is None:
                return Response(_chat_fallback_payload(language, get_load_error()))
            return Response({'reply': reply_en, 'response': reply_en})
        # FR/RW: translate question to English, run chatbot, translate answer back.
        from api.translation_service import to_english, from_english
        question_for_model = to_english(raw_message, source_lang=language)
        reply_en = generate_reply(question_for_model, language='en')
        if reply_en is None:
            return Response(_chat_fallback_payload(language, get_load_error()))
        final_reply = from_english(reply_en, target_lang=language)
        if _looks_untranslated(language, reply_en, final_reply):
            # Keep UX language-consistent when translation models fail to load.
            return Response(_chat_fallback_payload(language, 'translation_unavailable'))
        resp = {'reply': final_reply, 'response': final_reply}
        if getattr(settings, 'DEBUG', False):
            resp['source_reply_en'] = reply_en
        return Response(resp)
    except Exception as e:
        # Never return 500 for chat: model/env errors return 200 with fallback message
        import logging
        logging.getLogger(__name__).exception("Chat endpoint error: %s", e)
        err_msg = str(e)
        try:
            from api.chatbot_service import get_load_error
            err_msg = get_load_error() or err_msg
        except Exception:
            pass
        return Response(_chat_fallback_payload(language, err_msg))


# ----- Auth APIs (documented in Swagger) -----

def _user_role(user):
    """Return role: from UserProfile, or 'admin' if staff/superuser."""
    try:
        return user.agrifin_profile.role
    except UserProfile.DoesNotExist:
        return 'admin' if (user.is_staff or user.is_superuser) else 'farmer'


@csrf_exempt
@swagger_auto_schema(method='post', operation_description='Register a new farmer or microfinance user. Admin is backend-created; use login only for admin.', tags=['Auth'])
@api_view(['POST'])
@permission_classes([AllowAny])
def auth_register(request):
    """
    Register a new farmer or microfinance user.
    Admin users are created in the backend; use login only for admin.
    """
    data = request.data if request.data else _get_payload(request)
    serializer = RegisterSerializer(data=data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    user = serializer.save()
    role = user.agrifin_profile.role

    token, _ = Token.objects.get_or_create(user=user)
    return Response({
        'token': token.key,
        'user': {
            'id': user.id,
            'email': user.email,
            'username': user.username,
            'first_name': user.first_name,
            'name': user.first_name,
            'role': role,
        },
    }, status=status.HTTP_201_CREATED)


@csrf_exempt
@swagger_auto_schema(method='post', operation_description='Login for all roles (farmer, microfinance, admin). Admin is backend-created.', tags=['Auth'])
@api_view(['POST'])
@permission_classes([AllowAny])
def auth_login(request):
    """
    Login for all roles (farmer, microfinance, admin).
    Admin is created in the backend; use email/password to login.
    """
    data = request.data if request.data else _get_payload(request)
    serializer = LoginSerializer(data=data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    email = (serializer.validated_data['email'] or '').strip()
    password = serializer.validated_data['password']
    user = _find_user_by_login_identifier(email)
    if user is None or not user.check_password(password):
        return Response({'error': 'Invalid email or password.'}, status=status.HTTP_401_UNAUTHORIZED)
    if not user.is_active:
        return Response({'error': 'This account is inactive. Please contact support.'}, status=status.HTTP_401_UNAUTHORIZED)
    token, _ = Token.objects.get_or_create(user=user)
    role = _user_role(user)
    return Response({
        'token': token.key,
        'user': {
            'id': user.id,
            'email': getattr(user, 'email', user.username),
            'username': user.username,
            'first_name': user.first_name,
            'name': user.first_name,
            'role': role,
        },
    })


_forgot_password_body = openapi.Schema(
    type=openapi.TYPE_OBJECT,
    required=['email'],
    properties={'email': openapi.Schema(type=openapi.TYPE_STRING, format=openapi.FORMAT_EMAIL)},
)
_reset_password_body = openapi.Schema(
    type=openapi.TYPE_OBJECT,
    required=['token', 'new_password'],
    properties={
        'token': openapi.Schema(type=openapi.TYPE_STRING),
        'new_password': openapi.Schema(type=openapi.TYPE_STRING, minLength=8),
    },
)
@swagger_auto_schema(method='post', operation_description='Request password reset. Sends email with reset link.', request_body=_forgot_password_body, tags=['Auth'])
@api_view(['POST'])
@permission_classes([AllowAny])
def auth_forgot_password(request):
    """POST /api/auth/forgot-password/ — Request password reset. Sends email with reset link."""
    payload = _get_payload(request)
    email = (payload.get('email') or '').strip().lower()
    if not email:
        return Response({'error': 'Email is required.'}, status=status.HTTP_400_BAD_REQUEST)
    user = _find_user_by_login_identifier(email)
    if user is None:
        return Response({'message': 'If an account exists with this email, a reset link has been sent.'})
    prt = PasswordResetToken.create_for_user(user)
    frontend_url = getattr(settings, 'PASSWORD_RESET_FRONTEND_URL', 'http://localhost:3000')
    reset_url = f"{frontend_url}/reset-password?token={prt.token}"
    try:
        from django.core.mail import send_mail
        send_mail(
            subject='AgriFinConnect Rwanda — Reset your password',
            message=f'Click the link below to reset your password:\n\n{reset_url}\n\nThis link expires in 1 hour.\n\nIf you did not request this, ignore this email.',
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email or user.username],
            fail_silently=True,
        )
    except Exception:
        pass
    resp = {'message': 'If an account exists with this email, a reset link has been sent.'}
    if getattr(settings, 'DEBUG', False):
        resp['reset_url'] = reset_url
    return Response(resp)


@swagger_auto_schema(method='post', operation_description='Set new password using reset token.', request_body=_reset_password_body, tags=['Auth'])
@api_view(['POST'])
@permission_classes([AllowAny])
def auth_reset_password(request):
    """POST /api/auth/reset-password/ — Set new password using token from forgot-password email."""
    payload = _get_payload(request)
    token = (payload.get('token') or '').strip()
    new_password = payload.get('new_password', '')
    if not token:
        return Response({'error': 'Token is required.'}, status=status.HTTP_400_BAD_REQUEST)
    if len(new_password) < 8:
        return Response({'error': 'Password must be at least 8 characters.'}, status=status.HTTP_400_BAD_REQUEST)
    user = PasswordResetToken.get_valid_user(token)
    if user is None:
        return Response({'error': 'Invalid or expired reset link. Please request a new one.'}, status=status.HTTP_400_BAD_REQUEST)
    user.set_password(new_password)
    user.save()
    return Response({'message': 'Password has been reset. You can now sign in.'})


# ----- Activity tracking (Get Started) + Admin API -----

def _get_client_ip(request):
    """Extract client IP from request (handles proxies)."""
    xff = request.META.get('HTTP_X_FORWARDED_FOR')
    if xff:
        return xff.split(',')[0].strip() or None
    addr = request.META.get('REMOTE_ADDR')
    return addr if addr else None


def _is_admin(user):
    """Return True if user has admin role."""
    role = _user_role(user)
    return role == 'admin'


_activity_log_body = openapi.Schema(
    type=openapi.TYPE_OBJECT,
    required=['event_type'],
    properties={
        'event_type': openapi.Schema(type=openapi.TYPE_STRING, enum=['modal_opened', 'register_clicked', 'login_clicked']),
        'role': openapi.Schema(type=openapi.TYPE_STRING, description='farmers, microfinances, or admin'),
    },
)


@csrf_exempt
@swagger_auto_schema(method='post', operation_description='Log Get Started activity (no auth). Visitors trigger when opening modal or clicking Register/Login.', request_body=_activity_log_body, tags=['Activity'])
@api_view(['POST'])
@permission_classes([AllowAny])
def activity_log(request):
    """POST /api/activity/log/ — Log Get Started event (modal opened, register clicked, login clicked). No auth required."""
    payload = request.data if (request.data and isinstance(request.data, dict)) else _get_payload(request)
    event_type = payload.get('event_type', 'modal_opened')
    if event_type not in ('modal_opened', 'register_clicked', 'login_clicked'):
        return Response({'error': 'Invalid event_type'}, status=status.HTTP_400_BAD_REQUEST)
    role = payload.get('role', '')
    ip = None
    try:
        ip = _get_client_ip(request)
    except Exception:
        pass
    user_agent = request.META.get('HTTP_USER_AGENT', '')[:500]
    GetStartedEvent.objects.create(
        event_type=event_type,
        role=role,
        ip_address=ip,
        user_agent=user_agent,
    )
    return Response({'ok': True}, status=status.HTTP_201_CREATED)


@swagger_auto_schema(method='get', operation_description='List Get Started activity (admin only). Requires auth token with admin role.', tags=['Admin'])
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def admin_activity_list(request):
    """GET /api/admin/activity/ — List Get Started events. Admin token required."""
    if not _is_admin(request.user):
        return Response({'error': 'Admin access required'}, status=status.HTTP_403_FORBIDDEN)
    limit = min(int(request.query_params.get('limit', 100)), 500)
    events = GetStartedEvent.objects.all()[:limit]
    data = [
        {
            'id': e.id,
            'event_type': e.event_type,
            'role': e.role,
            'ip_address': str(e.ip_address) if e.ip_address else None,
            'user_agent': e.user_agent or None,
            'created_at': e.created_at.isoformat(),
        }
        for e in events
    ]
    return Response({'events': data, 'count': len(data)})


# ----- Dashboard APIs: Farmer, MFI, Admin -----

def _is_farmer(user):
    return _user_role(user) == 'farmer'


def _is_microfinance(user):
    return _user_role(user) == 'microfinance'


# 1 USD ≈ 1350 RWF — used to normalise RWF monetary values to the USD scale
# the ML models were trained on, keeping absolute feature magnitudes sane.
_RWF_TO_USD = 1350.0

# Maximum debt-to-income ratio allowed for the recommended amount cap.
# A monthly payment above 35% of monthly income is capped before returning.
_MAX_DTI = 0.35

# Bring low-income RWF profiles to at least this USD income level before
# passing to the model, so features land within the training distribution.
_TARGET_INCOME_USD = 45000.0

def _build_ml_payload(annual_income_rwf, loan_amount_rwf, loan_duration_months,
                      age, credit_score, employment_status, education_level,
                      marital_status, loan_purpose):
    """Build a normalised ML payload from RWF inputs.
    Converts RWF→USD then scales income+loan UP so the profile sits within
    the model’s training distribution. All RATIOS (DTI, loan-to-income) are
    preserved from the original RWF values.
    """
    from .ml_service import DEFAULT_NUMERIC, CATEGORICAL_OPTIONS

    income_usd_raw = float(annual_income_rwf) / _RWF_TO_USD
    loan_usd_raw   = float(loan_amount_rwf)   / _RWF_TO_USD
    duration       = int(loan_duration_months) or 24

    # Scale both income and loan so income ≥ _TARGET_INCOME_USD (never scale down).
    scale      = max(_TARGET_INCOME_USD / income_usd_raw, 1.0) if income_usd_raw > 0 else 1.0
    income_usd = income_usd_raw * scale
    loan_usd   = loan_usd_raw   * scale   # ratio preserved exactly

    monthly_income  = income_usd / 12
    monthly_payment = loan_usd   / duration
    # DTI from original unscaled values so it stays accurate
    dti = round(min((loan_usd_raw / duration) / (income_usd_raw / 12), 0.95), 4) \
          if income_usd_raw > 0 else 0.35

    # Derive reasonable financial context from income so the model isn’t
    # fed contradictory defaults (e.g. $5,000 savings for a $90/month earner).
    savings      = round(income_usd * 0.15, 2)   # 15% of annual income
    checking     = round(income_usd * 0.08, 2)   # 8%
    total_assets = round(income_usd * 1.50, 2)   # 150% (land, equipment)
    liabilities  = round(income_usd * 0.20, 2)   # 20%
    net_worth    = round(total_assets - liabilities, 2)

    # Map 'Farming' → 'Other' — the model’s encoder never saw 'Farming'
    purpose = loan_purpose or 'Other'
    if purpose not in ('Debt Consolidation', 'Education', 'Home', 'Other'):
        purpose = 'Other'

    payload = dict(DEFAULT_NUMERIC)
    payload.update({
        'Age':                         int(age),
        'AnnualIncome':                income_usd,
        'CreditScore':                 int(credit_score),
        'LoanAmount':                  loan_usd,
        'LoanDuration':                duration,
        'EmploymentStatus':            employment_status or 'Self-Employed',
        'EducationLevel':              education_level  or 'High School',
        'MaritalStatus':               marital_status   or 'Married',
        'LoanPurpose':                 purpose,
        'HomeOwnershipStatus':         'Own',
        'DebtToIncomeRatio':           dti,
        'TotalDebtToIncomeRatio':      dti,
        'MonthlyIncome':               monthly_income,
        'MonthlyLoanPayment':          monthly_payment,
        'MonthlyDebtPayments':         round(monthly_payment, 2),
        'SavingsAccountBalance':       savings,
        'CheckingAccountBalance':      checking,
        'TotalAssets':                 total_assets,
        'TotalLiabilities':            liabilities,
        'NetWorth':                    net_worth,
        'PaymentHistory':              25,   # training mean=24, std=4.85
        'UtilityBillsPaymentHistory':  0.90,
        'PreviousLoanDefaults':        0,
        'BankruptcyHistory':           0,
        'LengthOfCreditHistory':       8,
        'NumberOfCreditInquiries':     1,
        'NumberOfOpenCreditLines':     2,
        'CreditCardUtilizationRate':   0.20,
    })
    for k, opts in CATEGORICAL_OPTIONS.items():
        if payload.get(k) not in opts:
            payload[k] = opts[0]
    return payload, income_usd_raw, duration, income_usd_raw / 12


def _application_to_ml_payload(app):
    """Build ML model payload from LoanApplication."""
    payload, _, _, _ = _build_ml_payload(
        annual_income_rwf    = app.annual_income,
        loan_amount_rwf      = app.loan_amount_requested,
        loan_duration_months = app.loan_duration_months,
        age                  = app.age,
        credit_score         = app.credit_score,
        employment_status    = app.employment_status,
        education_level      = app.education_level,
        marital_status       = app.marital_status,
        loan_purpose         = app.loan_purpose,
    )
    return payload


# ----- Farmer APIs -----

@swagger_auto_schema(method='get', operation_description='Get farmer profile. Farmer only.', tags=['Farmer'])
@swagger_auto_schema(method='patch', operation_description='Update farmer profile.', tags=['Farmer'])
@api_view(['GET', 'PATCH'])
@permission_classes([IsAuthenticated])
def farmer_profile(request):
    """GET/PATCH /api/farmer/profile/ — Get or update farmer profile."""
    if not _is_farmer(request.user):
        return Response({'error': 'Farmer access required'}, status=status.HTTP_403_FORBIDDEN)

    def _serialize_profile(profile_obj):
        photo_url = None
        if profile_obj.profile_photo:
            try:
                photo_url = request.build_absolute_uri(profile_obj.profile_photo.url)
            except Exception:
                photo_url = profile_obj.profile_photo.url
        location_parts = _parse_farmer_location(profile_obj.location)
        return {
            'id': profile_obj.id,
            'user_id': request.user.id,
            'full_name': request.user.first_name or request.user.username.split('@')[0],
            'email': request.user.email or request.user.username,
            'location': profile_obj.location,
            'district': location_parts['district'],
            'sector': location_parts['sector'],
            'cell': location_parts['cell'],
            'village': location_parts['village'],
            'phone': profile_obj.phone,
            'cooperative_name': profile_obj.cooperative_name,
            'gender': profile_obj.gender,
            'blood_group': profile_obj.blood_group,
            'about': profile_obj.about,
            'profile_photo_url': photo_url,
            'created_at': profile_obj.created_at.isoformat(),
            'updated_at': profile_obj.updated_at.isoformat(),
        }

    profile, _ = FarmerProfile.objects.get_or_create(user=request.user)
    if request.method == 'GET':
        return Response(_serialize_profile(profile))

    # PATCH
    data = request.data if hasattr(request, 'data') and request.data is not None else _get_payload(request)
    has_structured_location = any(field in data for field in ('district', 'sector', 'cell', 'village'))
    if has_structured_location:
        current_parts = _parse_farmer_location(profile.location)
        profile.location = _format_farmer_location(
            data.get('district', current_parts['district']) if hasattr(data, 'get') else current_parts['district'],
            data.get('sector', current_parts['sector']) if hasattr(data, 'get') else current_parts['sector'],
            data.get('cell', current_parts['cell']) if hasattr(data, 'get') else current_parts['cell'],
            data.get('village', current_parts['village']) if hasattr(data, 'get') else current_parts['village'],
        )
    elif 'location' in data:
        profile.location = str(data['location'])[:200]
    if 'phone' in data:
        profile.phone = str(data['phone'])[:20]
    if 'cooperative_name' in data:
        profile.cooperative_name = str(data['cooperative_name'])[:200]
    if 'gender' in data:
        profile.gender = str(data['gender'])[:20]
    if 'blood_group' in data:
        profile.blood_group = str(data['blood_group'])[:10]
    if 'about' in data:
        profile.about = str(data['about'])[:4000]

    full_name = data.get('full_name') if hasattr(data, 'get') else None
    if full_name is not None:
        request.user.first_name = str(full_name)[:150]
        request.user.save(update_fields=['first_name'])

    photo_file = request.FILES.get('profile_photo') if hasattr(request, 'FILES') else None
    if photo_file is not None:
        content_type = getattr(photo_file, 'content_type', '') or ''
        if not content_type.startswith('image/'):
            return Response({'error': 'Profile photo must be an image.'}, status=status.HTTP_400_BAD_REQUEST)
        if getattr(photo_file, 'size', 0) > 5 * 1024 * 1024:
            return Response({'error': 'Profile photo must be 5MB or smaller.'}, status=status.HTTP_400_BAD_REQUEST)
        if profile.profile_photo:
            try:
                profile.profile_photo.delete(save=False)
            except Exception:
                pass
        profile.profile_photo = photo_file

    profile.save()
    return Response(_serialize_profile(profile))


# Rwanda required loan documents (for display and upload)
# Base list (language-agnostic for type + required flag)
REQUIRED_DOCUMENTS_BASE = [
    {'document_type': 'national_id', 'required': True},
    {'document_type': 'proof_of_income', 'required': True},
    {'document_type': 'land_certificate', 'required': False},
    {'document_type': 'marital_status_certificate', 'required': True},
    {'document_type': 'recommendation_letter', 'required': True},
    {'document_type': 'proof_of_address', 'required': False},
    {'document_type': 'spouse_id', 'required': False},
]


def _required_document_types_for_application(app):
    required = {doc['document_type'] for doc in REQUIRED_DOCUMENTS_BASE if doc['required']}
    if str(app.marital_status or '').strip().lower() == 'married':
        required.add('spouse_id')
    return required


def _document_label(document_type):
    return dict(DOCUMENT_TYPE_CHOICES).get(document_type, document_type)


def _missing_required_document_labels(app):
    uploaded = set(app.documents.values_list('document_type', flat=True))
    missing = sorted(_required_document_types_for_application(app) - uploaded)
    return [_document_label(doc_type) for doc_type in missing]


def _build_application_rejection_reason(app, officer_note=''):
    profile_reason = ''
    if app.eligibility_approved is False:
        profile_reason = (app.eligibility_reason or '').strip()
        if not profile_reason:
            profile_reason = eligibility_reason(_application_to_ml_payload(app), False, 'en')

    return application_rejection_reason(
        profile_reason=profile_reason,
        missing_documents=_missing_required_document_labels(app),
        document_issues=officer_note,
        language='en',
    )

# Per-language labels and descriptions
REQUIRED_DOCUMENTS_I18N = {
    'national_id': {
        'en': {
            'name': 'National ID or Passport',
            'description': 'Valid national ID or passport (both sides if applicable).',
        },
        'fr': {
            'name': "Carte d'identite nationale ou passeport",
            'description': "Carte d'identite nationale valide ou passeport (recto-verso si necessaire).",
        },
        'rw': {
            'name': 'Indangamuntu cyangwa pasiporo',
            'description': 'Indangamuntu yemewe cyangwa pasiporo (impande zombi niba bikenewe).',
        },
    },
    'proof_of_income': {
        'en': {
            'name': 'Proof of income / Bank statements',
            'description': 'Latest 6-12 months bank statements or proof of income for self-employed.',
        },
        'fr': {
            'name': 'Preuve de revenus / Releves bancaires',
            'description': 'Releves bancaires des 6-12 derniers mois ou preuve de revenus pour les travailleurs independants.',
        },
        'rw': {
            'name': "Ikimenyetso cy'amikoro / raporo za banki",
            'description': "Ama raporo ya konti ya banki y'amezi 6-12 ashize cyangwa ikimenyetso cy'amikoro ku bikorera ku giti cyabo.",
        },
    },
    'land_certificate': {
        'en': {
            'name': 'Land certificate / Proof of land ownership',
            'description': 'Required if using land as collateral.',
        },
        'fr': {
            'name': 'Titre foncier / Preuve de propriete de la terre',
            'description': 'Requis si la terre est utilisee comme garantie.',
        },
        'rw': {
            'name': "Icyangombwa cy'ubutaka / gihamya y'ubutaka",
            'description': "Gikenewe niba ubutaka bukoreshejwe nk'ingwate.",
        },
    },
    'marital_status_certificate': {
        'en': {
            'name': 'Marital status certificate',
            'description': 'Marriage, single, widow or divorce certificate (e.g. via Irembo).',
        },
        'fr': {
            'name': "Attestation d'etat civil",
            'description': 'Attestation de mariage, celibat, veuvage ou divorce (par exemple via Irembo).',
        },
        'rw': {
            'name': "Icyemezo cy'uko wubatse",
            'description': "Icyemezo cy'ubushyingiwe, ubusore, ubapfakazi cyangwa gatanya (urugero: Irembo).",
        },
    },
    'recommendation_letter': {
        'en': {
            'name': 'Recommendation letter',
            'description': 'From local authority (umudugudu/sector) or subcommittee.',
        },
        'fr': {
            'name': 'Lettre de recommandation',
            'description': 'Lettre des autorites locales (umudugudu/secteur) ou du comite competent.',
        },
        'rw': {
            'name': "Ibaruwa y'ubuhamya",
            'description': "Itangwa n'inzego z'ibanze (umudugudu / umurenge) cyangwa komite ibishinzwe.",
        },
    },
    'proof_of_address': {
        'en': {
            'name': 'Proof of address',
            'description': 'Utility bill or official letter showing your address.',
        },
        'fr': {
            'name': 'Justificatif de domicile',
            'description': 'Facture de services publics ou lettre officielle indiquant votre adresse.',
        },
        'rw': {
            'name': "Gihamya y'aho utuye",
            'description': "Fature y'itumanaho/umuriro cyangwa ibaruwa yemewe igaragaza aderesi yawe.",
        },
    },
    'spouse_id': {
        'en': {
            'name': 'Spouse ID (if married)',
            'description': 'National ID of spouse if you are married.',
        },
        'fr': {
            'name': "Piece d'identite du/de la conjoint(e)",
            'description': "Carte d'identite nationale du/de la conjoint(e) si vous etes marie(e).",
        },
        'rw': {
            'name': "Indangamuntu y'umugabo/umugore",
            'description': "Indangamuntu y'umugabo cyangwa umugore wawe niba mwashyingiranywe.",
        },
    },
}


@swagger_auto_schema(method='get', operation_description='List required documents for loan application in Rwanda.', tags=['Farmer'])
@api_view(['GET'])
@permission_classes([AllowAny])
def required_documents(request):
    """GET /api/farmer/required-documents/ — Required documents for Rwanda loan applications.

    Optional query param: ?language=en|fr|rw (default: en).
    """
    lang = request.query_params.get('language', 'en').strip().lower()[:2]
    if lang not in ('en', 'fr', 'rw'):
        lang = 'en'
    docs = []
    for base in REQUIRED_DOCUMENTS_BASE:
        doc_type = base['document_type']
        i18n = REQUIRED_DOCUMENTS_I18N.get(doc_type, {})
        labels = i18n.get(lang) or i18n.get('en') or {}
        docs.append({
            'document_type': doc_type,
            'required': base['required'],
            'name': labels.get('name', doc_type),
            'description': labels.get('description', ''),
        })
    return Response({'documents': docs})


@swagger_auto_schema(method='get', operation_description='List farmer loan applications.', tags=['Farmer'])
@swagger_auto_schema(method='post', operation_description='Submit new loan application. Runs ML models.', tags=['Farmer'])
@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def farmer_applications(request):
    """GET /api/farmer/applications/ — List my applications. POST — Submit new with ML evaluation."""
    if not _is_farmer(request.user):
        return Response({'error': 'Farmer access required'}, status=status.HTTP_403_FORBIDDEN)
    if request.method == 'POST':
        data = _get_payload(request)
        # Validate required numeric fields
        try:
            age = int(data.get('age', 35))
            annual_income = float(data.get('annual_income', 0))
            credit_score = int(data.get('credit_score', 600))
            loan_amount_requested = float(data.get('loan_amount_requested', 0))
            loan_duration_months = int(data.get('loan_duration_months', 24))
        except (TypeError, ValueError) as e:
            return Response({'error': 'Invalid number in application (age, income, credit score, amount, or duration).'}, status=status.HTTP_400_BAD_REQUEST)
        if age < 18 or age > 100:
            return Response({'error': 'Age must be between 18 and 100.'}, status=status.HTTP_400_BAD_REQUEST)
        if loan_amount_requested <= 0:
            return Response({'error': 'Loan amount must be greater than 0.'}, status=status.HTTP_400_BAD_REQUEST)
        if loan_duration_months < 1 or loan_duration_months > 120:
            return Response({'error': 'Loan duration must be between 1 and 120 months.'}, status=status.HTTP_400_BAD_REQUEST)
        def _str(val, max_len, default=''):
            s = (val if val is not None else default)
            return str(s).strip()[:max_len] if s else ''
        def _decimal(val):
            if val is None or val == '':
                return None
            try:
                return float(val)
            except (TypeError, ValueError):
                return None
        app = LoanApplication(
            user=request.user,
            age=age,
            annual_income=annual_income,
            credit_score=credit_score,
            loan_amount_requested=loan_amount_requested,
            loan_duration_months=loan_duration_months,
            employment_status=_str(data.get('employment_status'), 30, 'Self-Employed'),
            education_level=_str(data.get('education_level'), 30, 'High School'),
            marital_status=_str(data.get('marital_status'), 20, 'Married'),
            loan_purpose=_str(data.get('loan_purpose'), 50, 'Other'),
            farming_crops_or_activity=_str(data.get('farming_crops_or_activity'), 300),
            farming_land_size_hectares=_decimal(data.get('farming_land_size_hectares')),
            farming_season=_str(data.get('farming_season'), 100),
            farming_estimated_yield=_decimal(data.get('farming_estimated_yield')),
            farming_livestock=_str(data.get('farming_livestock'), 200),
            farming_notes=_str(data.get('farming_notes'), 2000),
            farm_employees_count=int(data.get('farm_employees_count', 0) or 0),
            farm_employees_summary=_str(data.get('farm_employees_summary'), 2000),
            production_records_count=int(data.get('production_records_count', 0) or 0),
            production_records_summary=_str(data.get('production_records_summary'), 2000),
            seed_stock_count=int(data.get('seed_stock_count', 0) or 0),
            fertilizer_records_count=int(data.get('fertilizer_records_count', 0) or 0),
        )
        payload = _application_to_ml_payload(app)
        app_lang = (data.get('language') or data.get('lang') or 'en')
        app_lang = str(app_lang).strip().lower()[:2]
        if app_lang not in ('en', 'fr', 'rw'):
            app_lang = 'en'
        try:
            app.eligibility_approved = predict_eligibility(payload)
            app.eligibility_reason = eligibility_reason(payload, app.eligibility_approved, app_lang)
            app.risk_score = predict_risk(payload)
            if app.eligibility_approved:
                raw_rec_usd = recommend_loan_amount(payload)
                # Cap recommended amount to 35% DTI affordable maximum
                annual_income_usd = float(app.annual_income) / _RWF_TO_USD
                monthly_income_usd = annual_income_usd / 12
                duration = int(app.loan_duration_months) or 24
                max_affordable_usd = monthly_income_usd * _MAX_DTI * duration
                rec_usd = min(raw_rec_usd, max_affordable_usd)
                app.recommended_amount = rec_usd * _RWF_TO_USD
            else:
                app.recommended_amount = None
        except FileNotFoundError:
            return Response({'error': 'ML models not available'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        app.save()
        ApplicationStatusUpdate.objects.create(
            application=app,
            status='pending',
            note='',
            updated_by=None,
        )
        return Response({
            'id': app.id,
            'status': app.status,
            'eligibility_approved': app.eligibility_approved,
            'eligibility_reason': app.eligibility_reason,
            'rejection_reason': app.rejection_reason or None,
            'risk_score': app.risk_score,
            'recommended_amount': float(app.recommended_amount) if app.recommended_amount else None,
            'created_at': app.created_at.isoformat(),
        }, status=status.HTTP_201_CREATED)
    # GET
    apps = LoanApplication.objects.filter(user=request.user).prefetch_related('status_updates', 'documents', 'messages__sender').order_by('-created_at')[:50]
    data = []
    for a in apps:
        history = [
            {
                'status': u.status,
                'note': u.note or '',
                'created_at': u.created_at.isoformat(),
                'updated_by_name': getattr(u.updated_by, 'first_name', None) or getattr(u.updated_by, 'username', '') or 'System',
            }
            for u in a.status_updates.all().order_by('created_at')
        ]
        docs = [
            {
                'document_type': d.document_type,
                'document_name': d.get_document_type_display(),
                'file_name': d.file.name.split('/')[-1] if d.file else None,
                'file_url': request.build_absolute_uri(d.file.url) if d.file else None,
                'uploaded_at': d.uploaded_at.isoformat(),
            }
            for d in a.documents.all()
        ]
        messages = [
            {
                'id': m.id,
                'message': m.message,
                'sender_name': getattr(m.sender, 'first_name', None) or getattr(m.sender, 'username', '') or 'MFI Officer',
                'sender_role': _user_role(m.sender),
                'created_at': m.created_at.isoformat(),
            }
            for m in a.messages.all().order_by('-created_at')[:10]
        ]
        created_short = a.created_at.strftime('%Y%m%d')
        farmer_label = _safe_filename_part(getattr(a.user, 'first_name', '') or a.user.username.split('@')[0], fallback='farmer')
        data.append({
            'id': a.id,
            'loan_amount_requested': float(a.loan_amount_requested),
            'loan_duration_months': a.loan_duration_months,
            'status': a.status,
            'eligibility_approved': a.eligibility_approved,
            'eligibility_reason': a.eligibility_reason or '',
            'rejection_reason': a.rejection_reason or None,
            'risk_score': a.risk_score,
            'recommended_amount': float(a.recommended_amount) if a.recommended_amount else None,
            'created_at': a.created_at.isoformat(),
            'status_history': history,
            'messages': messages,
            'documents': docs,
            'folder_name': f"{farmer_label}_{created_short}_application_{a.id}",
            'package_download_url': f"/api/farmer/applications/{a.id}/package/",
            'farming_crops_or_activity': a.farming_crops_or_activity or '',
            'farming_land_size_hectares': float(a.farming_land_size_hectares) if a.farming_land_size_hectares is not None else None,
            'farming_season': a.farming_season or '',
            'farming_estimated_yield': float(a.farming_estimated_yield) if a.farming_estimated_yield is not None else None,
            'farming_livestock': a.farming_livestock or '',
            'farming_notes': a.farming_notes or '',
        })
    return Response({'applications': data, 'count': len(data)})


VALID_DOCUMENT_TYPES = [c[0] for c in DOCUMENT_TYPE_CHOICES]


@swagger_auto_schema(method='get', operation_description='List documents for an application.', tags=['Farmer'])
@swagger_auto_schema(method='post', operation_description='Upload a document for an application.', tags=['Farmer'])
@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def farmer_application_documents(request, pk):
    """GET/POST /api/farmer/applications/<id>/documents/ — List or upload documents (farmer must own application)."""
    if not _is_farmer(request.user):
        return Response({'error': 'Farmer access required'}, status=status.HTTP_403_FORBIDDEN)
    try:
        app = LoanApplication.objects.get(pk=pk, user=request.user)
    except LoanApplication.DoesNotExist:
        return Response({'error': 'Application not found'}, status=status.HTTP_404_NOT_FOUND)
    if request.method == 'POST':
        document_type = (request.POST.get('document_type') or '').strip()
        if document_type not in VALID_DOCUMENT_TYPES:
            return Response(
                {'error': f'Invalid document_type. Allowed: {", ".join(VALID_DOCUMENT_TYPES)}'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        file_obj = request.FILES.get('file')
        if not file_obj:
            return Response({'error': 'No file provided'}, status=status.HTTP_400_BAD_REQUEST)
        doc, created = LoanApplicationDocument.objects.update_or_create(
            application=app,
            document_type=document_type,
            defaults={'file': file_obj},
        )
        return Response(
            {
                'id': doc.id,
                'document_type': doc.document_type,
                'file_name': doc.file.name.split('/')[-1] if doc.file else None,
                'uploaded_at': doc.uploaded_at.isoformat(),
                'created': created,
            },
            status=status.HTTP_201_CREATED,
        )
    # GET
    docs = LoanApplicationDocument.objects.filter(application=app).order_by('document_type')
    data = [
        {
            'id': d.id,
            'document_type': d.document_type,
            'file_name': d.file.name.split('/')[-1] if d.file else None,
            'uploaded_at': d.uploaded_at.isoformat(),
        }
        for d in docs
    ]
    return Response({'documents': data})


@swagger_auto_schema(method='get', operation_description='List farmer approved loans.', tags=['Farmer'])
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def farmer_loans(request):
    """GET /api/farmer/loans/ — List my approved loans."""
    if not _is_farmer(request.user):
        return Response({'error': 'Farmer access required'}, status=status.HTTP_403_FORBIDDEN)
    apps = LoanApplication.objects.filter(user=request.user, status='approved')
    loan_ids = [a.id for a in apps]
    loans = Loan.objects.filter(application_id__in=loan_ids).select_related('application')
    data = [
        {
            'id': lo.id,
            'application_id': lo.application_id,
            'amount': float(lo.amount),
            'interest_rate': float(lo.interest_rate),
            'duration_months': lo.duration_months,
            'monthly_payment': float(lo.monthly_payment),
            'created_at': lo.created_at.isoformat(),
        }
        for lo in loans
    ]
    return Response({'loans': data, 'count': len(data)})


@swagger_auto_schema(method='get', operation_description='List repayments for farmer loans.', tags=['Farmer'])
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def farmer_repayments(request):
    """GET /api/farmer/repayments/ — List repayments for my loans, grouped by loan."""
    if not _is_farmer(request.user):
        return Response({'error': 'Farmer access required'}, status=status.HTTP_403_FORBIDDEN)
    apps = LoanApplication.objects.filter(user=request.user, status='approved')
    loan_ids = [a.id for a in apps]
    loans = Loan.objects.filter(application_id__in=loan_ids).prefetch_related('repayments')
    loans_data = []
    for loan in loans:
        repayments = list(loan.repayments.order_by('due_date'))
        loans_data.append({
            'loan_id': loan.id,
            'application_id': loan.application_id,
            'total_amount': float(loan.amount),
            'monthly_payment': float(loan.monthly_payment),
            'interest_rate': float(loan.interest_rate),
            'duration_months': loan.duration_months,
            'created_at': loan.created_at.isoformat(),
            'repayments': [
                {
                    'id': r.id,
                    'amount': float(r.amount),
                    'due_date': str(r.due_date),
                    'status': r.status,
                    'paid_at': r.paid_at.isoformat() if r.paid_at else None,
                }
                for r in repayments
            ],
        })
    # Flat list kept for backward compat
    all_repayments = [
        {
            'id': r.id,
            'loan_id': r.loan_id,
            'amount': float(r.amount),
            'due_date': str(r.due_date),
            'status': r.status,
            'paid_at': r.paid_at.isoformat() if r.paid_at else None,
        }
        for loan in loans
        for r in loan.repayments.order_by('due_date')
    ]
    return Response({'repayments': all_repayments, 'loans': loans_data, 'count': len(all_repayments)})


@swagger_auto_schema(method='patch', operation_description='Disabled — repayments are marked paid by MFI only.', tags=['Farmer'])
@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def farmer_mark_repayment_paid(request, pk):
    """PATCH /api/farmer/repayments/<id>/mark-paid/ — Disabled; only MFI can mark repayments paid."""
    return Response({'error': 'Only the microfinance institution can mark repayments as paid.'}, status=status.HTTP_403_FORBIDDEN)


# ----- MFI APIs -----


def _safe_filename_part(value, fallback='item'):
    raw = (value or '').strip()
    cleaned = re.sub(r'[^A-Za-z0-9._-]+', '_', raw).strip('._')
    return cleaned or fallback


def _pdf_escape_text(text):
    val = (text or '').replace('\\', '\\\\').replace('(', '\\(').replace(')', '\\)')
    return val.encode('latin-1', 'replace').decode('latin-1')


def _build_text_pdf(lines):
    """Create a simple text-only PDF without external dependencies."""
    max_lines = 48
    visible_lines = list(lines[:max_lines])
    if len(lines) > max_lines:
        visible_lines.append('... (truncated)')

    stream_lines = ["BT", "/F1 11 Tf", "50 800 Td", "14 TL"]
    for line in visible_lines:
        stream_lines.append(f"({_pdf_escape_text(str(line))}) Tj")
        stream_lines.append("T*")
    stream_lines.append("ET")
    content = "\n".join(stream_lines).encode('latin-1', 'replace')

    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
        f"<< /Length {len(content)} >>\nstream\n".encode('latin-1') + content + b"\nendstream",
    ]

    buf = BytesIO()
    buf.write(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
    offsets = [0]
    for i, obj in enumerate(objects, start=1):
        offsets.append(buf.tell())
        buf.write(f"{i} 0 obj\n".encode('latin-1'))
        buf.write(obj)
        buf.write(b"\nendobj\n")
    xref_pos = buf.tell()
    buf.write(f"xref\n0 {len(objects) + 1}\n".encode('latin-1'))
    buf.write(b"0000000000 65535 f \n")
    for off in offsets[1:]:
        buf.write(f"{off:010d} 00000 n \n".encode('latin-1'))
    buf.write(f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref_pos}\n%%EOF".encode('latin-1'))
    return buf.getvalue()


@swagger_auto_schema(method='get', operation_description='Download own application package (summary PDF + uploaded docs) as ZIP. Farmer only.', tags=['Farmer'])
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def farmer_application_package(request, pk):
    """GET /api/farmer/applications/<id>/package/ — Farmer downloads own application materials as ZIP."""
    if not _is_farmer(request.user):
        return Response({'error': 'Farmer access required'}, status=status.HTTP_403_FORBIDDEN)
    try:
        app = LoanApplication.objects.select_related('user').prefetch_related('documents', 'status_updates').get(pk=pk, user=request.user)
    except LoanApplication.DoesNotExist:
        return Response({'error': 'Application not found'}, status=status.HTTP_404_NOT_FOUND)

    farmer_name = getattr(app.user, 'first_name', '') or app.user.username
    folder_name = f"{_safe_filename_part(farmer_name, fallback='farmer')}_{app.created_at.strftime('%Y%m%d')}_application_{app.id}"

    summary_lines = [
        "AgriFinConnect Rwanda - Farmer Application Package",
        f"Application ID: {app.id}",
        f"Submitted at: {app.created_at.isoformat()}",
        f"Current status: {app.status}",
        "",
        f"Farmer name: {farmer_name}",
        f"Farmer email: {app.user.username}",
        "",
        f"Requested amount (RWF): {float(app.loan_amount_requested):,.2f}",
        f"Loan duration (months): {app.loan_duration_months}",
        f"Annual income (RWF): {float(app.annual_income):,.2f}",
        f"Credit score: {app.credit_score}",
        f"Employment status: {app.employment_status}",
        f"Education level: {app.education_level}",
        f"Marital status: {app.marital_status}",
        f"Loan purpose: {app.loan_purpose}",
        "",
        f"Eligibility approved: {app.eligibility_approved}",
        f"Eligibility reason: {app.eligibility_reason or '-'}",
        f"Final rejection reason: {app.rejection_reason or '-'}",
        f"Risk score: {app.risk_score if app.risk_score is not None else '-'}",
        f"Recommended amount (RWF): {float(app.recommended_amount):,.2f}" if app.recommended_amount is not None else "Recommended amount (RWF): -",
        "",
        f"Farming activity: {app.farming_crops_or_activity or '-'}",
        f"Land size (ha): {app.farming_land_size_hectares if app.farming_land_size_hectares is not None else '-'}",
        f"Season: {app.farming_season or '-'}",
        f"Estimated yield: {app.farming_estimated_yield if app.farming_estimated_yield is not None else '-'}",
        f"Livestock: {app.farming_livestock or '-'}",
        f"Notes: {app.farming_notes or '-'}",
        "",
        "Status history:",
    ]
    for h in app.status_updates.all().order_by('created_at'):
        by_name = getattr(h.updated_by, 'first_name', None) or getattr(h.updated_by, 'username', '') or 'System'
        summary_lines.append(f"- {h.created_at.isoformat()} | {h.status} | by {by_name} | note: {h.note or '-'}")

    zip_buffer = BytesIO()
    with zipfile.ZipFile(zip_buffer, mode='w', compression=zipfile.ZIP_DEFLATED) as zf:
        zf.writestr(f"{folder_name}/application_summary.pdf", _build_text_pdf(summary_lines))
        zf.writestr(
            f"{folder_name}/application_summary.json",
            json.dumps(
                {
                    'application_id': app.id,
                    'submitted_at': app.created_at.isoformat(),
                    'status': app.status,
                    'farmer': {'name': farmer_name, 'email': app.user.username},
                    'loan': {
                        'requested_amount': float(app.loan_amount_requested),
                        'duration_months': app.loan_duration_months,
                        'annual_income': float(app.annual_income),
                        'credit_score': app.credit_score,
                    },
                },
                indent=2,
            ),
        )
        for d in app.documents.all().order_by('document_type'):
            if not d.file:
                continue
            doc_label = _safe_filename_part(d.document_type, fallback='document')
            base_name = _safe_filename_part(d.file.name.split('/')[-1], fallback=f"{doc_label}.bin")
            archive_name = f"{folder_name}/documents/{doc_label}__{base_name}"
            try:
                d.file.open('rb')
                zf.writestr(archive_name, d.file.read())
            finally:
                try:
                    d.file.close()
                except Exception:
                    pass

    response = HttpResponse(zip_buffer.getvalue(), content_type='application/zip')
    response['Content-Disposition'] = f'attachment; filename="{folder_name}.zip"'
    return response

@swagger_auto_schema(method='get', operation_description='List all loan applications for review. MFI only.', tags=['MFI'])
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def mfi_applications(request):
    """GET /api/mfi/applications/ — List applications for MFI review."""
    if not _is_microfinance(request.user):
        return Response({'error': 'Microfinance access required'}, status=status.HTTP_403_FORBIDDEN)
    status_filter = (request.query_params.get('status', 'all') or 'all').strip().lower()
    qs = LoanApplication.objects.select_related('user', 'user__farmer_profile').prefetch_related('status_updates', 'documents', 'messages__sender')
    if status_filter and status_filter != 'all':
        qs = qs.filter(status=status_filter)
    qs = qs.order_by('-created_at')[:200]
    data = []
    for a in qs:
        farmer_profile = getattr(a.user, 'farmer_profile', None)
        farmer_photo_url = None
        if farmer_profile and getattr(farmer_profile, 'profile_photo', None):
            try:
                farmer_photo_url = request.build_absolute_uri(farmer_profile.profile_photo.url)
            except Exception:
                farmer_photo_url = farmer_profile.profile_photo.url
        history = [
            {
                'status': u.status,
                'note': u.note or '',
                'created_at': u.created_at.isoformat(),
                'updated_by_name': getattr(u.updated_by, 'first_name', None) or getattr(u.updated_by, 'username', '') or 'System',
            }
            for u in a.status_updates.all().order_by('created_at')
        ]
        docs = []
        for d in a.documents.all().order_by('document_type'):
            file_url = request.build_absolute_uri(d.file.url) if d.file else None
            docs.append({
                'id': d.id,
                'document_type': d.document_type,
                'document_name': d.get_document_type_display(),
                'file_name': d.file.name.split('/')[-1] if d.file else None,
                'file_url': file_url,
                'uploaded_at': d.uploaded_at.isoformat(),
            })
        messages = [
            {
                'id': m.id,
                'message': m.message,
                'sender_name': getattr(m.sender, 'first_name', None) or getattr(m.sender, 'username', '') or 'MFI Officer',
                'created_at': m.created_at.isoformat(),
            }
            for m in a.messages.all().order_by('-created_at')[:10]
        ]
        created_short = a.created_at.strftime('%Y%m%d')
        farmer_label = _safe_filename_part(getattr(a.user, 'first_name', '') or a.user.username.split('@')[0], fallback='farmer')
        location_parts = _parse_farmer_location(getattr(farmer_profile, 'location', '') if farmer_profile else '')
        data.append({
            'id': a.id,
            'user_id': a.user_id,
            'user_email': a.user.username,
            'user_name': getattr(a.user, 'first_name', '') or '',
            'farmer_profile': {
                'location': getattr(farmer_profile, 'location', '') if farmer_profile else '',
            'district': location_parts['district'],
            'sector': location_parts['sector'],
            'cell': location_parts['cell'],
            'village': location_parts['village'],
                'phone': getattr(farmer_profile, 'phone', '') if farmer_profile else '',
                'cooperative_name': getattr(farmer_profile, 'cooperative_name', '') if farmer_profile else '',
                'gender': getattr(farmer_profile, 'gender', '') if farmer_profile else '',
                'about': getattr(farmer_profile, 'about', '') if farmer_profile else '',
                'profile_photo_url': farmer_photo_url,
            },
            'loan_amount_requested': float(a.loan_amount_requested),
            'loan_duration_months': a.loan_duration_months,
            'employment_status': a.employment_status,
            'annual_income': float(a.annual_income),
            'credit_score': a.credit_score,
            'eligibility_approved': a.eligibility_approved,
            'eligibility_reason': a.eligibility_reason,
            'rejection_reason': a.rejection_reason or None,
            'risk_score': a.risk_score,
            'recommended_amount': float(a.recommended_amount) if a.recommended_amount else None,
            'status': a.status,
            'created_at': a.created_at.isoformat(),
            'status_history': history,
            'messages': messages,
            'documents': docs,
            'folder_name': f"{farmer_label}_{created_short}_application_{a.id}",
            'package_download_url': f"/api/mfi/applications/{a.id}/package/",
            'farming_crops_or_activity': a.farming_crops_or_activity or '',
            'farming_land_size_hectares': float(a.farming_land_size_hectares) if a.farming_land_size_hectares is not None else None,
            'farming_season': a.farming_season or '',
            'farming_estimated_yield': float(a.farming_estimated_yield) if a.farming_estimated_yield is not None else None,
            'farming_livestock': a.farming_livestock or '',
            'farming_notes': a.farming_notes or '',
        })
    return Response({'applications': data, 'count': len(data)})


@swagger_auto_schema(method='get', operation_description='Download application package (summary PDF + uploaded docs) as ZIP. MFI only.', tags=['MFI'])
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def mfi_application_package(request, pk):
    """GET /api/mfi/applications/<id>/package/ — Download all application materials as a folder-like ZIP."""
    if not _is_microfinance(request.user):
        return Response({'error': 'Microfinance access required'}, status=status.HTTP_403_FORBIDDEN)
    try:
        app = LoanApplication.objects.select_related('user').prefetch_related('documents', 'status_updates').get(pk=pk)
    except LoanApplication.DoesNotExist:
        return Response({'error': 'Application not found'}, status=status.HTTP_404_NOT_FOUND)

    farmer_name = getattr(app.user, 'first_name', '') or app.user.username
    folder_name = f"{_safe_filename_part(farmer_name, fallback='farmer')}_{app.created_at.strftime('%Y%m%d')}_application_{app.id}"

    summary_lines = [
        "AgriFinConnect Rwanda - Loan Application Package",
        f"Application ID: {app.id}",
        f"Submitted at: {app.created_at.isoformat()}",
        f"Current status: {app.status}",
        "",
        f"Farmer name: {farmer_name}",
        f"Farmer email: {app.user.username}",
        "",
        f"Requested amount (RWF): {float(app.loan_amount_requested):,.2f}",
        f"Loan duration (months): {app.loan_duration_months}",
        f"Annual income (RWF): {float(app.annual_income):,.2f}",
        f"Credit score: {app.credit_score}",
        f"Employment status: {app.employment_status}",
        f"Education level: {app.education_level}",
        f"Marital status: {app.marital_status}",
        f"Loan purpose: {app.loan_purpose}",
        "",
        f"Eligibility approved: {app.eligibility_approved}",
        f"Eligibility reason: {app.eligibility_reason or '-'}",
        f"Final rejection reason: {app.rejection_reason or '-'}",
        f"Risk score: {app.risk_score if app.risk_score is not None else '-'}",
        f"Recommended amount (RWF): {float(app.recommended_amount):,.2f}" if app.recommended_amount is not None else "Recommended amount (RWF): -",
        "",
        f"Farming activity: {app.farming_crops_or_activity or '-'}",
        f"Land size (ha): {app.farming_land_size_hectares if app.farming_land_size_hectares is not None else '-'}",
        f"Season: {app.farming_season or '-'}",
        f"Estimated yield: {app.farming_estimated_yield if app.farming_estimated_yield is not None else '-'}",
        f"Livestock: {app.farming_livestock or '-'}",
        f"Notes: {app.farming_notes or '-'}",
        "",
        "Status history:",
    ]
    for h in app.status_updates.all().order_by('created_at'):
        by_name = getattr(h.updated_by, 'first_name', None) or getattr(h.updated_by, 'username', '') or 'System'
        summary_lines.append(f"- {h.created_at.isoformat()} | {h.status} | by {by_name} | note: {h.note or '-'}")

    zip_buffer = BytesIO()
    with zipfile.ZipFile(zip_buffer, mode='w', compression=zipfile.ZIP_DEFLATED) as zf:
        zf.writestr(f"{folder_name}/application_summary.pdf", _build_text_pdf(summary_lines))
        zf.writestr(
            f"{folder_name}/application_summary.json",
            json.dumps(
                {
                    'application_id': app.id,
                    'submitted_at': app.created_at.isoformat(),
                    'status': app.status,
                    'farmer': {'name': farmer_name, 'email': app.user.username},
                    'loan': {
                        'requested_amount': float(app.loan_amount_requested),
                        'duration_months': app.loan_duration_months,
                        'annual_income': float(app.annual_income),
                        'credit_score': app.credit_score,
                    },
                },
                indent=2,
            ),
        )
        for d in app.documents.all().order_by('document_type'):
            if not d.file:
                continue
            doc_label = _safe_filename_part(d.document_type, fallback='document')
            base_name = _safe_filename_part(d.file.name.split('/')[-1], fallback=f"{doc_label}.bin")
            archive_name = f"{folder_name}/documents/{doc_label}__{base_name}"
            try:
                d.file.open('rb')
                zf.writestr(archive_name, d.file.read())
            finally:
                try:
                    d.file.close()
                except Exception:
                    pass

    response = HttpResponse(zip_buffer.getvalue(), content_type='application/zip')
    response['Content-Disposition'] = f'attachment; filename="{folder_name}.zip"'
    return response


MFI_ALLOWED_STATUSES = ('under_review', 'documents_requested', 'approved', 'rejected')


def _application_status_history(app):
    """Build status_history list for an application."""
    return [
        {
            'status': u.status,
            'note': u.note or '',
            'created_at': u.created_at.isoformat(),
            'updated_by_name': getattr(u.updated_by, 'first_name', None) or getattr(u.updated_by, 'username', '') or 'System',
        }
        for u in app.status_updates.all().order_by('created_at')
    ]


@swagger_auto_schema(
    method='post',
    operation_description='Update application status (under_review, documents_requested, approved, rejected). MFI only.',
    tags=['MFI'],
)
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def mfi_update_application_status(request, pk):
    """POST /api/mfi/applications/<id>/update-status/ — Set status and optional note. Creates Loan when approved."""
    if not _is_microfinance(request.user):
        return Response({'error': 'Microfinance access required'}, status=status.HTTP_403_FORBIDDEN)
    data = _get_payload(request)
    new_status = (data.get('status') or '').strip().lower()
    note = (data.get('note') or '').strip()[:1000]
    if new_status not in MFI_ALLOWED_STATUSES:
        return Response(
            {'error': f'status must be one of: {", ".join(MFI_ALLOWED_STATUSES)}'},
            status=status.HTTP_400_BAD_REQUEST,
        )
    try:
        app = LoanApplication.objects.prefetch_related('status_updates').get(pk=pk)
    except LoanApplication.DoesNotExist:
        return Response({'error': 'Application not found'}, status=status.HTTP_404_NOT_FOUND)
    if app.status in ('approved', 'rejected'):
        return Response({'error': 'Application already has a final status'}, status=status.HTTP_400_BAD_REQUEST)
    from django.utils import timezone
    app.status = new_status
    app.updated_at = timezone.now()
    if new_status == 'approved':
        app.reviewed_by = request.user
        app.reviewed_at = timezone.now()
        app.rejection_reason = ''
        amount = float(data.get('amount') or app.recommended_amount or app.loan_amount_requested)
        interest_rate = float(data.get('interest_rate', 0.12))
        duration = int(data.get('duration_months') or app.loan_duration_months)
        monthly = amount * (interest_rate / 12) * (1 + interest_rate / 12) ** duration / ((1 + interest_rate / 12) ** duration - 1) if duration else 0
        loan, loan_created = Loan.objects.get_or_create(
            application=app,
            defaults=dict(
                amount=amount,
                interest_rate=interest_rate,
                duration_months=duration,
                monthly_payment=round(monthly, 2),
            ),
        )
        import calendar as _cal
        from datetime import date as _date
        from decimal import Decimal
        if loan_created:
            start = timezone.now().date()
            for i in range(duration):
                m = start.month + i + 1
                y = start.year + (m - 1) // 12
                m = (m - 1) % 12 + 1
                day = min(start.day, _cal.monthrange(y, m)[1])
                Repayment.objects.create(loan=loan, amount=Decimal(str(round(monthly, 2))), due_date=_date(y, m, day))
        if not ApplicationStatusUpdate.objects.filter(application=app, status='approved').exists():
            ApplicationStatusUpdate.objects.create(
                application=app, status='approved', note=note or 'Approved by MFI', updated_by=request.user,
            )
    elif new_status == 'rejected':
        app.reviewed_by = request.user
        app.reviewed_at = timezone.now()
        app.rejection_reason = _build_application_rejection_reason(app, note)
        ApplicationStatusUpdate.objects.create(
            application=app, status='rejected', note=app.rejection_reason, updated_by=request.user,
        )
    else:
        if new_status == 'documents_requested' and not note:
            note = application_rejection_reason(
                missing_documents=_missing_required_document_labels(app),
                document_issues='Please correct and re-upload the documents that do not match the application details.',
                language='en',
            )
        ApplicationStatusUpdate.objects.create(
            application=app, status=new_status, note=note, updated_by=request.user,
        )
        if new_status == 'documents_requested' and note:
            LoanApplicationMessage.objects.create(
                application=app,
                sender=request.user,
                recipient=app.user,
                message=note,
            )
    app.save()

    if new_status in ('under_review', 'documents_requested', 'approved', 'rejected'):
        sms_text = (
            f'AgriFinConnect: Your application #{app.id} status is now "{new_status.replace("_", " ")}".'
        )
        if new_status == 'documents_requested' and note:
            sms_text += f' Note: {note[:220]}'
        if new_status == 'rejected' and app.rejection_reason:
            sms_text += f' Reason: {app.rejection_reason[:220]}'
        _notify_farmer_sms(app, sms_text, context='mfi_status_update')

    history = _application_status_history(app)
    return Response({
        'id': app.id,
        'status': app.status,
        'status_history': history,
        'reviewed_at': app.reviewed_at.isoformat() if app.reviewed_at else None,
        'rejection_reason': app.rejection_reason if app.status == 'rejected' else None,
    })


@swagger_auto_schema(method='post', operation_description='Send message to the farmer for a specific application. MFI only.', tags=['MFI'])
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def mfi_send_application_message(request, pk):
    """POST /api/mfi/applications/<id>/messages/ — Send a direct message to the farmer for this application."""
    if not _is_microfinance(request.user):
        return Response({'error': 'Microfinance access required'}, status=status.HTTP_403_FORBIDDEN)
    data = _get_payload(request)
    message = (data.get('message') or '').strip()[:2000]
    if not message:
        return Response({'error': 'Message is required.'}, status=status.HTTP_400_BAD_REQUEST)
    try:
        app = LoanApplication.objects.select_related('user').get(pk=pk)
    except LoanApplication.DoesNotExist:
        return Response({'error': 'Application not found'}, status=status.HTTP_404_NOT_FOUND)
    msg = LoanApplicationMessage.objects.create(
        application=app,
        sender=request.user,
        recipient=app.user,
        message=message,
    )
    _notify_farmer_sms(
        app,
        f'AgriFinConnect message on application #{app.id}: {message[:240]}',
        context='mfi_message',
    )
    return Response({
        'id': msg.id,
        'application_id': app.id,
        'message': msg.message,
        'sender_name': getattr(request.user, 'first_name', None) or getattr(request.user, 'username', '') or 'MFI Officer',
        'created_at': msg.created_at.isoformat(),
    }, status=status.HTTP_201_CREATED)


@swagger_auto_schema(method='post', operation_description='Approve or reject loan application. MFI only.', tags=['MFI'])
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def mfi_review_application(request, pk):
    """POST /api/mfi/applications/<id>/review/ — Approve or reject."""
    if not _is_microfinance(request.user):
        return Response({'error': 'Microfinance access required'}, status=status.HTTP_403_FORBIDDEN)
    data = _get_payload(request)
    action = data.get('action', '')  # 'approve' or 'reject'
    if action not in ('approve', 'reject'):
        return Response({'error': 'action must be approve or reject'}, status=status.HTTP_400_BAD_REQUEST)
    try:
        app = LoanApplication.objects.get(pk=pk, status__in=('pending', 'under_review', 'documents_requested'))
    except LoanApplication.DoesNotExist:
        return Response({'error': 'Application not found or already reviewed'}, status=status.HTTP_404_NOT_FOUND)
    from django.utils import timezone
    app.reviewed_by = request.user
    app.reviewed_at = timezone.now()
    if action == 'approve':
        app.status = 'approved'
        app.rejection_reason = ''
        ApplicationStatusUpdate.objects.create(
            application=app, status='approved', note=data.get('rejection_reason', '') or 'Approved by MFI', updated_by=request.user,
        )
        amount = float(data.get('amount') or app.recommended_amount or app.loan_amount_requested)
        interest_rate = float(data.get('interest_rate', 0.12))
        duration = int(data.get('duration_months') or app.loan_duration_months)
        monthly = amount * (interest_rate / 12) * (1 + interest_rate / 12) ** duration / ((1 + interest_rate / 12) ** duration - 1) if duration else 0
        loan = Loan.objects.create(
            application=app,
            amount=amount,
            interest_rate=interest_rate,
            duration_months=duration,
            monthly_payment=round(monthly, 2),
        )
        # Create repayment schedule
        import calendar as _cal
        from datetime import date as _date
        from decimal import Decimal
        start = timezone.now().date()
        for i in range(duration):
            m = start.month + i + 1
            y = start.year + (m - 1) // 12
            m = (m - 1) % 12 + 1
            day = min(start.day, _cal.monthrange(y, m)[1])
            Repayment.objects.create(loan=loan, amount=Decimal(str(round(monthly, 2))), due_date=_date(y, m, day))
    else:
        app.status = 'rejected'
        officer_note = str(data.get('rejection_reason', '') or '').strip()[:1000]
        app.rejection_reason = _build_application_rejection_reason(app, officer_note)
        ApplicationStatusUpdate.objects.create(
            application=app, status='rejected', note=app.rejection_reason, updated_by=request.user,
        )
    app.save()
    review_sms = f'AgriFinConnect: Your application #{app.id} was {app.status}.'
    if app.status == 'rejected' and app.rejection_reason:
        review_sms += f' Reason: {app.rejection_reason[:220]}'
    _notify_farmer_sms(app, review_sms, context='mfi_review')
    return Response({
        'id': app.id,
        'status': app.status,
        'reviewed_at': app.reviewed_at.isoformat(),
        'rejection_reason': app.rejection_reason if app.status == 'rejected' else None,
    })


@swagger_auto_schema(method='get', operation_description='Portfolio summary: approved loans and repayment stats. MFI only.', tags=['MFI'])
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def mfi_portfolio(request):
    """GET /api/mfi/portfolio/ — Portfolio and repayment performance, including per-loan schedules."""
    if not _is_microfinance(request.user):
        return Response({'error': 'Microfinance access required'}, status=status.HTTP_403_FORBIDDEN)
    from django.db.models import Sum
    loans_qs = Loan.objects.select_related('application__user').prefetch_related('repayments').order_by('-created_at')
    total_loans = loans_qs.count()
    total_disbursed = loans_qs.aggregate(s=Sum('amount'))['s'] or 0
    all_repayments = Repayment.objects.all()
    paid = sum(1 for r in all_repayments if r.status == 'paid')
    overdue = sum(1 for r in all_repayments if r.status == 'overdue')
    pending = sum(1 for r in all_repayments if r.status == 'pending')
    from datetime import date as _today_cls
    today = _today_cls.today()
    loans_data = []
    for loan in loans_qs:
        app = loan.application
        farmer_name = (app.user.first_name or app.user.username.split('@')[0]) if app and app.user else '—'
        farmer_email = (app.user.email or app.user.username) if app and app.user else '—'
        repayments_list = list(loan.repayments.order_by('due_date'))
        # Auto-mark past-due pending repayments as overdue
        for r in repayments_list:
            if r.status == 'pending' and r.due_date < today:
                r.status = 'overdue'
                r.save(update_fields=['status'])
        loans_data.append({
            'loan_id': loan.id,
            'application_id': loan.application_id,
            'farmer_name': farmer_name,
            'farmer_email': farmer_email,
            'amount': float(loan.amount),
            'monthly_payment': float(loan.monthly_payment),
            'interest_rate': float(loan.interest_rate),
            'duration_months': loan.duration_months,
            'issued_at': loan.created_at.date().isoformat(),
            'created_at': loan.created_at.isoformat(),
            'repayments': [
                {
                    'id': r.id,
                    'amount': float(r.amount),
                    'due_date': str(r.due_date),
                    'status': r.status,
                    'paid_at': r.paid_at.isoformat() if r.paid_at else None,
                }
                for r in repayments_list
            ],
        })
    return Response({
        'total_loans': total_loans,
        'total_amount_disbursed': float(total_disbursed),
        'repayments': {'paid': paid, 'overdue': overdue, 'pending': pending, 'total': all_repayments.count()},
        'loans': loans_data,
    })


@swagger_auto_schema(method='patch', operation_description='Mark a repayment as paid. MFI only.', tags=['MFI'])
@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def mfi_mark_repayment_paid(request, pk):
    """PATCH /api/mfi/repayments/<id>/mark-paid/ — Mark any repayment as paid (MFI only)."""
    if not _is_microfinance(request.user):
        return Response({'error': 'Microfinance access required'}, status=status.HTTP_403_FORBIDDEN)
    try:
        repayment = Repayment.objects.get(pk=pk)
    except Repayment.DoesNotExist:
        return Response({'error': 'Repayment not found'}, status=status.HTTP_404_NOT_FOUND)
    if repayment.status == 'paid':
        return Response({'id': repayment.id, 'status': repayment.status, 'paid_at': repayment.paid_at.isoformat()})
    from django.utils import timezone as tz
    repayment.status = 'paid'
    repayment.paid_at = tz.now()
    repayment.save(update_fields=['status', 'paid_at'])
    return Response({
        'id': repayment.id,
        'status': repayment.status,
        'paid_at': repayment.paid_at.isoformat(),
        'amount': float(repayment.amount),
        'due_date': str(repayment.due_date),
    })


# ----- Admin APIs (extended) -----

@swagger_auto_schema(method='get', operation_description='List all loan applications. Admin only.', tags=['Admin'])
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def admin_applications_list(request):
    """GET /api/admin/applications/ — List all loan applications."""
    if not _is_admin(request.user):
        return Response({'error': 'Admin access required'}, status=status.HTTP_403_FORBIDDEN)
    status_filter = request.query_params.get('status', '')
    qs = LoanApplication.objects.select_related('user').order_by('-created_at')
    if status_filter:
        qs = qs.filter(status=status_filter)
    limit = min(int(request.query_params.get('limit', 100)), 500)
    qs = qs[:limit]
    data = [
        {
            'id': a.id,
            'user_email': a.user.username if a.user else '',
            'status': a.status,
            'loan_amount_requested': float(a.loan_amount_requested or 0),
            'loan_duration_months': a.loan_duration_months,
            'created_at': a.created_at.isoformat() if a.created_at else '',
        }
        for a in qs
    ]
    return Response({'applications': data, 'count': len(data)})


@swagger_auto_schema(method='get', operation_description='Full detail of a single loan application. Admin only.', tags=['Admin'])
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def admin_application_detail(request, application_id):
    """GET /api/admin/applications/<id>/ — Full detail including farming fields, AI outputs, and documents."""
    if not _is_admin(request.user):
        return Response({'error': 'Admin access required'}, status=status.HTTP_403_FORBIDDEN)
    try:
        app = LoanApplication.objects.select_related('user', 'reviewed_by').prefetch_related('documents').get(id=application_id)
    except LoanApplication.DoesNotExist:
        return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)

    documents = [
        {
            'id': d.id,
            'document_type': d.document_type,
            'document_type_display': d.get_document_type_display(),
            'file_url': request.build_absolute_uri(d.file.url) if d.file else None,
            'uploaded_at': d.uploaded_at.isoformat() if d.uploaded_at else '',
        }
        for d in app.documents.all()
    ]

    return Response({
        'id': app.id,
        'user_email': app.user.username if app.user else '',
        'user_name': f"{app.user.first_name} {app.user.last_name}".strip() if app.user else '',
        # Personal & financial
        'age': app.age,
        'annual_income': float(app.annual_income or 0),
        'credit_score': app.credit_score,
        'employment_status': app.employment_status,
        'education_level': app.education_level,
        'marital_status': app.marital_status,
        # Loan details
        'loan_amount_requested': float(app.loan_amount_requested or 0),
        'loan_duration_months': app.loan_duration_months,
        'loan_purpose': app.loan_purpose,
        # Farming context
        'farming_crops_or_activity': app.farming_crops_or_activity,
        'farming_land_size_hectares': float(app.farming_land_size_hectares) if app.farming_land_size_hectares else None,
        'farming_season': app.farming_season,
        'farming_estimated_yield': float(app.farming_estimated_yield) if app.farming_estimated_yield else None,
        'farming_livestock': app.farming_livestock,
        'farming_notes': app.farming_notes,
        # AI outputs
        'eligibility_approved': app.eligibility_approved,
        'eligibility_reason': app.eligibility_reason,
        'risk_score': app.risk_score,
        'recommended_amount': float(app.recommended_amount) if app.recommended_amount else None,
        # Status & review
        'status': app.status,
        'reviewed_by': app.reviewed_by.username if app.reviewed_by else None,
        'reviewed_at': app.reviewed_at.isoformat() if app.reviewed_at else None,
        'rejection_reason': app.rejection_reason,
        'created_at': app.created_at.isoformat() if app.created_at else '',
        'updated_at': app.updated_at.isoformat() if app.updated_at else '',
        # Documents
        'documents': documents,
    })


@swagger_auto_schema(method='patch', operation_description='Update loan application status. Admin only.', tags=['Admin'])
@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def admin_update_application_status(request, application_id):
    """PATCH /api/admin/applications/<id>/status/ — Update status and optional rejection reason."""
    if not _is_admin(request.user):
        return Response({'error': 'Admin access required'}, status=status.HTTP_403_FORBIDDEN)
    try:
        app = LoanApplication.objects.get(id=application_id)
    except LoanApplication.DoesNotExist:
        return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)

    new_status = request.data.get('status')
    valid_statuses = [s[0] for s in LOAN_STATUS_CHOICES]
    if new_status not in valid_statuses:
        valid_str = ', '.join(valid_statuses)
        return Response(
            {'error': f'Invalid status. Must be one of: {valid_str}'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    app.status = new_status
    if 'rejection_reason' in request.data:
        app.rejection_reason = request.data['rejection_reason']
    app.reviewed_by = request.user
    app.reviewed_at = timezone.now()
    app.save(update_fields=['status', 'rejection_reason', 'reviewed_by', 'reviewed_at', 'updated_at'])
    admin_sms = f'AgriFinConnect: Your application #{app.id} status was updated to "{app.status.replace("_", " ")}" by admin.'
    if app.status == 'rejected' and app.rejection_reason:
        admin_sms += f' Reason: {str(app.rejection_reason)[:220]}'
    _notify_farmer_sms(app, admin_sms, context='admin_status_update')
    return Response({'success': True, 'id': app.id, 'status': app.status})


@swagger_auto_schema(method='get', operation_description='List users. Admin only.', tags=['Admin'])
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def admin_users_list(request):
    """GET /api/admin/users/ — List users by role."""
    if not _is_admin(request.user):
        return Response({'error': 'Admin access required'}, status=status.HTTP_403_FORBIDDEN)
    role_filter = request.query_params.get('role', '')
    qs = UserProfile.objects.select_related('user').all()
    if role_filter in ('farmer', 'microfinance', 'admin'):
        qs = qs.filter(role=role_filter)
    limit = min(int(request.query_params.get('limit', 50)), 200)
    qs = qs[:limit]
    data = [
        {
            'id': p.user_id,
            'email': p.user.username,
            'name': getattr(p.user, 'first_name', '') or '',
            'role': p.role,
        }
        for p in qs
    ]
    return Response({'users': data, 'count': len(data)})


@swagger_auto_schema(method='get', operation_description='System stats for admin dashboard.', tags=['Admin'])
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def admin_stats(request):
    """GET /api/admin/stats/ — Dashboard statistics."""
    if not _is_admin(request.user):
        return Response({'error': 'Admin access required'}, status=status.HTTP_403_FORBIDDEN)
    from django.db.models import Count
    farmers = UserProfile.objects.filter(role='farmer').count()
    mfi = UserProfile.objects.filter(role='microfinance').count()
    apps_pending = LoanApplication.objects.filter(status='pending').count()
    apps_approved = LoanApplication.objects.filter(status='approved').count()
    apps_rejected = LoanApplication.objects.filter(status='rejected').count()
    return Response({
        'users': {'farmers': farmers, 'microfinance': mfi},
        'applications': {'pending': apps_pending, 'approved': apps_approved, 'rejected': apps_rejected},
    })


