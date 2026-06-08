from django.utils.deprecation import MiddlewareMixin
from apps.audit_logs.context import set_audit_context, reset_audit_context

class AuditLogMiddleware(MiddlewareMixin):
    def process_request(self, request):
        user = request.user if hasattr(request, 'user') else None
        
        # Get IP Address
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0].strip()
        else:
            ip = request.META.get('REMOTE_ADDR', '')
            
        # Get User Agent
        ua = request.META.get('HTTP_USER_AGENT', '')
        
        # Set context variables for signals to access
        token = set_audit_context(user, ip, ua)
        request._audit_context_token = token
        return None

    def process_response(self, request, response):
        if hasattr(request, '_audit_context_token'):
            reset_audit_context(request._audit_context_token)
        return response
