from rest_framework import viewsets, permissions
from apps.customers.models import Customer
from apps.customers.serializers import CustomerSerializer
from apps.organizations.permissions import HasRolePermission

class CustomerViewSet(viewsets.ModelViewSet):
    serializer_class = CustomerSerializer
    permission_classes = [permissions.IsAuthenticated, HasRolePermission]
    
    required_permissions = {
        'list': 'view_customers',
        'retrieve': 'view_customers',
        'create': 'manage_customers',
        'update': 'manage_customers',
        'partial_update': 'manage_customers',
        'destroy': 'manage_customers'
    }

    def get_queryset(self):
        # Automatically filtered by TenantManager based on current active organization context
        return Customer.objects.all()

    def perform_create(self, serializer):
        serializer.save(
            organization_id=self.request.organization_id,
            created_by=self.request.user
        )

    def perform_update(self, serializer):
        serializer.save(
            updated_by=self.request.user
        )
