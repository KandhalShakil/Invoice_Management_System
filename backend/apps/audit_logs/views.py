from rest_framework import viewsets, permissions
from apps.audit_logs.models import AuditLog
from apps.audit_logs.serializers import AuditLogSerializer
from apps.organizations.permissions import HasRolePermission

class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = AuditLogSerializer
    permission_classes = [permissions.IsAuthenticated, HasRolePermission]
    
    # Audit trail reading is restricted to roles with 'view_reports' permissions
    required_permissions = {
        'list': 'view_reports',
        'retrieve': 'view_reports'
    }

    def get_queryset(self):
        # Scoped automatically to organization context by TenantManager
        queryset = AuditLog.objects.all().order_by('-created_at')
        
        # Simple Filter Queries
        entity_name = self.request.query_params.get('entity_name')
        if entity_name:
            queryset = queryset.filter(entity_name=entity_name)
            
        entity_id = self.request.query_params.get('entity_id')
        if entity_id:
            queryset = queryset.filter(entity_id=entity_id)
            
        action_param = self.request.query_params.get('action')
        if action_param:
            queryset = queryset.filter(action=action_param)
            
        return queryset
