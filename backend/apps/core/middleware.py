import uuid
from django.http import JsonResponse
from django.utils.deprecation import MiddlewareMixin
from apps.core.context import set_current_organization_id, reset_current_organization_id

class TenantMiddleware(MiddlewareMixin):
    def process_request(self, request):
        # 1. Look for organization ID in header
        org_id_header = request.headers.get('X-Tenant-ID')
        
        # 2. Skip validation for public endpoints
        path = request.path_info
        if (path.startswith('/api/v1/auth/') or 
            path.startswith('/admin/') or 
            path.startswith('/api/v1/schema/') or
            path.startswith('/static/') or 
            path.startswith('/media/')):
            request.organization_id = None
            return None

        # 3. If organization header is present, validate and bind
        if org_id_header:
            try:
                org_uuid = uuid.UUID(org_id_header)
            except ValueError:
                return JsonResponse({'error': 'Invalid X-Tenant-ID format. Must be UUID.'}, status=400)
            
            # Check user membership if authenticated
            if request.user and request.user.is_authenticated:
                # Bypass check for superuser
                if not request.user.is_superuser:
                    from apps.organizations.models import UserOrganizationMembership
                    exists = UserOrganizationMembership.objects.filter(
                        user=request.user,
                        organization_id=org_uuid
                    ).exists()
                    if not exists:
                        return JsonResponse({'error': 'Access Denied. You do not belong to this organization.'}, status=403)
            
            request.organization_id = org_uuid
            # Set context variable for model manager filtering
            token = set_current_organization_id(org_uuid)
            request._tenant_context_token = token
        else:
            # If no header, see if authenticated user has memberships
            if request.user and request.user.is_authenticated:
                from apps.organizations.models import UserOrganizationMembership
                memberships = UserOrganizationMembership.objects.filter(user=request.user)
                if memberships.count() == 1:
                    org_id = memberships.first().organization_id
                    request.organization_id = org_id
                    token = set_current_organization_id(org_id)
                    request._tenant_context_token = token
                else:
                    # Ambiguous tenant selection - client must supply header
                    request.organization_id = None
            else:
                request.organization_id = None
        
        return None

    def process_response(self, request, response):
        # Reset current tenant context after request processing
        if hasattr(request, '_tenant_context_token'):
            reset_current_organization_id(request._tenant_context_token)
        return response
