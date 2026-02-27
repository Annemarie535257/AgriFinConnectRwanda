"""
User profile with role: farmer, microfinance, or admin.
Admin users are created in the backend (Django admin / management command) and use login only.
"""
import secrets
from django.conf import settings
from django.db import models
from django.utils import timezone

ROLE_CHOICES = [
    ('farmer', 'Farmer'),
    ('microfinance', 'Microfinance'),
    ('admin', 'Admin'),
]


class UserProfile(models.Model):
    """Extended profile: links User to role (farmer, microfinance, admin)."""
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='agrifin_profile',
    )
    role = models.CharField(max_length=20, choices=ROLE_CHOICES)

    class Meta:
        db_table = 'api_userprofile'

    def __str__(self):
        return f"{self.user.username} ({self.role})"


EVENT_TYPE_CHOICES = [
    ('modal_opened', 'Modal opened'),
    ('register_clicked', 'Register clicked'),
    ('login_clicked', 'Login clicked'),
]


class GetStartedEvent(models.Model):
    """Logs Get Started modal activity for admin analytics. Visitors trigger events without auth."""
    event_type = models.CharField(max_length=30, choices=EVENT_TYPE_CHOICES)
    role = models.CharField(max_length=20, default='')  # farmers, microfinances, admin
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=500, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'api_getstartedevent'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.event_type} ({self.role}) at {self.created_at}"


def _default_token_expiry():
    return timezone.now() + timezone.timedelta(hours=1)


class PasswordResetToken(models.Model):
    """One-time token for password reset. Expires after 1 hour."""
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='password_reset_tokens',
    )
    token = models.CharField(max_length=64, unique=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(default=_default_token_expiry)

    class Meta:
        db_table = 'api_passwordresettoken'
        ordering = ['-created_at']

    def __str__(self):
        return f"Reset for {self.user.email} expires {self.expires_at}"

    @classmethod
    def create_for_user(cls, user):
        """Create a new reset token for user. Invalidates previous tokens."""
        cls.objects.filter(user=user).delete()
        token = secrets.token_urlsafe(32)
        return cls.objects.create(user=user, token=token)

    @classmethod
    def get_valid_user(cls, token):
        """Return user if token is valid and not expired, else None."""
        now = timezone.now()
        try:
            prt = cls.objects.get(token=token, expires_at__gt=now)
            user = prt.user
            prt.delete()  # One-time use
            return user
        except cls.DoesNotExist:
            return None


# ----- Loan workflow models (per system analysis ERD) -----

class FarmerProfile(models.Model):
    """Extended profile for farmers: location, phone, agricultural context."""
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='farmer_profile',
    )
    location = models.CharField(max_length=200, blank=True)
    phone = models.CharField(max_length=20, blank=True)
    cooperative_name = models.CharField(max_length=200, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'api_farmerprofile'

    def __str__(self):
        return f"Farmer {self.user.username}"


class AgriculturalRecord(models.Model):
    """Farm records: crops, yields, land size for credit assessment."""
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='agricultural_records',
    )
    crop_type = models.CharField(max_length=100)
    land_size_hectares = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    estimated_yield = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    season = models.CharField(max_length=50, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'api_agriculturalrecord'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.crop_type} ({self.user.username})"


class FarmEmployee(models.Model):
    """Farm employees hired by the farmer (for certification and HR records)."""
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='farm_employees',
    )
    full_name = models.CharField(max_length=150)
    role = models.CharField(max_length=100, blank=True)
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    pay_frequency = models.CharField(
        max_length=20,
        blank=True,
        help_text="e.g. daily, weekly, monthly, per_season",
    )
    pay_amount = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    currency = models.CharField(max_length=10, default='RWF')
    status = models.CharField(
        max_length=20,
        default='active',
        help_text="active or inactive",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'api_farmemployee'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.full_name} ({self.user.username})"


class SeedStock(models.Model):
    """Seed and input stock used on the farm."""
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='seed_stock',
    )
    name = models.CharField(max_length=150)
    variety = models.CharField(max_length=150, blank=True)
    lot_number = models.CharField(max_length=100, blank=True)
    quantity = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    unit = models.CharField(
        max_length=20,
        default='kg',
        help_text="e.g. kg, bag, litre, piece",
    )
    supplier = models.CharField(max_length=200, blank=True)
    purchase_date = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'api_seedstock'
        ordering = ['-purchase_date', '-created_at']

    def __str__(self):
        return f"{self.name} ({self.user.username})"


class ProductionRecord(models.Model):
    """Detailed production record: what was planted, seed used, and harvest."""
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='production_records',
    )
    crop = models.CharField(max_length=150)
    field_name = models.CharField(max_length=150, blank=True)
    season = models.CharField(max_length=100, blank=True)
    planting_date = models.DateField(null=True, blank=True)
    harvest_date = models.DateField(null=True, blank=True)
    area_hectares = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    seed_name = models.CharField(max_length=150, blank=True)
    seed_variety = models.CharField(max_length=150, blank=True)
    seed_quantity = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    seed_unit = models.CharField(max_length=20, default='kg', blank=True)
    harvested_quantity = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    harvested_unit = models.CharField(max_length=20, default='kg', blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'api_productionrecord'
        ordering = ['-planting_date', '-created_at']

    def __str__(self):
        return f"{self.crop} ({self.user.username})"


LOAN_STATUS_CHOICES = [
    ('pending', 'Pending'),
    ('under_review', 'Under review'),
    ('documents_requested', 'Documents requested'),
    ('approved', 'Approved'),
    ('rejected', 'Rejected'),
]


class ApplicationStatusUpdate(models.Model):
    """Audit trail: each time an application's status changes (farmer submit or MFI update)."""
    application = models.ForeignKey(
        'LoanApplication',
        on_delete=models.CASCADE,
        related_name='status_updates',
    )
    status = models.CharField(max_length=30, choices=LOAN_STATUS_CHOICES)
    note = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='application_status_updates',
    )

    class Meta:
        db_table = 'api_applicationstatusupdate'
        ordering = ['created_at']

    def __str__(self):
        return f"App #{self.application_id} → {self.status}"


class LoanApplication(models.Model):
    """
    Loan application with ML-derived eligibility, risk, and recommended amount.
    Maps farmer input to ML model features.
    """
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='loan_applications',
    )
    # Application inputs (mapped to ML features)
    age = models.PositiveIntegerField(default=35)
    annual_income = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    credit_score = models.PositiveIntegerField(default=600)
    loan_amount_requested = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    loan_duration_months = models.PositiveIntegerField(default=24)
    employment_status = models.CharField(max_length=30, default='Self-Employed')
    education_level = models.CharField(max_length=30, default='High School')
    marital_status = models.CharField(max_length=20, default='Married')
    loan_purpose = models.CharField(max_length=50, default='Other')
    # Farming / agricultural context (what they are planting, etc.)
    farming_crops_or_activity = models.CharField(max_length=300, blank=True)
    farming_land_size_hectares = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    farming_season = models.CharField(max_length=100, blank=True)
    farming_estimated_yield = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    farming_livestock = models.CharField(max_length=200, blank=True)
    farming_notes = models.TextField(blank=True)
    # AI outputs
    eligibility_approved = models.BooleanField(null=True, blank=True)
    eligibility_reason = models.TextField(blank=True)
    risk_score = models.FloatField(null=True, blank=True)
    recommended_amount = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    # Status and review
    status = models.CharField(max_length=30, choices=LOAN_STATUS_CHOICES, default='pending')
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reviewed_applications',
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'api_loanapplication'
        ordering = ['-created_at']

    def __str__(self):
        return f"Loan #{self.id} ({self.user.username})"


# Rwanda loan application document types (aligned with SACCO/MFI requirements)
DOCUMENT_TYPE_CHOICES = [
    ('national_id', 'National ID or Passport'),
    ('proof_of_income', 'Proof of income / Bank statements'),
    ('land_certificate', 'Land certificate / Proof of land ownership'),
    ('marital_status_certificate', 'Marital status certificate (Irembo)'),
    ('recommendation_letter', 'Recommendation letter (local authority / subcommittee)'),
    ('proof_of_address', 'Proof of address'),
    ('spouse_id', 'Spouse ID (if married)'),
]


class LoanApplicationDocument(models.Model):
    """Document attached to a loan application (Rwanda requirements)."""
    application = models.ForeignKey(
        LoanApplication,
        on_delete=models.CASCADE,
        related_name='documents',
    )
    document_type = models.CharField(max_length=40, choices=DOCUMENT_TYPE_CHOICES)
    file = models.FileField(upload_to='loan_docs/%Y/%m/', max_length=255)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'api_loanapplicationdocument'
        ordering = ['document_type']
        unique_together = [['application', 'document_type']]

    def __str__(self):
        return f"{self.get_document_type_display()} for App #{self.application_id}"


class Loan(models.Model):
    """Approved loan with repayment schedule."""
    application = models.OneToOneField(
        LoanApplication,
        on_delete=models.CASCADE,
        related_name='approved_loan',
    )
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    interest_rate = models.DecimalField(max_digits=6, decimal_places=4, default=0.12)
    duration_months = models.PositiveIntegerField()
    monthly_payment = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    disbursed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'api_loan'
        ordering = ['-created_at']

    def __str__(self):
        return f"Loan #{self.id} ({self.amount})"


class Repayment(models.Model):
    """Individual repayment record for a loan."""
    loan = models.ForeignKey(
        Loan,
        on_delete=models.CASCADE,
        related_name='repayments',
    )
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    due_date = models.DateField()
    paid_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=20, default='pending')  # pending, paid, overdue
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'api_repayment'
        ordering = ['due_date']

    def __str__(self):
        return f"Repayment {self.amount} ({self.loan_id})"


class ChatInteraction(models.Model):
    """Log chatbot interactions for analytics and audit."""
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='chat_interactions',
    )
    message = models.TextField()
    reply = models.TextField()
    language = models.CharField(max_length=5, default='en')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'api_chatinteraction'
        ordering = ['-created_at']

    def __str__(self):
        return f"Chat {self.id}"
