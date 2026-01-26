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

# Create start script
COPY <<EOF /app/start.sh
#!/bin/bash
echo "=== Starting Node.js server ==="
node /app/dist-server/index.js &
NODE_PID=\$!
sleep 3
if ! kill -0 \$NODE_PID 2>/dev/null; then
    echo "=== Node.js failed to start ==="
    exit 1
fi
echo "=== Node.js started on port 3001 ==="
echo "=== Starting Caddy ==="
caddy run --config /etc/caddy/Caddyfile
EOF

RUN chmod +x /app/start.sh

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/api/health || exit 1

# Run both services
CMD ["/app/start.sh"]
