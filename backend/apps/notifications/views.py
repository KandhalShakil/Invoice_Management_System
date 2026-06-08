from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from apps.organizations.permissions import HasRolePermission
from apps.notifications.models import Notification, EmailSetting, EmailLog, ReminderSchedule
from apps.notifications.serializers import (
    NotificationSerializer, EmailSettingSerializer, EmailLogSerializer, ReminderScheduleSerializer
)
from apps.notifications.tasks import send_transactional_email_task
from django.template.loader import render_to_string
import logging

logger = logging.getLogger(__name__)

class NotificationViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # Return only notifications belonging to the logged-in user in the current active organization
        org_id = getattr(self.request, 'organization_id', None)
        if org_id:
            return Notification.objects.filter(
                user=self.request.user,
                organization_id=org_id
            ).order_by('-created_at')
        return Notification.objects.none()

    @action(detail=True, methods=['post'], url_path='read')
    def mark_as_read(self, request, pk=None):
        notification = self.get_object()
        notification.is_read = True
        notification.save(update_fields=['is_read'])
        return Response(NotificationSerializer(notification).data)

    @action(detail=False, methods=['post'], url_path='mark-all-read')
    def mark_all_read(self, request):
        org_id = getattr(self.request, 'organization_id', None)
        if not org_id:
            return Response({'error': 'X-Tenant-ID header is missing.'}, status=status.HTTP_400_BAD_REQUEST)
            
        Notification.objects.filter(
            user=self.request.user,
            organization_id=org_id,
            is_read=False
        ).update(is_read=True)
        
        return Response({'message': 'All notifications marked as read.'}, status=status.HTTP_200_OK)


class EmailSettingViewSet(viewsets.ModelViewSet):
    serializer_class = EmailSettingSerializer
    permission_classes = [permissions.IsAuthenticated, HasRolePermission]
    required_permissions = 'manage_settings'

    def get_queryset(self):
        org_id = getattr(self.request, 'organization_id', None)
        if not org_id:
            return EmailSetting.objects.none()
        
        # Dynamically initialize any missing settings for the organization
        for email_type, _ in EmailSetting.EMAIL_TYPES:
            EmailSetting.objects.global_all().get_or_create(
                organization_id=org_id,
                email_type=email_type,
                defaults={'is_enabled': True}
            )
        return EmailSetting.objects.filter(organization_id=org_id)

    def perform_create(self, serializer):
        org_id = getattr(self.request, 'organization_id', None)
        serializer.save(organization_id=org_id)


class ReminderScheduleViewSet(viewsets.ModelViewSet):
    serializer_class = ReminderScheduleSerializer
    permission_classes = [permissions.IsAuthenticated, HasRolePermission]
    required_permissions = 'manage_settings'

    def get_queryset(self):
        org_id = getattr(self.request, 'organization_id', None)
        if not org_id:
            return ReminderSchedule.objects.none()
        
        # Initialize default reminder schedule if not present
        if not ReminderSchedule.objects.filter(organization_id=org_id).exists():
            ReminderSchedule.objects.create(
                organization_id=org_id,
                days_before_due=7,
                overdue_interval_days=3,
                is_active=True
            )
        return ReminderSchedule.objects.filter(organization_id=org_id)

    def perform_create(self, serializer):
        org_id = getattr(self.request, 'organization_id', None)
        serializer.save(organization_id=org_id)


class EmailLogViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = EmailLogSerializer
    permission_classes = [permissions.IsAuthenticated, HasRolePermission]
    required_permissions = 'manage_settings'

    def get_queryset(self):
        org_id = getattr(self.request, 'organization_id', None)
        if not org_id:
            return EmailLog.objects.none()
        return EmailLog.objects.filter(organization_id=org_id).order_by('-created_at')

    @action(detail=True, methods=['post'], url_path='retry')
    def retry_email(self, request, pk=None):
        org_id = getattr(self.request, 'organization_id', None)
        try:
            log_record = EmailLog.objects.get(pk=pk, organization_id=org_id)
        except EmailLog.DoesNotExist:
            return Response({'error': 'Email log not found.'}, status=status.HTTP_404_NOT_FOUND)

        if log_record.status != 'failed':
            return Response({'error': 'Only failed emails can be retried.'}, status=status.HTTP_400_BAD_REQUEST)

        # Clear failed status/error
        log_record.status = 'pending'
        log_record.error_message = None
        log_record.save()

        # Trigger Celery task again with original context_data
        send_transactional_email_task.delay(
            recipient=log_record.recipient,
            subject=log_record.subject,
            template_name=log_record.template_name,
            context_data=log_record.context_data or {},
            organization_id=str(org_id)
        )

        return Response({'message': 'Email retry queued successfully.'}, status=status.HTTP_200_OK)


class EmailTemplatePreviewViewSet(viewsets.ViewSet):
    permission_classes = [permissions.IsAuthenticated, HasRolePermission]
    required_permissions = 'manage_settings'

    @action(detail=False, methods=['post'], url_path='preview')
    def preview_template(self, request):
        template_name = request.data.get('template_name')
        if not template_name:
            return Response({'error': 'template_name is required.'}, status=status.HTTP_400_BAD_REQUEST)

        # Generate sample context depending on template
        context = request.data.get('context', {})
        
        # Populate defaults for preview purposes
        context.setdefault('username', 'John Doe')
        context.setdefault('customer_name', 'Acme Corp')
        context.setdefault('org_name', 'Invoicely Enterprise')
        context.setdefault('invoice_number', 'INV-2026-000042')
        context.setdefault('issue_date', '2026-06-05')
        context.setdefault('due_date', '2026-07-05')
        context.setdefault('amount', '15000.00')
        context.setdefault('paid_amount', '15000.00')
        context.setdefault('remaining_balance', '0.00')
        context.setdefault('days_overdue', '5')
        context.setdefault('days_until_due', '10')
        context.setdefault('is_overdue', True)
        context.setdefault('role', 'Admin')
        context.setdefault('inviter_email', 'admin@invoicely.com')
        context.setdefault('name', 'Premium SaaS Subscription')
        context.setdefault('price', '9999.00')
        context.setdefault('sku', 'SAAS-PREM-01')
        context.setdefault('period', 'Weekly')
        context.setdefault('date_range', 'Last 7 Days (2026-05-30 to 2026-06-05)')
        context.setdefault('drafts_count', 3)
        context.setdefault('sent_count', 12)
        context.setdefault('paid_count', 8)
        context.setdefault('overdue_count', 2)
        context.setdefault('total_invoiced', '125000.00')
        context.setdefault('total_paid', '85000.00')
        context.setdefault('login_url', '#')
        context.setdefault('verification_url', '#')
        context.setdefault('reset_url', '#')
        context.setdefault('payment_url', '#')
        context.setdefault('portal_url', '#')
        context.setdefault('dashboard_url', '#')

        try:
            html_content = render_to_string(f"emails/{template_name}.html", context)
            return Response({'html': html_content}, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({'error': f"Failed rendering template: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)
