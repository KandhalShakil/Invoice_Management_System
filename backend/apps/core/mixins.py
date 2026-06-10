from rest_framework.decorators import action
from rest_framework.response import Response

class ValidationMixin:
    """
    Provides a lightweight /validate/ endpoint to verify data validity
    against the serializer without committing to the database.
    Useful for Smart Optimistic UI updates.
    """
    @action(detail=False, methods=['post'])
    def validate(self, request):
        instance = None
        if 'id' in request.data:
            try:
                instance = self.get_queryset().get(id=request.data['id'])
            except:
                pass
                
        serializer = self.get_serializer(instance, data=request.data, partial=True)
        if serializer.is_valid():
            return Response({"valid": True})
        return Response({"valid": False, "errors": serializer.errors}, status=400)
