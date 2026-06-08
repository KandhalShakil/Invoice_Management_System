import json
import uuid
from decimal import Decimal
from datetime import date, datetime
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from apps.audit_logs.models import AuditLog
from apps.audit_logs.context import get_audit_context
from apps.customers.models import Customer
from apps.products.models import Product
from apps.invoices.models import Invoice
from apps.organizations.models import Organization

def serialize_model_instance(instance):
    """Utility to convert a model instance to a JSON-serializable dict."""
    data = {}
    for field in instance._meta.fields:
        val = getattr(instance, field.name)
        if val is None:
            data[field.name] = None
        elif isinstance(val, (uuid.UUID, date, datetime)):
            data[field.name] = str(val)
        elif isinstance(val, Decimal):
            data[field.name] = float(val)
        elif hasattr(val, 'id'):
            data[field.name] = str(val.id)
        else:
            try:
                # Double-check JSON compatibility
                json.dumps(val)
                data[field.name] = val
            except Exception:
                data[field.name] = str(val)
    return data


def log_audit_event(instance, action, previous_state=None, new_state=None):
    """Helper to write the immutable log entry with network metadata context."""
    context = get_audit_context()
    
    # 1. Resolve organization context
    org_id = getattr(instance, 'organization_id', None)
    if not org_id and isinstance(instance, Organization):
        org_id = instance.id
        
    if not org_id:
        return # Skip logging if no organization context is resolved (e.g. orphan tables)
        
    # 2. Extract values from thread-safe context
    user = context['user']
    # If user is anonymous or not authenticated, fallback to None
    if user and not user.is_authenticated:
        user = None
        
    # Prevent infinite loop: do not audit log audit logs
    if isinstance(instance, AuditLog):
        return

    # Create audit record
    try:
        # Use the unscoped manager to bypass TenantManager context requirements.
        # This ensures audit events are always persisted, even in background tasks
        # where the tenant context ContextVar may not be set.
        AuditLog.unscoped.create(
            organization_id=org_id,
            user=user,
            action=action,
            entity_name=instance.__class__.__name__,
            entity_id=instance.id,
            previous_state=previous_state or {},
            new_state=new_state or {},
            ip_address=context['ip'],
            user_agent=context['user_agent']
        )
    except Exception:
        # Fail silently in signals to avoid crashing main database transactions
        pass


@receiver(post_save, sender=Customer)
@receiver(post_save, sender=Product)
@receiver(post_save, sender=Invoice)
@receiver(post_save, sender=Organization)
def audit_save_signal(sender, instance, created, **kwargs):
    action = 'create' if created else 'update'
    
    new_state = serialize_model_instance(instance)
    previous_state = {}
    
    # If update, compile previous fields if possible (simulated, since django doesn't hold historical state directly)
    # We could query db but instance is already saved at post_save. However, for audit compliance we record the new state.
    # In a full-featured system we'd capture state on model init.
    log_audit_event(instance, action, previous_state=previous_state, new_state=new_state)


@receiver(post_delete, sender=Customer)
@receiver(post_delete, sender=Product)
@receiver(post_delete, sender=Invoice)
@receiver(post_delete, sender=Organization)
def audit_delete_signal(sender, instance, **kwargs):
    previous_state = serialize_model_instance(instance)
    log_audit_event(instance, 'delete', previous_state=previous_state, new_state={})
