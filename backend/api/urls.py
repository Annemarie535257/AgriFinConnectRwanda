from django.urls import path
from . import views

urlpatterns = [
    # Auth (admin is backend-created; login only for admin)
    path('auth/register/', views.auth_register),
    path('auth/verify-registration-otp/', views.auth_verify_registration_otp),
    path('auth/resend-registration-otp/', views.auth_resend_registration_otp),
    path('auth/login/', views.auth_login),
    path('auth/forgot-password/', views.auth_forgot_password),
    path('auth/reset-password/', views.auth_reset_password),
    path('fallback/sms/', views.fallback_sms),
    # Activity tracking (visitors) + Admin API
    path('activity/log/', views.activity_log),
    path('admin/activity/', views.admin_activity_list),
    path('admin/users/', views.admin_users_list),
    path('admin/stats/', views.admin_stats),
    path('admin/applications/', views.admin_applications_list),
    path('admin/applications/<int:application_id>/', views.admin_application_detail),
    path('admin/applications/<int:application_id>/status/', views.admin_update_application_status),
    # Farmer dashboard APIs
    path('farmer/profile/', views.farmer_profile),
    path('farmer/required-documents/', views.required_documents),
    path('farmer/applications/', views.farmer_applications),
    path('farmer/applications/<int:pk>/documents/', views.farmer_application_documents),
    path('farmer/applications/<int:pk>/package/', views.farmer_application_package),
    path('farmer/loans/', views.farmer_loans),
    path('farmer/repayments/', views.farmer_repayments),
    path('farmer/repayments/<int:pk>/mark-paid/', views.farmer_mark_repayment_paid),
    # MFI dashboard APIs
    path('mfi/applications/', views.mfi_applications),
    path('mfi/applications/<int:pk>/package/', views.mfi_application_package),
    path('mfi/applications/<int:pk>/update-status/', views.mfi_update_application_status),
    path('mfi/applications/<int:pk>/review/', views.mfi_review_application),
    path('mfi/applications/<int:pk>/messages/', views.mfi_send_application_message),
    path('mfi/applications/<int:pk>/analyze-statement/', views.analyze_application_statement),
    path('mfi/portfolio/', views.mfi_portfolio),
    path('mfi/repayments/<int:pk>/mark-paid/', views.mfi_mark_repayment_paid),
    # ML model APIs
    path('eligibility/', views.eligibility),
    path('risk/', views.risk),
    path('recommend-amount/', views.recommend_amount),
    path('fraud-detect/', views.fraud_detect),
    path('fraud-detect/statement/', views.analyze_bank_statement),
    path('chat/', views.chat),
]
