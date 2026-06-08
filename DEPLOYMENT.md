# Production Deployment Guide: Invoice Management System

This document outlines the step-by-step procedure to deploy the multi-tenant SaaS Invoice Management System into development, staging, or production environments.

---

## 1. Environment Variables Configuration

Create a `.env` file in the `backend/` directory with the following variables:

```ini
# Django settings
DJANGO_SECRET_KEY=production-secure-random-hash-2026-saas-key
DJANGO_DEBUG=False
ALLOWED_HOSTS=api.yourdomain.com,localhost

# PostgreSQL settings
POSTGRES_DB=invoice_manager
POSTGRES_USER=saas_admin
POSTGRES_PASSWORD=SecureProductionPasswordChangeMe2026
POSTGRES_HOST=db
POSTGRES_PORT=5432

# Redis and Channels
REDIS_URL=redis://redis:6379/0

# AWS S3 Storage credentials (optional fallback to local disk if omitted)
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtlFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
AWS_STORAGE_BUCKET_NAME=saas-invoice-documents-bucket
AWS_S3_REGION_NAME=ap-south-1

# Brevo (Sendinblue) SMTP / API Integration
BREVO_API_KEY=xkeysib-your-long-api-key-hash
BREVO_SENDER_EMAIL=billing@yourcompany.com
BREVO_SENDER_NAME=Acme Corporate Invoicing
```

---

## 2. Docker Compose Orchestration

For quick setup inside a single VPS (like AWS EC2), run the following commands:

### Build and Start Containers
```bash
docker-compose up --build -d
```
This builds and boots:
1. `db`: PostgreSQL 15 database instance with persistent volumes.
2. `redis`: Redis server caching key cycles and Channels.
3. `web`: ASGI Daphne gateway server on port `8000`.
4. `celery_worker`: Background worker tasks processing mail queues and compile PDFs.
5. `celery_beat`: Daily scheduler managing recurring invoices.

---

## 3. Database Migration and Seeding

Once the containers are running, execute database migrations and seed default values:

```bash
# Apply Django migrations
docker-compose exec web python manage.py migrate

# Load default admin, organization workspace, catalog items, and mock invoices
docker-compose exec web python seed_data.py
```
*Default login credentials: `admin@invoicemanager.com` / `AdminPassword123!`.*

---

## 4. Reverse Proxy Setup (Nginx + SSL)

Install Nginx on your host machine to route incoming ports:

Copy `nginx/default.conf` configuration template to `/etc/nginx/sites-available/default` and update host configurations:

```nginx
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # Include default.conf rules for forwarding /api/v1 and /ws/
}
```

Install Let's Encrypt SSL certificates using Certbot:
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

---

## 5. Monitoring & Logs

### View Container Logs
```bash
# View all container streams
docker-compose logs -f

# View only background worker logs
docker-compose logs -f celery_worker
```
### Error Logs
Django structured log errors are written directly to `backend/django_error.log`. Ensure the directory has appropriate write permissions.
