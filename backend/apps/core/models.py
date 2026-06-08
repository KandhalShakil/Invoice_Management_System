import uuid
from django.db import models
from django.utils import timezone
from django.conf import settings
from apps.core.context import get_current_organization_id

class TenantQuerySet(models.QuerySet):
    def delete(self):
        """Perform soft delete on bulk query delete."""
        return self.update(deleted_at=timezone.now())

    def hard_delete(self):
        """Actually remove rows from database."""
        return super().delete()

    def active(self):
        """Return only active items."""
        return self.filter(deleted_at__isnull=True)

class TenantManager(models.Manager):
    def get_queryset(self):
        queryset = TenantQuerySet(self.model, using=self._db)
        
        # Automatically filter out soft-deleted objects by default
        queryset = queryset.active()
        
        # Automatically scope data based on the current tenant organization context
        org_id = get_current_organization_id()
        if org_id:
            # Check if this model has the organization relation
            if hasattr(self.model, 'organization'):
                queryset = queryset.filter(organization_id=org_id)
        
        return queryset

    def all_with_deleted(self):
        """Include soft deleted elements in query."""
        queryset = TenantQuerySet(self.model, using=self._db)
        org_id = get_current_organization_id()
        if org_id and hasattr(self.model, 'organization'):
            queryset = queryset.filter(organization_id=org_id)
        return queryset

    def global_all(self):
        """Ignore tenant context entirely (e.g. for superadmins/global actions)."""
        return TenantQuerySet(self.model, using=self._db).active()


class BaseModel(models.Model):
    """Base abstract model containing UUID, soft delete, and timestamps."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        abstract = True

    def delete(self, *args, **kwargs):
        """Soft delete the object."""
        self.deleted_at = timezone.now()
        self.save(update_fields=['deleted_at'])

    def hard_delete(self, *args, **kwargs):
        """Hard delete the object from DB."""
        super().delete(*args, **kwargs)

    def restore(self):
        """Restore a soft deleted object."""
        self.deleted_at = None
        self.save(update_fields=['deleted_at'])


class TenantModel(BaseModel):
    """Abstract model enforcing Organization tenant context and audit tracking fields."""
    organization = models.ForeignKey(
        'organizations.Organization',
        on_delete=models.CASCADE,
        related_name='%(class)ss'
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_%(class)ss'
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='updated_%(class)ss'
    )

    objects = TenantManager()

    class Meta:
        abstract = True
