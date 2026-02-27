from django.urls import path
from . import views

urlpatterns = [
    # Auth (admin is backend-created; login only for admin)
    path('auth/register/', views.auth_register),
    path('auth/login/', views.auth_login),
    path('auth/forgot-password/', views.auth_forgot_password),
    path('auth/reset-password/', views.auth_reset_password),
    # Activity tracking (visitors) + Admin API
    path('activity/log/', views.activity_log),
    path('admin/activity/', views.admin_activity_list),
    path('admin/users/', views.admin_users_list),
    path('admin/stats/', views.admin_stats),
    # Farmer dashboard APIs
    path('farmer/profile/', views.farmer_profile),
    path('farmer/required-documents/', views.required_documents),
    path('farmer/applications/', views.farmer_applications),
    path('farmer/applications/<int:pk>/documents/', views.farmer_application_documents),
    path('farmer/applications/<int:pk>/package/', views.farmer_application_package),
    path('farmer/loans/', views.farmer_loans),
    path('farmer/repayments/', views.farmer_repayments),
    # MFI dashboard APIs
    path('mfi/applications/', views.mfi_applications),
    path('mfi/applications/<int:pk>/package/', views.mfi_application_package),
    path('mfi/applications/<int:pk>/update-status/', views.mfi_update_application_status),
    path('mfi/applications/<int:pk>/review/', views.mfi_review_application),
    path('mfi/portfolio/', views.mfi_portfolio),
    # ML model APIs
    path('eligibility/', views.eligibility),
    path('risk/', views.risk),
    path('recommend-amount/', views.recommend_amount),
    path('chat/', views.chat),
]
