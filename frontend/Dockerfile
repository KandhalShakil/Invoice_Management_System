# =============================================================================
# Frontend Dockerfile — Multi-stage build for React + Vite
# Stage 1: Build the production bundle
# Stage 2: Serve with Nginx (minimal final image)
# =============================================================================

# Stage 1: Node.js builder
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files first for layer caching
COPY package.json package-lock.json ./

# Install exact versions from lock file (faster, reproducible)
RUN npm ci --silent

# Copy all source files
COPY . .

# Build production bundle
ARG VITE_API_BASE_URL=http://localhost:8000/api/v1
ARG VITE_APP_NAME=InvoiceManager
ARG VITE_APP_VERSION=1.0.0

ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ENV VITE_APP_NAME=${VITE_APP_NAME}
ENV VITE_APP_VERSION=${VITE_APP_VERSION}

RUN npm run build

# =============================================================================
# Stage 2: Nginx production server
# =============================================================================
FROM nginx:1.25-alpine AS production

# Remove default Nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy built React app from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom nginx config
COPY nginx.docker.conf /etc/nginx/conf.d/default.conf

# Create non-root user for Nginx
RUN addgroup -g 1001 -S nginx_app && \
    adduser -u 1001 -S nginx_app -G nginx_app

# Set ownership
RUN chown -R nginx_app:nginx_app /usr/share/nginx/html && \
    chown -R nginx_app:nginx_app /var/cache/nginx && \
    chown -R nginx_app:nginx_app /var/log/nginx && \
    touch /var/run/nginx.pid && \
    chown -R nginx_app:nginx_app /var/run/nginx.pid

USER nginx_app

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -qO- http://localhost/health || exit 1

CMD ["nginx", "-g", "daemon off;"]
