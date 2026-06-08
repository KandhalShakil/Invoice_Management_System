import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from urllib.parse import parse_qs
from apps.organizations.models import UserOrganizationMembership

class NotificationConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.user = self.scope.get('user')
        
        # 1. Require JWT authentication
        if not self.user or not self.user.is_authenticated:
            await self.close(code=4003)
            return

        # 2. Extract tenant ID from query string
        query_string = self.scope.get('query_string', b'').decode('utf-8')
        query_params = parse_qs(query_string)
        tenant_id_list = query_params.get('tenant_id', [])
        
        if not tenant_id_list:
            await self.close(code=4000) # Bad Request
            return
            
        self.tenant_id = tenant_id_list[0]
        
        # 3. Verify user membership in tenant
        has_membership = await self.verify_membership(self.user, self.tenant_id)
        if not has_membership:
            await self.close(code=4003) # Forbidden
            return
            
        # 4. Bind connection to room channels
        self.org_group_name = f"org_{self.tenant_id}"
        self.user_group_name = f"user_{self.user.id}"
        
        await self.channel_layer.group_add(self.org_group_name, self.channel_name)
        await self.channel_layer.group_add(self.user_group_name, self.channel_name)
        
        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, 'org_group_name'):
            await self.channel_layer.group_discard(self.org_group_name, self.channel_name)
        if hasattr(self, 'user_group_name'):
            await self.channel_layer.group_discard(self.user_group_name, self.channel_name)

    async def receive(self, text_data):
        # We can handle ping/pong heartbeats here
        try:
            data = json.loads(text_data)
            if data.get('type') == 'ping':
                await self.send(text_data=json.dumps({'type': 'pong'}))
        except Exception:
            pass

    # Custom helper event handler
    async def send_notification(self, event):
        """Called when a message is broadcasted to the group."""
        await self.send(text_data=json.dumps(event['data']))

    @database_sync_to_async
    def verify_membership(self, user, tenant_id):
        # Bypass for admin superusers
        if user.is_superuser:
            return True
        return UserOrganizationMembership.objects.filter(
            user=user,
            organization_id=tenant_id
        ).exists()
