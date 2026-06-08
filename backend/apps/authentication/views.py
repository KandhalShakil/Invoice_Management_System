import pyotp
import qrcode
import io
import base64
import logging
from rest_framework import status, views, permissions
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError
from django.contrib.auth import login, logout
from django.utils import timezone
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes, force_str
from django.contrib.auth.tokens import default_token_generator
from django.conf import settings
from apps.authentication.models import User, UserSession
from apps.authentication.serializers import (
    UserSerializer, UserRegisterSerializer, LoginSerializer,
    VerifyOTPSerializer, Toggle2FASerializer, UserSessionSerializer,
    PasswordResetRequestSerializer, PasswordResetConfirmSerializer, PasswordChangeSerializer
)

logger = logging.getLogger(__name__)

def get_tokens_for_user(user, request):
    """Generate refresh and access JWT tokens and track session."""
    refresh = RefreshToken.for_user(user)
    
    # Store session details in UserSession
    jti = refresh.get('jti')
    user_agent = request.META.get('HTTP_USER_AGENT', '')
    ip_address = request.META.get('REMOTE_ADDR', '')
    
    # Simple device name parsing from user agent
    device = "Web Browser"
    if "Mobile" in user_agent:
        device = "Mobile Device"
    elif "Postman" in user_agent:
        device = "Postman Client"
        
    UserSession.objects.create(
        user=user,
        token_jti=jti,
        ip_address=ip_address,
        user_agent=user_agent,
        device_name=device,
        last_active=timezone.now(),
        is_active=True
    )

    return {
        'refresh': str(refresh),
        'access': str(refresh.access_token),
    }


class UserRegisterView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = UserRegisterSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            
            role = serializer.validated_data.get('role')
            
            if role != 'owner':
                # --- Non-owner: in-app notification to owner only, NO email ---
                from apps.organizations.models import Organization
                from apps.notifications.models import Notification
                from channels.layers import get_channel_layer
                from asgiref.sync import async_to_sync
                
                org_name = serializer.validated_data.get('organization_name')
                org = Organization.objects.get(name__iexact=org_name)
                owner = org.created_by
                
                if owner:
                    notification = Notification.objects.create(
                        organization_id=org.id,
                        user=owner,
                        title="New Registration Request",
                        message=f"{user.first_name} {user.last_name} ({role.title()}) has requested to join {org.name}. Please review in Settings → Team."
                    )
                    
                    channel_layer = get_channel_layer()
                    if channel_layer:
                        try:
                            async_to_sync(channel_layer.group_send)(
                                f"user_{owner.id}",
                                {
                                    "type": "send_notification",
                                    "data": {
                                        "type": "new_notification",
                                        "id": str(notification.id),
                                        "title": notification.title,
                                        "message": notification.message,
                                        "created_at": notification.created_at.isoformat()
                                    }
                                }
                            )
                        except Exception:
                            pass  # Don't fail registration if WS push fails
                
                message = "Your registration request has been sent to the organization owner for approval."
            else:
                # --- Owner: mark verified, send welcome email ---
                user.is_verified = True
                user.save(update_fields=['is_verified'])
                
                from apps.notifications.tasks import send_transactional_email_task
                from apps.organizations.models import Organization
                org = Organization.objects.filter(created_by=user).first()
                
                try:
                    send_transactional_email_task.delay(
                        recipient=user.email,
                        subject="Welcome to Invoicely!",
                        template_name="welcome",
                        context_data={
                            "username": user.first_name or user.email.split('@')[0],
                            "login_url": f"{settings.FRONTEND_URL}/login",
                        },
                        organization_id=str(org.id) if org else None
                    )
                except Exception:
                    pass  # Email failure should not block registration
                
                message = "Your workspace has been created successfully. Welcome to Invoicely!"
            
            logger.info(f"User registered successfully: {user.email}")
            return Response({
                "message": message,
                "user": UserSerializer(user).data
            }, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)



class LoginView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            user = serializer.validated_data['user']
            
            # Multi-Step login verification: If 2FA enabled, stop and require OTP
            if user.two_factor_enabled:
                return Response({
                    'two_factor_required': True,
                    'user_id': user.id
                }, status=status.HTTP_200_OK)
            
            tokens = get_tokens_for_user(user, request)
            return Response({
                'tokens': tokens,
                'user': UserSerializer(user).data
            }, status=status.HTTP_200_OK)
            
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class VerifyOTPView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = VerifyOTPSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.validated_data['user']
            tokens = get_tokens_for_user(user, request)
            return Response({
                'tokens': tokens,
                'user': UserSerializer(user).data
            }, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class Generate2FASecretView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user
        if user.two_factor_enabled:
            return Response({'error': '2FA is already enabled.'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Generate random key if not already defined
        if not user.totp_secret:
            user.totp_secret = pyotp.random_base32()
            user.save(update_fields=['totp_secret'])
            
        # Create provisioning URI
        totp = pyotp.TOTP(user.totp_secret)
        provisioning_uri = totp.provisioning_uri(name=user.email, issuer_name="InvoiceManagerSaaS")
        
        # Draw QR code to bytes
        img = qrcode.make(provisioning_uri)
        buf = io.BytesIO()
        img.save(buf, format='PNG')
        qr_base64 = base64.b64encode(buf.getvalue()).decode('utf-8')
        
        return Response({
            'secret': user.totp_secret,
            'qr_code': f"data:image/png;base64,{qr_base64}"
        }, status=status.HTTP_200_OK)


class Toggle2FAView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = Toggle2FASerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            user = request.user
            enable = serializer.validated_data['enable']
            
            if enable:
                user.two_factor_enabled = True
                # Generate recovery codes
                recovery = [pyotp.random_base32()[:8].lower() for _ in range(5)]
                user.recovery_codes = recovery
                user.save(update_fields=['two_factor_enabled', 'recovery_codes'])
                return Response({
                    'message': 'Two-Factor Authentication enabled successfully.',
                    'recovery_codes': recovery
                }, status=status.HTTP_200_OK)
            else:
                user.two_factor_enabled = False
                user.totp_secret = None
                user.recovery_codes = []
                user.save(update_fields=['two_factor_enabled', 'totp_secret', 'recovery_codes'])
                return Response({'message': 'Two-Factor Authentication disabled successfully.'}, status=status.HTTP_200_OK)
                
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class UserSessionsView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        sessions = UserSession.objects.filter(user=request.user, is_active=True).order_by('-last_active')
        serializer = UserSessionSerializer(sessions, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class RevokeSessionView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        session_id = request.data.get('session_id')
        if not session_id:
            return Response({'error': 'session_id is required.'}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            session = UserSession.objects.get(id=session_id, user=request.user)
            session.is_active = False
            session.save(update_fields=['is_active'])
            
            # Blacklist the outstanding token associated with this session JTI
            try:
                from rest_framework_simplejwt.token_blacklist.models import OutstandingToken, BlacklistedToken
                outstanding = OutstandingToken.objects.get(jti=session.token_jti)
                BlacklistedToken.objects.get_or_create(token=outstanding)
            except Exception:
                # Token may have already expired from OutstandingToken table — that's fine
                pass
                
            return Response({'message': 'Session revoked successfully.'}, status=status.HTTP_200_OK)
        except UserSession.DoesNotExist:
            return Response({'error': 'Session not found.'}, status=status.HTTP_404_NOT_FOUND)


class UserMeView(views.APIView):
    """Returns the authenticated user's current profile from the database."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data, status=status.HTTP_200_OK)

    def patch(self, request):
        """Allow users to update their own first/last name."""
        allowed_fields = {'first_name', 'last_name'}
        update_data = {k: v for k, v in request.data.items() if k in allowed_fields}
        serializer = UserSerializer(request.user, data=update_data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class PasswordResetRequestView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        if serializer.is_valid():
            email = serializer.validated_data['email']
            user = User.objects.get(email=email, is_active=True)
            
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            token = default_token_generator.make_token(user)
            reset_url = f"{settings.FRONTEND_URL}/reset-password?uid={uid}&token={token}"
            
            from apps.notifications.tasks import send_transactional_email_task
            send_transactional_email_task.delay(
                recipient=user.email,
                subject="Reset Your Password - Invoicely",
                template_name="password_reset",
                context_data={
                    "reset_url": reset_url,
                    "request_timestamp": str(timezone.now().timestamp())
                }
            )
            
            logger.info(f"Password reset email queued for: {user.email}")
            return Response({
                "message": "Password reset link has been sent to your email address."
            }, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class PasswordResetConfirmView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        if serializer.is_valid():
            try:
                uid = force_str(urlsafe_base64_decode(serializer.validated_data['uidb64']))
                user = User.objects.get(pk=uid, is_active=True)
            except (TypeError, ValueError, OverflowError, User.DoesNotExist):
                return Response({"error": "Invalid password reset link."}, status=status.HTTP_400_BAD_REQUEST)
                
            if not default_token_generator.check_token(user, serializer.validated_data['token']):
                return Response({"error": "Expired or invalid token."}, status=status.HTTP_400_BAD_REQUEST)
                
            user.set_password(serializer.validated_data['new_password'])
            user.is_verified = True
            user.save()
            
            from apps.notifications.tasks import send_transactional_email_task
            send_transactional_email_task.delay(
                recipient=user.email,
                subject="Password Changed Alert - Invoicely",
                template_name="password_changed",
                context_data={
                    "username": user.first_name or user.email.split('@')[0],
                }
            )
            
            logger.info(f"Password reset confirm successful for user: {user.email}")
            return Response({
                "message": "Your password has been successfully reset. You can now login with your new password."
            }, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class PasswordChangeView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = PasswordChangeSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            user = request.user
            user.set_password(serializer.validated_data['new_password'])
            user.save()
            
            from apps.notifications.tasks import send_transactional_email_task
            send_transactional_email_task.delay(
                recipient=user.email,
                subject="Password Changed Alert - Invoicely",
                template_name="password_changed",
                context_data={
                    "username": user.first_name or user.email.split('@')[0],
                }
            )
            
            logger.info(f"Password change successful for user: {user.email}")
            return Response({
                "message": "Your password has been successfully changed."
            }, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class VerifyEmailView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        uidb64 = request.data.get('uid')
        token = request.data.get('token')
        
        if not uidb64 or not token:
            return Response({"error": "uid and token are required."}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            uid = force_str(urlsafe_base64_decode(uidb64))
            user = User.objects.get(pk=uid, is_active=True)
        except (TypeError, ValueError, OverflowError, User.DoesNotExist):
            return Response({"error": "Invalid verification link."}, status=status.HTTP_400_BAD_REQUEST)
            
        if not default_token_generator.check_token(user, token):
            return Response({"error": "Expired or invalid verification link."}, status=status.HTTP_400_BAD_REQUEST)
            
        if user.is_verified:
            return Response({"message": "Your email address is already verified. You can now login."}, status=status.HTTP_200_OK)
            
        user.is_verified = True
        user.save(update_fields=['is_verified'])
        
        # Send transactional verified confirmation email
        from apps.notifications.tasks import send_transactional_email_task
        send_transactional_email_task.delay(
            recipient=user.email,
            subject="Email Verified Successfully - Invoicely",
            template_name="verified",
            context_data={
                "username": user.first_name or user.email.split('@')[0],
                "login_url": f"{settings.FRONTEND_URL}/login"
            }
        )
        
        logger.info(f"Email verified successfully for user: {user.email}")
        return Response({
            "message": "Your email address has been successfully verified. You can now login."
        }, status=status.HTTP_200_OK)


class ResendVerificationEmailView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        email = request.data.get('email')
        if not email:
            return Response({"error": "Email field is required."}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            user = User.objects.get(email__iexact=email.strip(), is_active=True)
        except User.DoesNotExist:
            return Response({"error": "No account found with this email address."}, status=status.HTTP_400_BAD_REQUEST)
            
        if user.is_verified:
            return Response({"error": "This email address is already verified."}, status=status.HTTP_400_BAD_REQUEST)
            
        # Generate token & URL
        uid = urlsafe_base64_encode(force_bytes(user.pk))
        token = default_token_generator.make_token(user)
        verification_url = f"{settings.FRONTEND_URL}/verify-email?uid={uid}&token={token}"
        
        from apps.notifications.tasks import send_transactional_email_task
        send_transactional_email_task.delay(
            recipient=user.email,
            subject="Verify Your Email Address - Invoicely",
            template_name="verification",
            context_data={
                "verification_url": verification_url,
                "resend_timestamp": str(timezone.now().timestamp())
            }
        )
        
        logger.info(f"Verification email resent for user: {user.email}")
        return Response({
            "message": "Verification link has been sent to your email address."
        }, status=status.HTTP_200_OK)

