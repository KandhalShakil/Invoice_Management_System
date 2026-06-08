from rest_framework import serializers
from apps.notifications.models import Notification, EmailSetting, EmailLog, ReminderSchedule

class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ('id', 'organization', 'user', 'title', 'message', 'is_read', 'created_at')
        read_only_fields = ('id', 'organization', 'user', 'title', 'message', 'created_at')


class EmailSettingSerializer(serializers.ModelSerializer):
    email_type_display = serializers.CharField(source='get_email_type_display', read_only=True)

    class Meta:
        model = EmailSetting
        fields = ('id', 'email_type', 'email_type_display', 'is_enabled', 'organization')
        read_only_fields = ('id', 'organization')


class EmailLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmailLog
        fields = ('id', 'recipient', 'subject', 'template_name', 'status', 'error_message', 'sent_at', 'idempotency_hash', 'organization')
        read_only_fields = fields


class ReminderScheduleSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReminderSchedule
        fields = ('id', 'days_before_due', 'overdue_interval_days', 'is_active', 'organization')
        read_only_fields = ('id', 'organization')
