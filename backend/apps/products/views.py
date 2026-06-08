from rest_framework import viewsets, permissions
from .models import Category, Product
from .serializers import CategorySerializer, ProductSerializer
from ..organizations.permissions import HasRolePermission

class CategoryViewSet(viewsets.ModelViewSet):
    serializer_class = CategorySerializer
    permission_classes = [permissions.IsAuthenticated, HasRolePermission]
    
    required_permissions = {
        'list': 'view_products',
        'retrieve': 'view_products',
        'create': 'manage_products',
        'update': 'manage_products',
        'partial_update': 'manage_products',
        'destroy': 'manage_prducts'
    }

    def get_queryset(self):
        return Category.objects.all()

    def perform_create(self, serializer):
        serializer.save(
            organization_id=self.request.organization_id,
            created_by=self.request.user
        )

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)


class ProductViewSet(viewsets.ModelViewSet):
    serializer_class = ProductSerializer
    permission_classes = [permissions.IsAuthenticated, HasRolePermission]
    
    required_permissions = {
        'list': 'view_products',
        'retrieve': 'view_products',
        'create': 'manage_products',
        'update': 'manage_products',
        'partial_update': 'manage_products',
        'destroy': 'manage_products'
    }

    def get_queryset(self):
        return Product.objects.all().select_related('category')

    def perform_create(self, serializer):
        serializer.save(
            organization_id=self.request.organization_id,
            created_by=self.request.user
        )

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)
