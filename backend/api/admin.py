from django.contrib import admin
from django.contrib.auth import get_user_model
from .models import (
    UserProfile,
    GetStartedEvent,
    FarmerProfile,
    AgriculturalRecord,
    LoanApplication,
    Loan,
    Repayment,
    ChatInteraction,
)

User = get_user_model()


@admin.register(GetStartedEvent)
class GetStartedEventAdmin(admin.ModelAdmin):
    list_display = ('event_type', 'role', 'ip_address', 'created_at')
    list_filter = ('event_type', 'role', 'created_at')
    search_fields = ('ip_address', 'user_agent')
    readonly_fields = ('event_type', 'role', 'ip_address', 'user_agent', 'created_at')
    date_hierarchy = 'created_at'


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'role')
    list_filter = ('role',)
    search_fields = ('user__username', 'user__email')

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('user')


@admin.register(FarmerProfile)
class FarmerProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'location', 'phone', 'cooperative_name')
    search_fields = ('user__username', 'location', 'cooperative_name')


@admin.register(AgriculturalRecord)
class AgriculturalRecordAdmin(admin.ModelAdmin):
    list_display = ('user', 'crop_type', 'land_size_hectares', 'season', 'created_at')
    list_filter = ('crop_type', 'season')


@admin.register(LoanApplication)
class LoanApplicationAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'loan_amount_requested', 'status', 'eligibility_approved', 'risk_score', 'created_at')
    list_filter = ('status', 'eligibility_approved')
    search_fields = ('user__username',)
    readonly_fields = ('eligibility_approved', 'eligibility_reason', 'risk_score', 'recommended_amount')


@admin.register(Loan)
class LoanAdmin(admin.ModelAdmin):
    list_display = ('id', 'application', 'amount', 'duration_months', 'monthly_payment', 'created_at')


@admin.register(Repayment)
class RepaymentAdmin(admin.ModelAdmin):
    list_display = ('loan', 'amount', 'due_date', 'status', 'paid_at')


@admin.register(ChatInteraction)
class ChatInteractionAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'language', 'created_at')
