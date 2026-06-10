import csv
import io
import openpyxl
from decimal import Decimal
from datetime import datetime
from django.db.models import Sum, Count
from django.db.models.functions import TruncMonth
from django.http import HttpResponse, JsonResponse
from django.utils import timezone
from rest_framework import views, status, permissions
from apps.invoices.models import Invoice, InvoiceLineItem
from apps.customers.models import Customer
from apps.organizations.permissions import HasRolePermission

class DashboardStatsView(views.APIView):
    permission_classes = [permissions.IsAuthenticated, HasRolePermission]
    required_permissions = 'view_reports'

    def get(self, request):
        org_id = request.organization_id
        if not org_id:
            return Response({'error': 'Organization context is required.'}, status=status.HTTP_400_BAD_REQUEST)
            
        from django.core.cache import cache
        cache_key = f"dashboard_stats_{org_id}"
        cached_data = cache.get(cache_key)
        if cached_data:
            return JsonResponse(cached_data)
            
        # 1. Financial KPI aggregations
        # Scoped automatically to current tenant via TenantManager
        total_revenue = Invoice.objects.filter(status='paid').aggregate(Sum('total_amount'))['total_amount__sum'] or Decimal('0.00')
        
        # Monthly Revenue (current month)
        start_of_month = timezone.now().date().replace(day=1)
        monthly_revenue = Invoice.objects.filter(status='paid', issue_date__gte=start_of_month).aggregate(Sum('total_amount'))['total_amount__sum'] or Decimal('0.00')
        
        pending_revenue = Invoice.objects.filter(status__in=['sent', 'viewed', 'partially_paid']).aggregate(Sum('total_amount'))['total_amount__sum'] or Decimal('0.00')
        overdue_revenue = Invoice.objects.filter(status='overdue').aggregate(Sum('total_amount'))['total_amount__sum'] or Decimal('0.00')
        paid_revenue = total_revenue
        
        invoice_counts = Invoice.objects.values('status').annotate(count=Count('id'))
        customer_counts = Customer.objects.count()
        
        # 2. Charts Compiling
        # Revenue trend (last 6 months)
        six_months_ago = timezone.now().date() - timezone.timedelta(days=180)
        monthly_trend_query = Invoice.objects.filter(
            status='paid', 
            issue_date__gte=six_months_ago
        ).annotate(
            month=TruncMonth('issue_date')
        ).values('month').annotate(
            revenue=Sum('total_amount'),
            count=Count('id')
        ).order_by('month')
        
        revenue_trend = []
        for entry in monthly_trend_query:
            month_str = entry['month'].strftime('%b %Y') if entry['month'] else ''
            revenue_trend.append({
                'month': month_str,
                'revenue': float(entry['revenue'] or 0.0),
                'count': entry['count']
            })
            
        # Tax collection summary
        tax_summary_query = InvoiceLineItem.objects.filter(
            invoice__organization_id=org_id,
            invoice__status__in=['paid', 'sent', 'viewed']
        ).values('tax_rate').annotate(
            tax_collected=Sum('tax_amount'),
            taxable_amount=Sum('total_amount')
        ).order_by('-tax_rate')
        
        tax_summary = []
        for tax in tax_summary_query:
            tax_summary.append({
                'rate': float(tax['tax_rate']),
                'tax_collected': float(tax['tax_collected'] or 0.0),
                'taxable_amount': float(tax['taxable_amount'] or 0.0)
            })

        response_data = {
            'kpis': {
                'total_revenue': float(total_revenue),
                'monthly_revenue': float(monthly_revenue),
                'pending_revenue': float(pending_revenue),
                'overdue_revenue': float(overdue_revenue),
                'paid_revenue': float(paid_revenue),
                'customer_count': customer_counts
            },
            'invoice_counts': {item['status']: item['count'] for item in invoice_counts},
            'revenue_trend': revenue_trend,
            'tax_summary': tax_summary
        }
        cache.set(cache_key, response_data, 60 * 15)  # Cache for 15 minutes
        return JsonResponse(response_data)


class ReportsExportView(views.APIView):
    permission_classes = [permissions.IsAuthenticated, HasRolePermission]
    required_permissions = 'view_reports'

    def get(self, request):
        report_type = request.query_params.get('type', 'revenue') # revenue, tax, customer
        export_format = request.query_params.get('format', 'csv')  # csv, xlsx
        start_date_str = request.query_params.get('start_date')
        end_date_str = request.query_params.get('end_date')
        
        # Setup base queryset
        invoices = Invoice.objects.all().select_related('customer').order_by('-issue_date')
        if start_date_str:
            invoices = invoices.filter(issue_date__gte=start_date_str)
        if end_date_str:
            invoices = invoices.filter(issue_date__lte=end_date_str)

        # 1. Generate Revenue CSV Report
        if report_type == 'revenue':
            headers = ['Invoice Number', 'Customer Name', 'Issue Date', 'Due Date', 'Status', 'Subtotal', 'Tax Amount', 'Discount', 'Total Amount', 'Currency']
            rows = []
            for inv in invoices:
                rows.append([
                    inv.invoice_number,
                    inv.customer.contact_name,
                    str(inv.issue_date),
                    str(inv.due_date),
                    inv.get_status_display(),
                    float(inv.subtotal),
                    float(inv.tax_amount),
                    float(inv.discount_amount),
                    float(inv.total_amount),
                    inv.currency
                ])
                
        # 2. Generate Tax / GST Report
        elif report_type == 'tax':
            headers = ['HSN/SAC Code', 'Product/Service', 'Invoice Number', 'Tax Rate (%)', 'Taxable Value', 'CGST Amount', 'SGST Amount', 'IGST Amount', 'Total Tax']
            rows = []
            # Fetch individual line items for GST analysis
            line_items = InvoiceLineItem.objects.filter(invoice__in=invoices).select_related('product', 'invoice')
            for line in line_items:
                # GST Breakdown: Indian tax split (50% CGST, 50% SGST if inside state, or 100% IGST)
                # For simplified export we split standard tax 50-50 into CGST/SGST, and IGST for state-cross boundaries
                cgst = float(line.tax_amount) * 0.5
                sgst = float(line.tax_amount) * 0.5
                igst = 0.0 # simulated
                rows.append([
                    line.product.hsn_sac_code or 'N/A',
                    line.product.name,
                    line.invoice.invoice_number,
                    float(line.tax_rate),
                    float(line.total_amount - line.tax_amount),
                    cgst,
                    sgst,
                    igst,
                    float(line.tax_amount)
                ])
        else:
            return Response({'error': 'Invalid report type.'}, status=status.HTTP_400_BAD_REQUEST)

        # Build Response
        if export_format == 'csv':
            response = HttpResponse(content_type='text/csv')
            response['Content-Disposition'] = f'attachment; filename="report_{report_type}_{timezone.now().date()}.csv"'
            writer = csv.writer(response)
            writer.writerow(headers)
            writer.writerows(rows)
            return response
            
        elif export_format == 'xlsx':
            wb = openpyxl.Workbook()
            ws = wb.active
            ws.title = report_type.title()
            
            # Header Styling
            ws.append(headers)
            for row in rows:
                ws.append(row)
                
            # Stream to output
            output = io.BytesIO()
            wb.save(output)
            output.seek(0)
            
            response = HttpResponse(output.read(), content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
            response['Content-Disposition'] = f'attachment; filename="report_{report_type}_{timezone.now().date()}.xlsx"'
            return response

        return Response({'error': 'Invalid export format.'}, status=status.HTTP_400_BAD_REQUEST)
