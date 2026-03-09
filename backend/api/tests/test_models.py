"""
Model-level tests for AgriFinConnect Rwanda.

Coverage strategy for each model:
  - Creation with valid data (happy path)
  - __str__ representation
  - Field defaults and constraints
  - Cascade / deletion behaviour
  - Business-logic classmethods (PasswordResetToken)
  - Ordering / Meta options
  - Relationship integrity (ForeignKey, OneToOne, unique_together)
"""
import datetime
import pytest
from django.contrib.auth import get_user_model
from django.db import IntegrityError
from django.utils import timezone

from api.models import (
    AgriculturalRecord,
    ApplicationStatusUpdate,
    ChatInteraction,
    FarmEmployee,
    FarmerProfile,
    GetStartedEvent,
    Loan,
    LoanApplication,
    LoanApplicationDocument,
    LoanApplicationMessage,
    PasswordResetToken,
    ProductionRecord,
    Repayment,
    SeedStock,
    UserProfile,
)

User = get_user_model()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def make_user(username='user@test.com', password='Pass1234!'):
    return User.objects.create_user(
        username=username, email=username, password=password
    )


def make_application(user, **kwargs):
    defaults = dict(
        age=30,
        annual_income=5_000_000,
        credit_score=650,
        loan_amount_requested=1_000_000,
        loan_duration_months=12,
    )
    defaults.update(kwargs)
    return LoanApplication.objects.create(user=user, **defaults)


# ===========================================================================
# UserProfile
# ===========================================================================

@pytest.mark.django_db
class TestUserProfile:
    def test_create_farmer_profile(self):
        user = make_user('farmer@x.com')
        profile = UserProfile.objects.create(user=user, role='farmer')
        assert profile.pk is not None
        assert profile.role == 'farmer'

    def test_create_microfinance_profile(self):
        user = make_user('mfi@x.com')
        profile = UserProfile.objects.create(user=user, role='microfinance')
        assert profile.role == 'microfinance'

    def test_str_representation(self):
        user = make_user('str@x.com')
        profile = UserProfile.objects.create(user=user, role='admin')
        assert str(profile) == 'str@x.com (admin)'

    def test_one_to_one_user_link(self):
        user = make_user('oto@x.com')
        UserProfile.objects.create(user=user, role='farmer')
        assert user.agrifin_profile.role == 'farmer'

    def test_duplicate_profile_raises(self):
        user = make_user('dup@x.com')
        UserProfile.objects.create(user=user, role='farmer')
        with pytest.raises(IntegrityError):
            UserProfile.objects.create(user=user, role='microfinance')

    def test_cascade_delete_with_user(self):
        user = make_user('del@x.com')
        profile = UserProfile.objects.create(user=user, role='farmer')
        pk = profile.pk
        user.delete()
        assert not UserProfile.objects.filter(pk=pk).exists()


# ===========================================================================
# GetStartedEvent
# ===========================================================================

@pytest.mark.django_db
class TestGetStartedEvent:
    def test_create_event(self):
        event = GetStartedEvent.objects.create(
            event_type='modal_opened', role='farmers'
        )
        assert event.pk is not None
        assert event.event_type == 'modal_opened'

    def test_str_contains_event_type(self):
        event = GetStartedEvent.objects.create(event_type='login_clicked', role='admin')
        assert 'login_clicked' in str(event)

    def test_default_role_is_empty_string(self):
        event = GetStartedEvent.objects.create(event_type='modal_opened')
        assert event.role == ''

    def test_ip_address_optional(self):
        event = GetStartedEvent.objects.create(event_type='register_clicked')
        assert event.ip_address is None

    def test_ordering_newest_first(self):
        for i in range(3):
            GetStartedEvent.objects.create(event_type='modal_opened')
        events = list(GetStartedEvent.objects.all())
        # Ordering = ['-created_at']: first item created_at >= last item
        assert events[0].created_at >= events[-1].created_at


# ===========================================================================
# PasswordResetToken
# ===========================================================================

@pytest.mark.django_db
class TestPasswordResetToken:
    def test_create_for_user_generates_token(self):
        user = make_user('prt@x.com')
        prt = PasswordResetToken.create_for_user(user)
        assert prt.token
        assert len(prt.token) > 10

    def test_token_is_unique(self):
        user = make_user('prt2@x.com')
        t1 = PasswordResetToken.create_for_user(user)
        user2 = make_user('prt3@x.com')
        t2 = PasswordResetToken.create_for_user(user2)
        assert t1.token != t2.token

    def test_create_for_user_deletes_previous_tokens(self):
        user = make_user('prt4@x.com')
        PasswordResetToken.create_for_user(user)
        PasswordResetToken.create_for_user(user)
        assert PasswordResetToken.objects.filter(user=user).count() == 1

    def test_get_valid_user_returns_user(self):
        user = make_user('prt5@x.com')
        prt = PasswordResetToken.create_for_user(user)
        found = PasswordResetToken.get_valid_user(prt.token)
        assert found == user

    def test_get_valid_user_deletes_token_after_use(self):
        user = make_user('prt6@x.com')
        prt = PasswordResetToken.create_for_user(user)
        token_value = prt.token
        PasswordResetToken.get_valid_user(token_value)
        assert not PasswordResetToken.objects.filter(token=token_value).exists()

    def test_get_valid_user_with_expired_token(self):
        user = make_user('prt7@x.com')
        prt = PasswordResetToken.create_for_user(user)
        # Force expiry to the past
        prt.expires_at = timezone.now() - timezone.timedelta(hours=2)
        prt.save()
        assert PasswordResetToken.get_valid_user(prt.token) is None

    def test_get_valid_user_with_wrong_token(self):
        assert PasswordResetToken.get_valid_user('no-such-token') is None

    def test_default_expiry_is_one_hour_from_now(self):
        user = make_user('prt8@x.com')
        prt = PasswordResetToken.create_for_user(user)
        delta = prt.expires_at - prt.created_at
        # Should be ~1 hour (allow ±5 seconds for test execution time)
        assert abs(delta.total_seconds() - 3600) < 5

    def test_cascade_delete_with_user(self):
        user = make_user('prt9@x.com')
        prt = PasswordResetToken.create_for_user(user)
        pk = prt.pk
        user.delete()
        assert not PasswordResetToken.objects.filter(pk=pk).exists()

    def test_str_contains_email(self):
        user = make_user('prt10@x.com')
        prt = PasswordResetToken.create_for_user(user)
        assert 'prt10@x.com' in str(prt)


# ===========================================================================
# FarmerProfile
# ===========================================================================

@pytest.mark.django_db
class TestFarmerProfile:
    def test_create_minimal(self):
        user = make_user('fp@x.com')
        profile = FarmerProfile.objects.create(user=user)
        assert profile.pk is not None

    def test_str_contains_username(self):
        user = make_user('fp2@x.com')
        profile = FarmerProfile.objects.create(user=user)
        assert 'fp2@x.com' in str(profile)

    def test_optional_fields_default_blank(self):
        user = make_user('fp3@x.com')
        profile = FarmerProfile.objects.create(user=user)
        assert profile.location == ''
        assert profile.phone == ''
        assert profile.cooperative_name == ''

    def test_reverse_relation(self):
        user = make_user('fp4@x.com')
        FarmerProfile.objects.create(user=user, location='Kigali')
        assert user.farmer_profile.location == 'Kigali'

    def test_cascade_delete_with_user(self):
        user = make_user('fp5@x.com')
        fp = FarmerProfile.objects.create(user=user)
        pk = fp.pk
        user.delete()
        assert not FarmerProfile.objects.filter(pk=pk).exists()


# ===========================================================================
# AgriculturalRecord
# ===========================================================================

@pytest.mark.django_db
class TestAgriculturalRecord:
    def test_create(self):
        user = make_user('ar@x.com')
        record = AgriculturalRecord.objects.create(
            user=user, crop_type='Maize', land_size_hectares=2.5
        )
        assert record.pk is not None
        assert record.crop_type == 'Maize'

    def test_str_contains_crop_and_user(self):
        user = make_user('ar2@x.com')
        record = AgriculturalRecord.objects.create(user=user, crop_type='Rice')
        assert 'Rice' in str(record)
        assert 'ar2@x.com' in str(record)

    def test_default_land_size_is_zero(self):
        user = make_user('ar3@x.com')
        record = AgriculturalRecord.objects.create(user=user, crop_type='Beans')
        assert record.land_size_hectares == 0

    def test_estimated_yield_can_be_null(self):
        user = make_user('ar4@x.com')
        record = AgriculturalRecord.objects.create(user=user, crop_type='Sorghum')
        assert record.estimated_yield is None

    def test_multiple_records_per_user(self):
        user = make_user('ar5@x.com')
        AgriculturalRecord.objects.create(user=user, crop_type='Maize')
        AgriculturalRecord.objects.create(user=user, crop_type='Rice')
        assert user.agricultural_records.count() == 2

    def test_cascade_delete_with_user(self):
        user = make_user('ar6@x.com')
        AgriculturalRecord.objects.create(user=user, crop_type='Wheat')
        user.delete()
        assert AgriculturalRecord.objects.filter(user__username='ar6@x.com').count() == 0


# ===========================================================================
# FarmEmployee
# ===========================================================================

@pytest.mark.django_db
class TestFarmEmployee:
    def test_create(self):
        user = make_user('fe@x.com')
        emp = FarmEmployee.objects.create(user=user, full_name='John Doe')
        assert emp.pk is not None
        assert emp.currency == 'RWF'
        assert emp.status == 'active'

    def test_str(self):
        user = make_user('fe2@x.com')
        emp = FarmEmployee.objects.create(user=user, full_name='Alice Uwase')
        assert 'Alice Uwase' in str(emp)

    def test_status_default_active(self):
        user = make_user('fe3@x.com')
        emp = FarmEmployee.objects.create(user=user, full_name='Bob')
        assert emp.status == 'active'

    def test_pay_amount_optional(self):
        user = make_user('fe4@x.com')
        emp = FarmEmployee.objects.create(user=user, full_name='Carol')
        assert emp.pay_amount is None


# ===========================================================================
# SeedStock
# ===========================================================================

@pytest.mark.django_db
class TestSeedStock:
    def test_create(self):
        user = make_user('ss@x.com')
        stock = SeedStock.objects.create(user=user, name='Maize Seed')
        assert stock.pk is not None
        assert stock.unit == 'kg'
        assert stock.quantity == 0

    def test_str(self):
        user = make_user('ss2@x.com')
        stock = SeedStock.objects.create(user=user, name='Bean Seed')
        assert 'Bean Seed' in str(stock)

    def test_purchase_date_optional(self):
        user = make_user('ss3@x.com')
        stock = SeedStock.objects.create(user=user, name='Sorghum')
        assert stock.purchase_date is None


# ===========================================================================
# ProductionRecord
# ===========================================================================

@pytest.mark.django_db
class TestProductionRecord:
    def test_create(self):
        user = make_user('pr@x.com')
        rec = ProductionRecord.objects.create(user=user, crop='Maize')
        assert rec.pk is not None
        assert rec.seed_unit == 'kg'
        assert rec.harvested_unit == 'kg'

    def test_str(self):
        user = make_user('pr2@x.com')
        rec = ProductionRecord.objects.create(user=user, crop='Cassava')
        assert 'Cassava' in str(rec)

    def test_optional_date_fields(self):
        user = make_user('pr3@x.com')
        rec = ProductionRecord.objects.create(user=user, crop='Potato')
        assert rec.planting_date is None
        assert rec.harvest_date is None


# ===========================================================================
# LoanApplication
# ===========================================================================

@pytest.mark.django_db
class TestLoanApplication:
    def test_create_with_defaults(self):
        user = make_user('la@x.com')
        app = make_application(user)
        assert app.pk is not None
        assert app.status == 'pending'

    def test_str(self):
        user = make_user('la2@x.com')
        app = make_application(user)
        assert str(app) == f'Loan #{app.id} (la2@x.com)'

    def test_ai_fields_default_null(self):
        user = make_user('la3@x.com')
        app = make_application(user)
        assert app.eligibility_approved is None
        assert app.risk_score is None
        assert app.recommended_amount is None

    def test_status_default_pending(self):
        user = make_user('la4@x.com')
        app = make_application(user)
        assert app.status == 'pending'

    def test_update_status(self):
        user = make_user('la5@x.com')
        app = make_application(user)
        app.status = 'approved'
        app.save()
        app.refresh_from_db()
        assert app.status == 'approved'

    def test_set_ai_outputs(self):
        user = make_user('la6@x.com')
        app = make_application(user)
        app.eligibility_approved = True
        app.risk_score = 0.35
        app.recommended_amount = 800_000
        app.save()
        app.refresh_from_db()
        assert app.eligibility_approved is True
        assert app.risk_score == pytest.approx(0.35)

    def test_multiple_applications_per_user(self):
        user = make_user('la7@x.com')
        make_application(user)
        make_application(user)
        assert user.loan_applications.count() == 2

    def test_cascade_delete_with_user(self):
        user = make_user('la8@x.com')
        app = make_application(user)
        pk = app.pk
        user.delete()
        assert not LoanApplication.objects.filter(pk=pk).exists()

    def test_reviewed_by_set_null_on_user_delete(self):
        farmer = make_user('la9@x.com')
        reviewer = make_user('rev@x.com')
        app = make_application(farmer)
        app.reviewed_by = reviewer
        app.save()
        reviewer.delete()
        app.refresh_from_db()
        assert app.reviewed_by is None


# ===========================================================================
# ApplicationStatusUpdate
# ===========================================================================

@pytest.mark.django_db
class TestApplicationStatusUpdate:
    def test_create(self):
        user = make_user('asu@x.com')
        app = make_application(user)
        update = ApplicationStatusUpdate.objects.create(
            application=app, status='under_review', note='Received'
        )
        assert update.pk is not None

    def test_str(self):
        user = make_user('asu2@x.com')
        app = make_application(user)
        update = ApplicationStatusUpdate.objects.create(application=app, status='approved')
        assert f'#{app.id}' in str(update)
        assert 'approved' in str(update)

    def test_ordering_oldest_first(self):
        user = make_user('asu3@x.com')
        app = make_application(user)
        ApplicationStatusUpdate.objects.create(application=app, status='pending')
        ApplicationStatusUpdate.objects.create(application=app, status='approved')
        updates = list(app.status_updates.all())
        assert updates[0].status == 'pending'
        assert updates[1].status == 'approved'

    def test_cascade_delete_with_application(self):
        user = make_user('asu4@x.com')
        app = make_application(user)
        upd = ApplicationStatusUpdate.objects.create(application=app, status='pending')
        pk = upd.pk
        app.delete()
        assert not ApplicationStatusUpdate.objects.filter(pk=pk).exists()


# ===========================================================================
# LoanApplicationMessage
# ===========================================================================

@pytest.mark.django_db
class TestLoanApplicationMessage:
    def test_create(self):
        farmer = make_user('msg1@x.com')
        mfi = make_user('msg2@x.com')
        app = make_application(farmer)
        msg = LoanApplicationMessage.objects.create(
            application=app,
            sender=mfi,
            recipient=farmer,
            message='Please provide land certificate.',
        )
        assert msg.pk is not None

    def test_str(self):
        farmer = make_user('msg3@x.com')
        mfi = make_user('msg4@x.com')
        app = make_application(farmer)
        msg = LoanApplicationMessage.objects.create(
            application=app, sender=mfi, recipient=farmer, message='Hello'
        )
        assert f'#{app.id}' in str(msg)

    def test_message_max_length_respected(self):
        farmer = make_user('msg5@x.com')
        mfi = make_user('msg6@x.com')
        app = make_application(farmer)
        long_message = 'x' * 2000
        msg = LoanApplicationMessage.objects.create(
            application=app, sender=mfi, recipient=farmer, message=long_message
        )
        assert len(msg.message) == 2000


# ===========================================================================
# LoanApplicationDocument
# ===========================================================================

@pytest.mark.django_db
class TestLoanApplicationDocument:
    def test_create(self, tmp_path):
        user = make_user('doc@x.com')
        app = make_application(user)
        doc = LoanApplicationDocument.objects.create(
            application=app,
            document_type='national_id',
            file='loan_docs/2026/01/id.pdf',
        )
        assert doc.pk is not None

    def test_str_contains_document_type_display(self):
        user = make_user('doc2@x.com')
        app = make_application(user)
        doc = LoanApplicationDocument.objects.create(
            application=app,
            document_type='national_id',
            file='loan_docs/2026/01/id2.pdf',
        )
        assert 'National ID' in str(doc)

    def test_unique_together_document_type_per_application(self):
        user = make_user('doc3@x.com')
        app = make_application(user)
        LoanApplicationDocument.objects.create(
            application=app, document_type='national_id', file='a.pdf'
        )
        with pytest.raises(IntegrityError):
            LoanApplicationDocument.objects.create(
                application=app, document_type='national_id', file='b.pdf'
            )

    def test_different_types_allowed_on_same_application(self):
        user = make_user('doc4@x.com')
        app = make_application(user)
        LoanApplicationDocument.objects.create(
            application=app, document_type='national_id', file='id.pdf'
        )
        LoanApplicationDocument.objects.create(
            application=app, document_type='proof_of_income', file='income.pdf'
        )
        assert app.documents.count() == 2

    def test_cascade_delete_with_application(self):
        user = make_user('doc5@x.com')
        app = make_application(user)
        doc = LoanApplicationDocument.objects.create(
            application=app, document_type='national_id', file='id.pdf'
        )
        pk = doc.pk
        app.delete()
        assert not LoanApplicationDocument.objects.filter(pk=pk).exists()


# ===========================================================================
# Loan
# ===========================================================================

@pytest.mark.django_db
class TestLoan:
    def _make_loan(self, user=None):
        if user is None:
            user = make_user('loan@x.com')
        app = make_application(user)
        return Loan.objects.create(
            application=app,
            amount=1_000_000,
            duration_months=12,
            monthly_payment=88_000,
        )

    def test_create(self):
        loan = self._make_loan()
        assert loan.pk is not None
        assert loan.interest_rate == pytest.approx(0.12)

    def test_str(self):
        loan = self._make_loan(make_user('loan2@x.com'))
        assert '1000000' in str(loan)

    def test_default_interest_rate(self):
        loan = self._make_loan(make_user('loan3@x.com'))
        assert loan.interest_rate == pytest.approx(0.12)

    def test_one_to_one_application(self):
        user = make_user('loan4@x.com')
        app = make_application(user)
        loan = Loan.objects.create(application=app, amount=500_000, duration_months=6)
        assert app.approved_loan == loan

    def test_cascade_delete_with_application(self):
        user = make_user('loan5@x.com')
        loan = self._make_loan(user)
        pk = loan.pk
        loan.application.delete()
        assert not Loan.objects.filter(pk=pk).exists()


# ===========================================================================
# Repayment
# ===========================================================================

@pytest.mark.django_db
class TestRepayment:
    def _make_repayment(self, due_date=None):
        user = make_user(f'rep{timezone.now().timestamp()}@x.com')
        app = make_application(user)
        loan = Loan.objects.create(application=app, amount=600_000, duration_months=6)
        due = due_date or datetime.date.today() + datetime.timedelta(days=30)
        return Repayment.objects.create(loan=loan, amount=100_000, due_date=due)

    def test_create(self):
        rep = self._make_repayment()
        assert rep.pk is not None
        assert rep.status == 'pending'
        assert rep.paid_at is None

    def test_str(self):
        rep = self._make_repayment()
        assert '100000' in str(rep)

    def test_mark_paid(self):
        rep = self._make_repayment()
        rep.status = 'paid'
        rep.paid_at = timezone.now()
        rep.save()
        rep.refresh_from_db()
        assert rep.status == 'paid'
        assert rep.paid_at is not None

    def test_ordered_by_due_date(self):
        user = make_user('rep_ord@x.com')
        app = make_application(user)
        loan = Loan.objects.create(application=app, amount=600_000, duration_months=6)
        today = datetime.date.today()
        r2 = Repayment.objects.create(loan=loan, amount=100_000, due_date=today + datetime.timedelta(days=60))
        r1 = Repayment.objects.create(loan=loan, amount=100_000, due_date=today + datetime.timedelta(days=30))
        repayments = list(loan.repayments.all())
        assert repayments[0].pk == r1.pk
        assert repayments[1].pk == r2.pk

    def test_cascade_delete_with_loan(self):
        rep = self._make_repayment()
        pk = rep.pk
        rep.loan.delete()
        assert not Repayment.objects.filter(pk=pk).exists()


# ===========================================================================
# ChatInteraction
# ===========================================================================

@pytest.mark.django_db
class TestChatInteraction:
    def test_create_authenticated(self):
        user = make_user('chat@x.com')
        ci = ChatInteraction.objects.create(
            user=user,
            message='Am I eligible?',
            reply='Yes, you qualify.',
            language='en',
        )
        assert ci.pk is not None
        assert ci.language == 'en'

    def test_create_anonymous(self):
        ci = ChatInteraction.objects.create(
            user=None, message='Hello', reply='Hi', language='rw'
        )
        assert ci.user is None

    def test_str(self):
        ci = ChatInteraction.objects.create(message='test', reply='reply')
        assert str(ci) == f'Chat {ci.id}'

    def test_default_language_is_en(self):
        ci = ChatInteraction.objects.create(message='test', reply='reply')
        assert ci.language == 'en'

    def test_user_set_null_on_delete(self):
        user = make_user('chat2@x.com')
        ci = ChatInteraction.objects.create(
            user=user, message='test', reply='reply'
        )
        user.delete()
        ci.refresh_from_db()
        assert ci.user is None
