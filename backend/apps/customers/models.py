from django.db import models
from apps.core.models import TenantModel
from apps.core.validators import phone_validator

class Customer(TenantModel):
    """
    Represents a Customer/Client of an Organization.
    Inherits from TenantModel for automatic query isolation.
    """
    contact_name = models.CharField(max_length=255, default='', db_index=True)
    email = models.EmailField(db_index=True)
    phone = models.CharField(max_length=10, validators=[phone_validator], default='0000000000', db_index=True)
    
    billing_address = models.JSONField(default=dict, blank=True)
    shipping_address = models.JSONField(default=dict, blank=True)
    
    notes = models.TextField(blank=True, null=True)
    tags = models.JSONField(default=list, blank=True)

    def __str__(self):
        return self.contact_name
