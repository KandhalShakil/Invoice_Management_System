from django.urls import path
from apps.ai.views import InvoiceOCRView, AISmartInvoiceDraftView

urlpatterns = [
    path('ocr/', InvoiceOCRView.as_view(), name='ai_ocr'),
    path('smart-draft/', AISmartInvoiceDraftView.as_view(), name='ai_smart_draft'),
]
