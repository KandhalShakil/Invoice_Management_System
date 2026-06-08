from rest_framework import serializers
from apps.customers.models import Customer

class CustomerSerializer(serializers.ModelSerializer):
    class Meta:
         model = Customer
         fields = (
             'id', 'organization', 'contact_name', 
             'email', 'phone', 'billing_address', 
             'shipping_address', 'notes', 'tags', 'created_at', 'updated_at'
         )
         read_only_fields = ('id', 'organization', 'created_at', 'updated_at')

    def validate_contact_name(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError("Customer name is required.")
        return value.strip()

    def validate_email(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError("Email address is required.")
        # Check uniqueness in current organization tenant
        queryset = Customer.objects.filter(email__iexact=value.strip())
        if self.instance:
            queryset = queryset.exclude(pk=self.instance.pk)
        if queryset.exists():
            raise serializers.ValidationError("Customer email already exists.")
        return value.strip()

    def validate_phone(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError("Phone number is required.")
        cleaned_phone = value.strip()
        if len(cleaned_phone) != 10 or not cleaned_phone.isdigit():
            raise serializers.ValidationError("Phone number must contain exactly 10 digits.")
        # Check uniqueness in current organization tenant
        queryset = Customer.objects.filter(phone=cleaned_phone)
        if self.instance:
            queryset = queryset.exclude(pk=self.instance.pk)
        if queryset.exists():
            raise serializers.ValidationError("Phone number already exists.")
        return cleaned_phone

