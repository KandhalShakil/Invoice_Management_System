from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.notifications.views import (
    NotificationViewSet, EmailSettingViewSet, ReminderScheduleViewSet, EmailLogViewSet, EmailTemplatePreviewViewSet
)

router = DefaultRouter()
router.register(r'settings', EmailSettingViewSet, basename='email-settings')
router.register(r'reminders', ReminderScheduleViewSet, basename='email-reminders')
router.register(r'logs', EmailLogViewSet, basename='email-logs')
router.register(r'templates', EmailTemplatePreviewViewSet, basename='email-templates')
router.register(r'', NotificationViewSet, basename='notification')

urlpatterns = [
    path('', include(router.urls)),
]
