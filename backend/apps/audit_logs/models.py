from django.db import models
from django.conf import settings
from apps.core.models import TenantModel

class AuditLog(TenantModel):
    """
    Immutable ledger of system events, logins, modifications, and deletions.
    Enforces compliance and prevents unauthorized modifications.
    """
    # Raw manager that bypasses tenant filtering — used internally for audit log writes
    # so that signal handlers can always write logs regardless of tenant context.
    unscoped = models.Manager()

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='audit_logs'
    )
    action = models.CharField(max_length=50, help_text="e.g. create, update, delete, login, logout")
    entity_name = models.CharField(max_length=100, help_text="e.g. Customer, Invoice")
    entity_id = models.UUIDField(null=True, blank=True)
    
    previous_state = models.JSONField(default=dict, blank=True)
    new_state = models.JSONField(default=dict, blank=True)
    
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        user_str = self.user.email if self.user else "System"
        return f"{user_str} - {self.action} {self.entity_name} ({self.created_at})"

    def save(self, *args, **kwargs):
        # Enforce immutability: audit logs cannot be updated once saved!
        if self.pk:
            raise PermissionError("Audit log entries are immutable and cannot be updated.")
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        # Enforce immutability: audit logs cannot be deleted!
        raise PermissionError("Audit log entries are immutable and cannot be deleted.")

