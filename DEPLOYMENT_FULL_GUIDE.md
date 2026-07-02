# 🚀 QULAY ISH - SERVER DEPLOYMENT GUIDE

Serverga o'rnatish uchun to'liq qo'llanma. Serverchi bu bosqichlarni ketma-ket bajarlasa sayt ishlaydi.

---

## 📋 SERVER REQUIREMENTS

```
- Ubuntu 20.04+ yoki CentOS 7+
- Node.js 18+ (LTS)
- Nginx web server
- PM2 (process manager)
- 2GB RAM minimum
- 10GB disk space
- SSL Certificate (Let's Encrypt bepul)
```

---

## 🔧 STEP 1: SERVER SETUP (Birinchi marta)

### 1.1 Node.js o'rnatish

```bash
# NodeSource repository qo'shish
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -

# Node.js o'rnatish
sudo apt-get install -y nodejs

# Versiyani tekshirish
node -v
npm -v
```

### 1.2 Nginx o'rnatish

```bash
sudo apt-get update
sudo apt-get install -y nginx

# Nginx start qilish
sudo systemctl start nginx
sudo systemctl enable nginx
```

### 1.3 PM2 o'rnatish (optional, agar backend kerak bo'lsa)

```bash
sudo npm install -g pm2
pm2 startup
pm2 save
```

### 1.4 SSL Certificate (Let's Encrypt)

```bash
# Certbot o'rnatish
sudo apt-get install -y certbot python3-certbot-nginx

# Certificate olish
sudo certbot certonly --standalone -d YOUR_DOMAIN.COM -d www.YOUR_DOMAIN.COM

# Certificate auto-renewal
sudo systemctl enable certbot.timer
```

---

## 📦 STEP 2: SAYTNI DEPLOY QILISH

### 2.1 Papka yaratish va fayl nusxa ko'chish

```bash
# Papka yaratish
sudo mkdir -p /var/www/qulay-ish
sudo chown -R $USER:$USER /var/www/qulay-ish

# Server mashinasida (SSH):
# Local mashinasidan scp orqali yuklash
scp -r dist/* user@YOUR_SERVER_IP:/var/www/qulay-ish/

# Ruxsatlarni o'rnatish
sudo chown -R www-data:www-data /var/www/qulay-ish
sudo chmod -R 755 /var/www/qulay-ish
```

### 2.2 NGINX konfiguratsiyasi

```bash
# Nginx config faylini nusxa ko'chish
sudo cp nginx-config.conf /etc/nginx/sites-available/qulay-ish

# Domenni o'zgarish
sudo sed -i 's/YOUR_DOMAIN.COM/your-actual-domain.com/g' /etc/nginx/sites-available/qulay-ish

# Enable qilish
sudo ln -s /etc/nginx/sites-available/qulay-ish /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default

# Tekshirish
sudo nginx -t

# Restart qilish
sudo systemctl restart nginx
```

### 2.3 Firestore Credentials o'rnatish

```bash
# Firebase Console da credentials.json yuklab oling
# https://console.firebase.google.com

# Server mashinasiga yuklang
mkdir -p ~/.config/firebase
cp firebase-credentials.json ~/.config/firebase/

# Environment variable o'rnatish
export FIREBASE_CREDENTIALS_PATH="$HOME/.config/firebase/firebase-credentials.json"
echo 'export FIREBASE_CREDENTIALS_PATH="$HOME/.config/firebase/firebase-credentials.json"' >> ~/.bashrc
```

---

## 🔐 STEP 3: ENVIRONMENT VARIABLES

```bash
# Production .env file yaratish
sudo nano /var/www/qulay-ish/.env.production

# Quyidagi ma'lumotlarni kiriting:
VITE_FIREBASE_API_KEY=your_key_here
VITE_FIREBASE_AUTH_DOMAIN=your_domain_here
# ... va boshqalar (.env.production template asosida)

# Faylni saqlash (Ctrl+O, Enter, Ctrl+X)
```

---

## 🏃 STEP 4: SAYTNI START QILISH

### Variant 1: Faqat static fayl (Nginx)
```bash
# Faqat NGINX orqali serve qilinadi
# /var/www/qulay-ish/dist/index.html otomatik uchun ishga tushmadi

# Tekshirish
curl -I http://YOUR_DOMAIN.COM
```

### Variant 2: Backend API bilan (PM2)

```bash
# PM2 o'rnatish
sudo npm install -g pm2

# PM2 config copy qilish
sudo cp ecosystem.config.json /var/www/qulay-ish/

# PM2 start qilish
cd /var/www/qulay-ish
pm2 start ecosystem.config.json

# PM2 status tekshirish
pm2 status

# Logs ko'rish
pm2 logs qulay-ish

# Auto-restart qilish
pm2 startup
pm2 save
```

---

## 🧪 STEP 5: TEKSHIRISH

### 5.1 HTTPS konfiguratsiyasi
```bash
# HTTPS ishlayotganini tekshirish
curl -I https://YOUR_DOMAIN.COM

# Natija: 200 OK bo'lishi kerak
```

### 5.2 API Health Check
```bash
# Frontend assets yuklanyotganini tekshirish
curl https://YOUR_DOMAIN.COM | head -20

# HTML content ko'rinishi kerak
```

### 5.3 Firestore ulanishi
```bash
# Browser Console da (F12 → Console):
# "[Firebase] Active Configuration:" xabarini ko'rish kerak
```

---

## 🛠️ TROUBLESHOOTING

### Sahifa yuklanmaydi
```bash
# NGINX logs ko'rish
sudo tail -f /var/log/nginx/qulay-ish-error.log

# Ruxsatlarni tekshirish
ls -la /var/www/qulay-ish/dist/

# Nginx restart qilish
sudo systemctl restart nginx
```

### Firestore bilan muammo
```bash
# Environment variables tekshirish
echo $FIREBASE_CREDENTIALS_PATH

# Firebase CLI login qilish
firebase login
firebase init
```

### SSL sertifikat muammosi
```bash
# Sertifikat avtomatik yangilash
sudo certbot renew --dry-run

# Manual yangilash
sudo certbot renew
```

---

## 📊 MONITORING

### PM2 bilan monitoring
```bash
pm2 monit
pm2 logs
pm2 stop qulay-ish
pm2 restart qulay-ish
```

### NGINX status
```bash
sudo systemctl status nginx
sudo journalctl -u nginx -f
```

---

## 🔄 UPDATES VA REDEPLOY

Yangi versiya yuklash uchun:

```bash
# 1. Local mashinasida yangi build qilish
npm run build

# 2. dist/ ni serverga nusxa ko'chish
scp -r dist/* user@YOUR_SERVER_IP:/var/www/qulay-ish/

# 3. NGINX cache clear qilish (ixtiyoriy)
sudo systemctl reload nginx

# 4. PM2 restart qilish
pm2 restart qulay-ish
```

---

## ✅ CHECKLIST

Sayt ishlayotganini tekshirish uchun:

- [ ] HTTPS orqali sayt ochiladi
- [ ] Landing page ko'rinadi
- [ ] Kirish sahifasida telefon/email qabul qilinadi
- [ ] Kod console da ko'rinadi (demo rejimda)
- [ ] Rol tanlagandan so'ng dashboard ochiladi
- [ ] Profil saqlansa, Firestore da saqlanadi
- [ ] Logout → login qayta ishlaydi

---

## 📞 SUPPORT

Muammoga duch kelsangiz:
1. Logs ko'rish: `sudo tail -f /var/log/nginx/qulay-ish-error.log`
2. Firebase konfiguratsiyasini tekshirish
3. SSL sertifikatini tekshirish
4. Firewall ruxsatlarini tekshirish

---

## 🎯 OXIRGI BOSQICH

```bash
# Saytni online chiqish uchun
# 1. Domain DNS ni serverning IP addressiga ko'rsating
# 2. SSL sertifikatini o'rnatish
# 3. NGINX restart qilish
# 4. Firestore/Firebase production credentials o'rnatish

# Tayyor!
```
