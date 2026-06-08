from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from apps.authentication.views import (
    UserRegisterView, LoginView, VerifyOTPView,
    Generate2FASecretView, Toggle2FAView, UserSessionsView, RevokeSessionView,
    UserMeView, PasswordResetRequestView, PasswordResetConfirmView, PasswordChangeView,
    VerifyEmailView, ResendVerificationEmailView
)

urlpatterns = [
    path('register/', UserRegisterView.as_view(), name='auth_register'),
    path('login/', LoginView.as_view(), name='auth_login'),
    path('verify-otp/', VerifyOTPView.as_view(), name='auth_verify_otp'),
    path('verify-email/', VerifyEmailView.as_view(), name='auth_verify_email'),
    path('resend-verification/', ResendVerificationEmailView.as_view(), name='auth_resend_verification'),
    path('2fa/setup/', Generate2FASecretView.as_view(), name='auth_2fa_setup'),
    path('2fa/toggle/', Toggle2FAView.as_view(), name='auth_2fa_toggle'),
    path('sessions/', UserSessionsView.as_view(), name='auth_sessions'),
    path('sessions/revoke/', RevokeSessionView.as_view(), name='auth_sessions_revoke'),
    path('token/refresh/', TokenRefreshView.as_view(), name='auth_token_refresh'),
    path('me/', UserMeView.as_view(), name='auth_me'),
    path('password/reset/', PasswordResetRequestView.as_view(), name='auth_password_reset_request'),
    path('password/reset/confirm/', PasswordResetConfirmView.as_view(), name='auth_password_reset_confirm'),
    path('password/change/', PasswordChangeView.as_view(), name='auth_password_change'),
]
