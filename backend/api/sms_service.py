import logging
import re
from django.conf import settings

logger = logging.getLogger(__name__)


def _normalize_phone(phone):
    raw = str(phone or '').strip()
    if not raw:
        return ''
    if raw.startswith('+'):
        return '+' + re.sub(r'\D', '', raw)
    digits = re.sub(r'\D', '', raw)
    if digits.startswith('0'):
        return '+25' + digits
    if digits.startswith('25'):
        return '+' + digits
    if digits.startswith('7') and len(digits) == 9:
        return '+250' + digits
    return '+' + digits if digits else ''


def send_sms(to_phone, message, context='general'):
    normalized_phone = _normalize_phone(to_phone)
    clean_message = str(message or '').strip()

    if not normalized_phone or not clean_message:
        return {'sent': False, 'provider': 'none', 'reason': 'phone_or_message_missing'}

    provider = (getattr(settings, 'SMS_PROVIDER', 'log') or 'log').strip().lower()

    if provider == 'twilio':
        account_sid = getattr(settings, 'SMS_TWILIO_ACCOUNT_SID', '').strip()
        auth_token = getattr(settings, 'SMS_TWILIO_AUTH_TOKEN', '').strip()
        from_number = getattr(settings, 'SMS_FROM_NUMBER', '').strip()
        if not account_sid or not auth_token or not from_number:
            logger.warning('SMS twilio config missing; logging fallback SMS. context=%s to=%s msg=%s', context, normalized_phone, clean_message)
            return {'sent': False, 'provider': 'twilio', 'reason': 'missing_credentials'}
        try:
            from twilio.rest import Client
            client = Client(account_sid, auth_token)
            msg = client.messages.create(body=clean_message[:480], from_=from_number, to=normalized_phone)
            return {'sent': True, 'provider': 'twilio', 'sid': msg.sid}
        except Exception as exc:
            logger.exception('SMS send failed via Twilio. context=%s to=%s', context, normalized_phone)
            return {'sent': False, 'provider': 'twilio', 'reason': str(exc)}

    logger.info('SMS fallback log mode. context=%s to=%s message=%s', context, normalized_phone, clean_message)
    return {'sent': True, 'provider': 'log', 'sid': None}
