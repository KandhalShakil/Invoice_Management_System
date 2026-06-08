from rest_framework import serializers

class OCRUploadSerializer(serializers.Serializer):
    file = serializers.FileField(required=True, help_text="Image or PDF of the physical invoice")


class AISmartDraftSerializer(serializers.Serializer):
    prompt = serializers.CharField(
        required=True, 
        help_text="Simple prompt, e.g. 'Consulting hours 10 hrs @ $150/hr with 10% tax rate'"
    )
    customer_id = serializers.UUIDField(required=True, help_text="Target customer for billing")
