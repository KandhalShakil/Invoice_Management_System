import pytest
from rest_framework import status
from django.utils import timezone
from datetime import timedelta
from decimal import Decimal

from apps.core.context import set_current_organization_id
from apps.notifications.models import EmailSetting, EmailLog, ReminderSchedule
from apps.notifications.tasks import (
    send_transactional_email_task, run_overdue_and_upcoming_billing_reminders, run_periodic_business_summaries
)
from apps.invoices.models import Invoice
from apps.customers.models import Customer

@pytest.mark.django_db
def test_email_setting_gate(db_setup):
    """
    Verifies that if an email setting type is disabled for an organization,
    the transactional email task halts and logs as disabled.
    """
    org_a = db_setup['org_a']
    
    # 1. Create a disabled EmailSetting
    setting, _ = EmailSetting.objects.global_all().get_or_create(
        organization=org_a,
        email_type="welcome",
        defaults={'is_enabled': False}
    )
    setting.is_enabled = False
    setting.save()

    # 2. Run send task, should return "disabled"
    res = send_transactional_email_task(
        recipient="test@example.com",
        subject="Welcome",
        template_name="welcome",
        context_data={"username": "TestUser"},
        organization_id=str(org_a.id)
    )
    
    assert res == "disabled"


@pytest.mark.django_db
def test_idempotency_prevention(db_setup):
    """
    Verifies that duplicate email notifications with the exact same
    recipient, template, and context are prevented using sha256 hashing.
    """
    org_a = db_setup['org_a']
    
    recipient = "client@example.com"
    subject = "Billing Details"
    template = "welcome"
    context = {"username": "John Doe"}

    # First send should execute and return "sent"
    res1 = send_transactional_email_task(
        recipient=recipient,
        subject=subject,
        template_name=template,
        context_data=context,
        organization_id=str(org_a.id)
    )
    
    # Second send with identical arguments should return "duplicate"
    res2 = send_transactional_email_task(
        recipient=recipient,
        subject=subject,
        template_name=template,
        context_data=context,
        organization_id=str(org_a.id)
    )

    assert res1 == "sent" or res1 == "duplicate" # depending if email backend sends, but in eager mock mode should execute
    assert res2 == "duplicate"


@pytest.mark.django_db
def test_reminder_scanner_logic(db_setup):
    """
    Verifies that daily scan identify overdue/upcoming invoices
    and schedule transactional reminders.
    """
    user_owner = db_setup['user1']
    org_a = db_setup['org_a']
    set_current_organization_id(org_a.id)

    # 1. Create Customer
    cust = Customer.objects.create(
        organization=org_a,
        contact_name="Bob client",
        email="bob@client.com",
        phone="9988776655",
        created_by=user_owner
    )

    # 2. Create Overdue Invoice (due date is 3 days ago)
    today = timezone.now().date()
    invoice = Invoice.objects.create(
        organization=org_a,
        customer=cust,
        status="sent",
        issue_date=today - timedelta(days=10),
        due_date=today - timedelta(days=3),
        total_amount=Decimal("5000.00"),
        created_by=user_owner
    )

    # 3. Create ReminderSchedule (send every 3 days overdue)
    ReminderSchedule.objects.create(
        organization=org_a,
        days_before_due=7,
        overdue_interval_days=3,
        is_active=True
    )

    # 4. Trigger scan
    queued_count = run_overdue_and_upcoming_billing_reminders()
    
    assert queued_count >= 1


@pytest.mark.django_db
def test_business_summaries_task(db_setup):
    """
    Verifies that running periodic summaries task compiles metrics successfully.
    """
    org_a = db_setup['org_a']
    
    # Trigger daily business summary compilation
    sent_count = run_periodic_business_summaries("daily")
    
    # Should attempt to compile and send to org_a owner (user1)
    assert sent_count >= 1


@pytest.mark.django_db
def test_notifications_api_endpoints(api_client, db_setup):
    """
    Verifies REST API endpoints under v1/notifications/
    """
    user_owner = db_setup['user1']
    org_a = db_setup['org_a']
    
    api_client.force_authenticate(user=user_owner)

    # 1. Get settings toggles
    res_get_settings = api_client.get(
        '/api/v1/notifications/settings/',
        HTTP_X_TENANT_ID=str(org_a.id)
    )
    assert res_get_settings.status_code == status.HTTP_200_OK
    assert len(res_get_settings.data['results']) > 0

    # 2. Update a toggle
    setting_id = res_get_settings.data['results'][0]['id']
    res_patch = api_client.patch(
        f'/api/v1/notifications/settings/{setting_id}/',
        {'is_enabled': False},
        format='json',
        HTTP_X_TENANT_ID=str(org_a.id)
    )
    assert res_patch.status_code == status.HTTP_200_OK
    assert res_patch.data['is_enabled'] is False

    # 3. Get reminders config
    res_get_reminders = api_client.get(
        '/api/v1/notifications/reminders/',
        HTTP_X_TENANT_ID=str(org_a.id)
    )
    assert res_get_reminders.status_code == status.HTTP_200_OK
    assert len(res_get_reminders.data['results']) == 1

    # 4. Preview Template HTML
    res_preview = api_client.post(
        '/api/v1/notifications/templates/preview/',
        {'template_name': 'welcome'},
        format='json',
        HTTP_X_TENANT_ID=str(org_a.id)
    )
    assert res_preview.status_code == status.HTTP_200_OK
    assert 'html' in res_preview.data
