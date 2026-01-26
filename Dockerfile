# Build stage
FROM node:20-alpine AS builder
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build frontend and server
RUN npm run build

# Production stage
FROM node:20-alpine
WORKDIR /app

# Install Caddy and bash
RUN apk add --no-cache caddy bash

# Copy package files and install production dependencies only
COPY package*.json ./
RUN npm install --omit=dev

# Copy Caddyfile
COPY Caddyfile /etc/caddy/Caddyfile

# Copy built frontend from builder stage
COPY --from=builder /app/dist ./dist

# Copy built server from builder stage
COPY --from=builder /app/dist-server ./dist-server

# Copy start script
COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/api/health || exit 1

# Run both services
CMD ["/app/start.sh"]
