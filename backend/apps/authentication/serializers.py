import pyotp
from rest_framework import serializers
from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from apps.authentication.models import User, UserSession

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'email', 'first_name', 'last_name', 'is_verified', 'two_factor_enabled')
        read_only_fields = ('id', 'is_verified', 'two_factor_enabled')


class UserRegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=True, validators=[validate_password])
    organization_name = serializers.CharField(write_only=True, required=True)
    role = serializers.ChoiceField(
        choices=['owner', 'admin', 'manager', 'accountant', 'employee', 'viewer'],
        write_only=True, 
        required=True
    )

    class Meta:
        model = User
        fields = ('email', 'password', 'first_name', 'last_name', 'organization_name', 'role')

    def validate_email(self, value):
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("A user with this email address already exists.")
        return value

    def validate(self, data):
        role = data.get('role')
        org_name = data.get('organization_name')
        
        if not org_name or not org_name.strip():
            raise serializers.ValidationError({"organization_name": "Organization name is required."})
            
        org_name = org_name.strip()
        data['organization_name'] = org_name
        
        from apps.organizations.models import Organization
        org_exists = Organization.objects.filter(name__iexact=org_name).exists()
        
        if role == 'owner':
            if org_exists:
                raise serializers.ValidationError({
                    "organization_name": "An organization with this name already exists. Please use a different organization name or join the existing organization."
                })
        else:
            if not org_exists:
                raise serializers.ValidationError({
                    "organization_name": "Organization not found. Please contact your organization owner or administrator."
                })
                
        return data


    def create(self, validated_data):
        org_name = validated_data.pop('organization_name')
        password = validated_data.pop('password')
        role = validated_data.pop('role')
        
        # Create User
        user = User.objects.create_user(
            email=validated_data['email'],
            password=password,
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', '')
        )
        
        from apps.organizations.models import Organization, UserOrganizationMembership
        
        if role == 'owner':
            # Create Organization
            org = Organization.objects.create(
                name=org_name,
                email=user.email,
                created_by=user
            )
            approval_status = 'approved'
        else:
            # Join Existing Organization
            org = Organization.objects.get(name__iexact=org_name)
            approval_status = 'pending'
            
        # Create Membership
        UserOrganizationMembership.objects.create(
            user=user,
            organization=org,
            role=role,
            approval_status=approval_status
        )
        
        return user


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate(self, data):
        email = data.get('email')
        password = data.get('password')
        
        if email and password:
            user = authenticate(request=self.context.get('request'), email=email, password=password)
            if not user:
                raise serializers.ValidationError("Incorrect email or password.")
            if not user.is_active:
                raise serializers.ValidationError("This user account is deactivated.")
            
            membership = user.memberships.first()
            if membership:
                if membership.approval_status == 'pending':
                    raise serializers.ValidationError("Your account is awaiting approval from your organization owner.")
                elif membership.approval_status == 'rejected':
                    raise serializers.ValidationError("Your registration request has been rejected by the organization owner.")
        else:
            raise serializers.ValidationError("Email and password fields are required.")
        
        data['user'] = user
        return data


class VerifyOTPSerializer(serializers.Serializer):
    user_id = serializers.UUIDField(required=True)
    otp_code = serializers.CharField(required=True)
    
    def validate(self, data):
        user_id = data.get('user_id')
        otp_code = data.get('otp_code')
        
        try:
            user = User.objects.get(id=user_id, is_active=True)
        except User.DoesNotExist:
            raise serializers.ValidationError("Invalid user session.")
        
        if not user.two_factor_enabled:
            raise serializers.ValidationError("Two-Factor Authentication is not enabled for this user.")
        
        # Verify code using TOTP secret
        totp = pyotp.TOTP(user.totp_secret)
        
        # Also check recovery codes
        if otp_code in user.recovery_codes:
            # Consume recovery code
            user.recovery_codes.remove(otp_code)
            user.save(update_fields=['recovery_codes'])
            data['user'] = user
            return data
            
        if not totp.verify(otp_code, valid_window=1):
            raise serializers.ValidationError("Invalid or expired 2FA code.")
            
        data['user'] = user
        return data


class Toggle2FASerializer(serializers.Serializer):
    otp_code = serializers.CharField(required=True)
    enable = serializers.BooleanField(required=True)

    def validate(self, data):
        user = self.context['request'].user
        otp_code = data.get('otp_code')
        enable = data.get('enable')
        
        if enable:
            if not user.totp_secret:
                raise serializers.ValidationError("No TOTP secret initialized. Generate QR code first.")
            
            totp = pyotp.TOTP(user.totp_secret)
            if not totp.verify(otp_code, valid_window=1):
                raise serializers.ValidationError("Invalid code verification failed.")
        else:
            if not user.two_factor_enabled:
                raise serializers.ValidationError("2FA is already disabled.")
                
            totp = pyotp.TOTP(user.totp_secret)
            if not totp.verify(otp_code, valid_window=1):
                raise serializers.ValidationError("Invalid verification code. Cannot disable 2FA.")
                
        return data


class UserSessionSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserSession
        fields = ('id', 'ip_address', 'user_agent', 'device_name', 'last_active', 'is_active')
        read_only_fields = fields


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()

    def validate_email(self, value):
        if not User.objects.filter(email=value, is_active=True).exists():
            raise serializers.ValidationError("No active user account found with this email.")
        return value


class PasswordResetConfirmSerializer(serializers.Serializer):
    uidb64 = serializers.CharField()
    token = serializers.CharField()
    new_password = serializers.CharField(write_only=True, validators=[validate_password])


class PasswordChangeSerializer(serializers.Serializer):
    old_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, validators=[validate_password])

    def validate_old_password(self, value):
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError("Incorrect current password.")
        return value
