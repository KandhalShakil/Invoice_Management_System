from rest_framework import serializers
from apps.audit_logs.models import AuditLog

class AuditLogSerializer(serializers.ModelSerializer):
    user_email = serializers.ReadOnlyField(source='user.email')

    class Meta:
        model = AuditLog
        fields = (
            'id', 'organization', 'user', 'user_email', 'action', 
            'entity_name', 'entity_id', 'previous_state', 'new_state', 
            'ip_address', 'user_agent', 'created_at'
        )
        read_only_fields = fields
