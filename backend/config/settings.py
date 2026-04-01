"""
Django settings for AgriFinConnect Rwanda backend.
"""
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
# Project root (AgriFinConnect-Rwanda) for loading ML models
PROJECT_ROOT = BASE_DIR.parent

SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY', 'dev-secret-change-in-production')
DEBUG = os.environ.get('DJANGO_DEBUG', '1') == '1'
def _normalize_host(value: str) -> str:
    """Return a valid Django host entry from host or URL input."""
    host = (value or '').strip().strip("'\"")
    host = host.replace('https://', '').replace('http://', '')
    host = host.split('/')[0].strip()
    return host

ALLOWED_HOSTS = [
    _normalize_host(h)
    for h in os.environ.get(
        'DJANGO_ALLOWED_HOSTS',
        'localhost,127.0.0.1,agrifinconnect.online,www.agrifinconnect.online,video.kandaassist.com',
    ).split(',')
    if _normalize_host(h)
]

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'corsheaders',
    'rest_framework',
    'rest_framework.authtoken',
    'drf_yasg',
    'api',
]

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework.authentication.TokenAuthentication',
        'rest_framework.authentication.SessionAuthentication',
    ],
}

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

ROOT_URLCONF = 'config.urls'
WSGI_APPLICATION = 'config.wsgi.application'

# Database: use DATABASE_URL on Render (PostgreSQL), else SQLite locally
if os.environ.get('DATABASE_URL'):
    import dj_database_url
    DATABASES = {'default': dj_database_url.config(conn_max_age=600, conn_health_checks=True)}
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }
    }

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True
STATIC_URL = 'static/'
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# CORS: allow same-server production domain and local dev origins.
# For other deployments, set CORS_ALLOWED_ORIGINS as a comma-separated list.
_cors_env = os.environ.get('CORS_ALLOWED_ORIGINS', '').strip()
if _cors_env:
    CORS_ALLOWED_ORIGINS = [
        o.strip().strip("'\"")
        for o in _cors_env.split(',')
        if o.strip().strip("'\"")
    ]
else:
    CORS_ALLOWED_ORIGINS = [
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'https://agrifinconnect.online',  # Production
        'https://www.agrifinconnect.online',
        'https://video.kandaassist.com',
    ]
CORS_ALLOW_CREDENTIALS = True

_csrf_env = os.environ.get('CSRF_TRUSTED_ORIGINS', '').strip()
if _csrf_env:
    CSRF_TRUSTED_ORIGINS = [
        o.strip().strip("'\"")
        for o in _csrf_env.split(',')
        if o.strip().strip("'\"")
    ]
else:
    CSRF_TRUSTED_ORIGINS = [
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'https://agrifinconnect.online',
        'https://www.agrifinconnect.online',
        'https://video.kandaassist.com',
    ]

# Static files (WhiteNoise for production)
STATIC_ROOT = BASE_DIR / 'staticfiles'
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'

# ML models path (saved .pkl from notebook)
MODELS_DIR = PROJECT_ROOT / 'loan_default_risk_model'

# Fraud detection models
FRAUD_MODELS_DIR = PROJECT_ROOT / 'fraud_detection_model'

# Chatbot model: local directory (overrides default 'saved-model' in chatbot_service)
CHATBOT_MODEL_DIR = PROJECT_ROOT / 'AI_Chatbot_model'

# Email (for password reset). Console backend prints to terminal in dev.
_smtp_user = os.environ.get('EMAIL_HOST_USER', '').strip()
_smtp_pass = os.environ.get('EMAIL_HOST_PASSWORD', '').strip()
_default_email_backend = (
    'django.core.mail.backends.smtp.EmailBackend'
    if (_smtp_user and _smtp_pass)
    else 'django.core.mail.backends.console.EmailBackend'
)
EMAIL_BACKEND = os.environ.get('DJANGO_EMAIL_BACKEND', _default_email_backend)
EMAIL_HOST = os.environ.get('EMAIL_HOST', 'smtp.gmail.com')
EMAIL_PORT = int(os.environ.get('EMAIL_PORT', '587'))
EMAIL_USE_TLS = os.environ.get('EMAIL_USE_TLS', '1').strip().lower() in ('1', 'true', 'yes')
EMAIL_USE_SSL = os.environ.get('EMAIL_USE_SSL', '0').strip().lower() in ('1', 'true', 'yes')
EMAIL_HOST_USER = _smtp_user
EMAIL_HOST_PASSWORD = _smtp_pass
EMAIL_TIMEOUT = int(os.environ.get('EMAIL_TIMEOUT', '15'))
DEFAULT_FROM_EMAIL = os.environ.get('DJANGO_FROM_EMAIL', 'noreply@agrifinconnect.rw')
# Frontend URL for reset links (set in production)
PASSWORD_RESET_FRONTEND_URL = os.environ.get('PASSWORD_RESET_FRONTEND_URL', 'http://localhost:3000')

# SMS fallback configuration
# SMS_PROVIDER: 'log' (default) or 'twilio'
SMS_PROVIDER = os.environ.get('SMS_PROVIDER', 'log').strip().lower()
SMS_FROM_NUMBER = os.environ.get('SMS_FROM_NUMBER', '').strip()
SMS_TWILIO_ACCOUNT_SID = os.environ.get('SMS_TWILIO_ACCOUNT_SID', '').strip()
SMS_TWILIO_AUTH_TOKEN = os.environ.get('SMS_TWILIO_AUTH_TOKEN', '').strip()

# Media files (loan application documents)
MEDIA_ROOT = BASE_DIR / 'media'
MEDIA_URL = '/media/'
