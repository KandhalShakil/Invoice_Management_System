from rest_framework import serializers
from .models import Category, Product

class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ('id', 'organization', 'name', 'description', 'created_at')
        read_only_fields = ('id', 'organization', 'created_at')


class ProductSerializer(serializers.ModelSerializer):
    category_name = serializers.ReadOnlyField(source='category.name')

    class Meta:
        model = Product
        fields = (
            'id', 'organization', 'category', 'category_name', 'name', 
            'sku', 'description', 'price', 'tax_rate', 'hsn_sac_code', 
            'is_active', 'type', 'inventory_count', 'created_at', 'updated_at'
        )
        read_only_fields = ('id', 'organization', 'sku', 'created_at', 'updated_at')

    def validate_name(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError("Item name is required.")
        # Check uniqueness in current organization tenant
        org_id = self.context['request'].organization_id
        queryset = Product.objects.filter(name__iexact=value.strip(), organization_id=org_id)
        if self.instance:
            queryset = queryset.exclude(pk=self.instance.pk)
        if queryset.exists():
            raise serializers.ValidationError("Item name already exists.")
        return value.strip()



    def validate_price(self, value):
        if value is None:
            raise serializers.ValidationError("Price is required.")
        if value <= 0:
            raise serializers.ValidationError("Price must be greater than zero.")
        return value

