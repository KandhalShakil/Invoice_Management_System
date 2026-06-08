import logging
import base64
from celery import shared_task
from django.utils import timezone
from django.db import transaction
from django.conf import settings
from decimal import Decimal
from datetime import timedelta
from apps.core.context import set_current_organization_id
from apps.invoices.models import Invoice, InvoiceLineItem, RecurringInvoiceConfig
from apps.invoices.services import PDFInvoiceGenerator, EmailService
from apps.core.storage import FileStorageService
from apps.products.models import Product

logger = logging.getLogger(__name__)

@shared_task
def generate_recurring_invoices():
    """
    Automated Celery worker cron job running daily to compile recurring invoices.
    """
    today = timezone.now().date()
    configs = RecurringInvoiceConfig.objects.global_all().filter(
        is_active=True,
        next_generation_date__lte=today
    )
    
    logger.info(f"Starting recurring invoice runs. Found {configs.count()} configurations to process.")
    
    for config in configs:
        try:
            # Set Tenant context variables for proper isolation in save hooks
            set_current_organization_id(config.organization_id)
            
            with transaction.atomic():
                template = config.template_data
                
                # Create Invoice
                invoice = Invoice.objects.create(
                    organization=config.organization,
                    customer=config.customer,
                    status='draft', # Draft first
                    issue_date=today,
                    due_date=today + timedelta(days=template.get('payment_terms_days', 30)),
                    discount_amount=Decimal(str(template.get('discount_amount', 0.00))),
                    currency=template.get('currency', 'USD'),
                    terms=template.get('terms', ''),
                    notes=template.get('notes', '')
                )
                
                # Create lines
                subtotal = Decimal('0.00')
                tax_amount = Decimal('0.00')
                
                for item in template.get('line_items', []):
                    prod = Product.objects.global_all().get(id=item['product_id'])
                    qty = Decimal(str(item.get('quantity', 1.0)))
                    price = Decimal(str(item.get('unit_price', prod.price)))
                    tax_rate = Decimal(str(item.get('tax_rate', prod.tax_rate)))
                    
                    line_subtotal = qty * price
                    line_tax = line_subtotal * (tax_rate / Decimal('100.00'))
                    line_total = line_subtotal + line_tax
                    
                    subtotal += line_subtotal
                    tax_amount += line_tax
                    
                    InvoiceLineItem.objects.create(
                        invoice=invoice,
                        product=prod,
                        description=item.get('description', prod.description),
                        quantity=qty,
                        unit_price=price,
                        tax_rate=tax_rate,
                        tax_amount=line_tax,
                        total_amount=line_total
                    )
                    
                invoice.subtotal = subtotal
                invoice.tax_amount = tax_amount
                invoice.total_amount = max(subtotal + tax_amount - invoice.discount_amount, Decimal('0.00'))
                invoice.save(update_fields=['subtotal', 'tax_amount', 'total_amount'])
                
                # Advance next date
                if config.schedule_type == 'daily':
                    config.next_generation_date = today + timedelta(days=1)
                elif config.schedule_type == 'weekly':
                    config.next_generation_date = today + timedelta(weeks=1)
                elif config.schedule_type == 'monthly':
                    config.next_generation_date = today + timedelta(days=30)
                elif config.schedule_type == 'quarterly':
                    config.next_generation_date = today + timedelta(days=90)
                elif config.schedule_type == 'yearly':
                    config.next_generation_date = today + timedelta(days=365)
                    
                config.save()
                
            # Queue PDF construction and email dispatch
            send_invoice_email_task.delay(str(invoice.id))
            
        except Exception as e:
            logger.error(f"Failed to generate recurring invoice for config {config.id}: {str(e)}", exc_info=True)


@shared_task
def send_invoice_email_task(invoice_id):
    """
    Renders PDF, uploads to storage, and emails copy to client.
    """
    try:
        invoice = Invoice.objects.global_all().get(id=invoice_id)
        set_current_organization_id(invoice.organization_id)
        
        # 1. Draw PDF
        pdf_buffer = PDFInvoiceGenerator.generate_pdf(invoice)
        
        # 2. Upload PDF
        filename = f"invoice_{invoice.invoice_number.replace('-', '_')}.pdf"
        pdf_url = FileStorageService.upload_file(pdf_buffer, f"org_{invoice.organization_id}/invoices", filename)
        
        invoice.pdf_url = pdf_url
        # If invoice was draft from recurring schedule, promote to 'sent'
        if invoice.status == 'draft':
            invoice.status = 'sent'
        invoice.save(update_fields=['pdf_url', 'status'])
        
        # 3. Disseminate Email via Transactional Task
        subject = f"Invoice {invoice.invoice_number} from {invoice.organization.name}"
        
        pdf_buffer.seek(0)
        pdf_base64 = base64.b64encode(pdf_buffer.read()).decode('utf-8')
        
        context = {
            'org_name': invoice.organization.name,
            'customer_name': invoice.customer.contact_name,
            'invoice_number': invoice.invoice_number,
            'issue_date': str(invoice.issue_date),
            'due_date': str(invoice.due_date),
            'amount': f"{invoice.total_amount:.2f}",
            'payment_url': f"{settings.FRONTEND_URL}/portal/invoices/{invoice.id}",
            'upi_id': f"billing@{invoice.organization.name.lower().replace(' ', '')}.com",
        }
        
        from apps.notifications.tasks import send_transactional_email_task
        send_transactional_email_task.delay(
            recipient=invoice.customer.email,
            subject=subject,
            template_name="invoice_sent",
            context_data=context,
            organization_id=str(invoice.organization_id),
            attachment_base64=pdf_base64,
            attachment_filename=filename
        )
        
    except Invoice.DoesNotExist:
        logger.error(f"Invoice {invoice_id} not found.")
    except Exception as e:
        logger.error(f"Error in send_invoice_email_task for invoice {invoice_id}: {str(e)}", exc_info=True)


@shared_task
def check_overdue_invoices():
    """
    Daily job finding unpaid invoices beyond due date and flagging as Overdue.
    """
    today = timezone.now().date()
    unpaid_statuses = ['sent', 'viewed', 'partially_paid']
    
    invoices = Invoice.objects.global_all().filter(
        status__in=unpaid_statuses,
        due_date__lt=today
    )
    
    logger.info(f"Checking for overdue invoices. Found {invoices.count()} candidates.")
    
    for inv in invoices:
        try:
            set_current_organization_id(inv.organization_id)
            inv.status = 'overdue'
            inv.save(update_fields=['status'])
            
            # Send Notification email reminder
            subject = f"Overdue Payment Reminder: Invoice {inv.invoice_number}"
            body = f"Hello. Invoice {inv.invoice_number} is overdue. Total: {inv.currency} {inv.total_amount}. Please pay ASAP."
            EmailService.send_transactional_email(inv.customer.email, subject, f"<html><body>{body}</body></html>")
            
        except Exception as e:
            logger.error(f"Error updating overdue invoice {inv.id}: {str(e)}")
