from rest_framework import permissions
from .models import UserOrganizationMembership

# Dynamic Permission Matrix
ROLE_PERMISSIONS = {
    'owner': {'*'},
    'admin': {
        'manage_users', 'manage_customers', 'manage_products',
        'create_invoice', 'update_invoice', 'delete_invoice', 'approve_invoice', 'send_invoice',
        'view_invoices', 'view_customers', 'view_products',
        'view_reports', 'manage_settings'
    },
    'manager': {
        'manage_customers', 'manage_products',
        'create_invoice', 'update_invoice', 'send_invoice',
        'view_invoices', 'view_customers', 'view_products',
        'view_reports'
    },
    'accountant': {
        'create_invoice', 'update_invoice', 'approve_invoice', 'send_invoice',
        'view_invoices', 'view_customers', 'view_products',
        'view_reports'
    },
    'employee': {
        'create_invoice', 'update_invoice',
        'view_invoices', 'view_products', 'view_customers'
    },
    'viewer': {
        'view_reports', 'view_invoices', 'view_customers', 'view_products'
    },
}

class HasRolePermission(permissions.BasePermission):
    """
    Checks user organization membership and verifies if their role
    has the permission required for the current action.
    """
    def has_permission(self, request, view):
        # 1. Require authentication
        if not request.user or not request.user.is_authenticated:
            return False
            
        # 2. Superusers bypass all permissions
        if request.user.is_superuser:
            return True
            
        # 3. Actions that do not require tenant context (list/create organizations)
        if view.__class__.__name__ == 'OrganizationViewSet' and view.action in ('list', 'create'):
            return True
            
        # 4. Resolve target organization ID for permission evaluation
        org_id = None
        if view.__class__.__name__ == 'OrganizationViewSet' and view.kwargs and 'pk' in view.kwargs:
            org_id = view.kwargs.get('pk')
        else:
            org_id = getattr(request, 'organization_id', None)
            
        if not org_id:
            return False
            
        # 5. Fetch user role in the current organization
        try:
            membership = UserOrganizationMembership.objects.get(
                user=request.user,
                organization_id=org_id
            )
            request.user_role = membership.role
        except UserOrganizationMembership.DoesNotExist:
            return False
            
        # 6. Check if action maps to any permission
        required_permission = self.get_required_permission(view)
        if not required_permission:
            return True  # If no permission is explicitly declared, grant access
            
        user_permissions = ROLE_PERMISSIONS.get(membership.role, set())
        
        # 'owner' has wild-card access
        if '*' in user_permissions:
            return True
            
        return required_permission in user_permissions

    def get_required_permission(self, view):
        """Resolves the permission string needed for the current DRF view action."""
        if hasattr(view, 'required_permissions'):
            # Check if there is a dictionary mapping action -> permission
            if isinstance(view.required_permissions, dict):
                return view.required_permissions.get(view.action)
            # Or a simple string
            elif isinstance(view.required_permissions, str):
                return view.required_permissions
        return None
