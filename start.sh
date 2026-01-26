#!/bin/bash
echo "=== Starting Node.js server ==="
node /app/dist-server/index.js &
NODE_PID=$!
sleep 3
if ! kill -0 $NODE_PID 2>/dev/null; then
    echo "=== Node.js failed to start ==="
    exit 1
fi
echo "=== Node.js started on port 3001 ==="
echo "=== Starting Caddy ==="
caddy run --config /etc/caddy/Caddyfile
