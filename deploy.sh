#!/bin/bash

# ====================================
# QULAY ISH - AUTOMATED DEPLOY SCRIPT
# ====================================
# For server administrators
# Usage: bash deploy.sh your-domain.com

set -e

if [ -z "$1" ]; then
    echo "❌ Usage: bash deploy.sh YOUR_DOMAIN.COM"
    exit 1
fi

DOMAIN=$1
APP_DIR="/var/www/qulay-ish"
NGINX_CONFIG="/etc/nginx/sites-available/qulay-ish"

echo "🚀 Starting QULAY ISH deployment..."
echo "Domain: $DOMAIN"

# Step 1: Create directories
echo "📁 Creating directories..."
sudo mkdir -p $APP_DIR
sudo chown -R $USER:$USER $APP_DIR

# Step 2: Copy dist files
echo "📦 Copying build files..."
cp -r dist/* $APP_DIR/ || echo "⚠️  Run 'npm run build' first!"

# Step 3: Set permissions
echo "🔐 Setting permissions..."
sudo chown -R www-data:www-data $APP_DIR
sudo chmod -R 755 $APP_DIR

# Step 4: Create .env.production
echo "🔧 Creating .env.production..."
cat > $APP_DIR/.env.production << EOF
VITE_API_URL=/api
VITE_SUPER_ADMIN_PHONE=+998900707081
VITE_SUPER_ADMIN_PASSWORD=CHANGE_ME
VITE_SUPER_ADMIN_EMAIL=superadmin@qulay-ish.local
VITE_USE_EMULATOR=false
VITE_ENABLE_DEMO_MODE=false
EOF

# Step 5: Setup NGINX
echo "⚙️  Configuring NGINX..."
sudo tee $NGINX_CONFIG > /dev/null << 'NGINX_EOF'
server {
    listen 80;
    server_name DOMAIN_PLACEHOLDER www.DOMAIN_PLACEHOLDER;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name DOMAIN_PLACEHOLDER www.DOMAIN_PLACEHOLDER;
    
    ssl_certificate /etc/letsencrypt/live/DOMAIN_PLACEHOLDER/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/DOMAIN_PLACEHOLDER/privkey.pem;
    
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    
    root /var/www/qulay-ish/dist;
    index index.html;
    
    gzip on;
    gzip_types text/plain text/css application/json application/javascript;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    location /assets/ {
        expires 1y;
    }
    
    location ~ /\. {
        deny all;
    }
}
NGINX_EOF

# Replace domain placeholder
sudo sed -i "s/DOMAIN_PLACEHOLDER/$DOMAIN/g" $NGINX_CONFIG

# Step 6: Enable NGINX config
echo "🔗 Enabling NGINX configuration..."
sudo ln -sf $NGINX_CONFIG /etc/nginx/sites-enabled/qulay-ish
sudo rm -f /etc/nginx/sites-enabled/default

# Step 7: Test NGINX
echo "✅ Testing NGINX configuration..."
sudo nginx -t

# Step 8: Restart services
echo "🔄 Restarting services..."
sudo systemctl restart nginx

echo ""
echo "✨ Deployment complete!"
echo "🌐 Visit: https://$DOMAIN"
echo ""
echo "📝 Next steps:"
echo "1. Get SSL certificate: sudo certbot certonly --standalone -d $DOMAIN -d www.$DOMAIN"
echo "2. Update NGINX paths in $NGINX_CONFIG"
echo "3. Restart NGINX: sudo systemctl restart nginx"
echo "4. Check logs: sudo tail -f /var/log/nginx/qulay-ish-error.log"
