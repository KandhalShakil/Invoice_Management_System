from django.db import models
from apps.core.models import TenantModel

class Category(TenantModel):
    """
    Represents product/service categories.
    """
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)

    def __str__(self):
        return self.name


class Product(TenantModel):
    """
    Represents inventory products or billed services.
    """
    TYPE_CHOICES = (
        ('product', 'Product'),
        ('service', 'Service'),
    )

    category = models.ForeignKey(
        Category,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='products'
    )
    name = models.CharField(max_length=255)
    sku = models.CharField(max_length=100, help_text="Stock keeping unit or unique identifier")
    description = models.TextField(blank=True, null=True)
    price = models.DecimalField(max_digits=12, decimal_places=2)
    tax_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0.00, help_text="Tax percentage (e.g. 18.00 for 18% GST)")
    hsn_sac_code = models.CharField(max_length=50, blank=True, null=True, help_text="GST HSN code for products or SAC for services")
    
    is_active = models.BooleanField(default=True)
    type = models.CharField(max_length=10, choices=TYPE_CHOICES, default='product')
    inventory_count = models.IntegerField(default=0, help_text="Only applicable for physical products")

    class Meta:
        unique_together = ('organization', 'sku')

    def __str__(self):
        return f"{self.name} ({self.sku})"
