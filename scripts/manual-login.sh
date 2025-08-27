#!/bin/bash

# Manual Login Script for VPS
# This script creates a temporary VNC session for manual WordPress login

echo "🔐 WordPress Manual Login Tool for VPS"
echo "======================================="
echo ""

# Check if docker is available
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is required but not installed."
    exit 1
fi

# Option 1: Using VNC Browser
echo "Option 1: Browser with VNC Access"
echo "----------------------------------"
echo "Starting a browser with VNC access..."
echo ""

# Start the VNC browser container
docker run -d \
  --name wp-login-browser \
  -p 7900:7900 \
  -p 5900:5900 \
  -v $(pwd)/.wp-session:/home/seluser/session \
  --shm-size="2g" \
  selenium/standalone-chrome:latest

echo "✅ Browser started!"
echo ""
echo "📱 Access the browser via:"
echo "   1. Web Browser (noVNC): http://your-vps-ip:7900"
echo "   2. VNC Client: vnc://your-vps-ip:5900"
echo ""
echo "📝 Instructions:"
echo "   1. Open the browser interface"
echo "   2. Navigate to your WordPress site"
echo "   3. Login and complete verification"
echo "   4. Press ENTER here when done..."
echo ""

read -p "Press ENTER after successful login..."

# Stop and remove the container
docker stop wp-login-browser
docker rm wp-login-browser

echo ""
echo "✅ Session should be saved!"
echo ""

# Option 2: Using SSH tunnel with local browser
echo "Option 2: SSH Tunnel Method"
echo "---------------------------"
echo "Run this on your LOCAL machine:"
echo ""
echo "1. Setup SSH tunnel:"
echo "   ssh -L 3001:localhost:3001 your-vps"
echo ""
echo "2. In another terminal on VPS, run:"
echo "   docker run -it --rm -p 3001:3001 -v \$(pwd):/app node:18 bash"
echo "   cd /app && node scripts/capture-session.js"
echo ""
echo "3. Open http://localhost:3001 on your local browser"
echo "4. Complete the login"
echo "5. Transfer the session back to VPS"