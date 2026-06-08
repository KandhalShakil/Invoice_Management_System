from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.invoices.views import InvoiceViewSet, RecurringInvoiceConfigViewSet
from apps.invoices.reports_views import DashboardStatsView, ReportsExportView

router = DefaultRouter()
router.register(r'recurring', RecurringInvoiceConfigViewSet, basename='recurring_invoice')
router.register(r'', InvoiceViewSet, basename='invoice')

urlpatterns = [
    path('dashboard/', DashboardStatsView.as_view(), name='dashboard_stats'),
    path('reports/', ReportsExportView.as_view(), name='reports_export'),
    path('', include(router.urls)),
]
