# 🎯 SERVERGA YUKLASH UCHUN TAYYOR PAKET

Ertaga serverdan joy berganida, bu fayllarni serverga yuklash kerak:

---

## 📦 YUKLASh KA KERAK BO'LGAN FAYLLAR

```
qulay-ish/
├── dist/                      # Production build (ASOSIY - buni yuklash kerak)
├── deploy.sh                  # Avtomatik o'rnatish script
├── .env.production            # Production settings
├── nginx-config.conf          # Nginx web server config
├── ecosystem.config.json      # PM2 process manager (ixtiyoriy)
├── DEPLOYMENT_FULL_GUIDE.md  # TO'LIQ QO'LLANMA (serverchi uchun)
└── SERVER_DEPLOYMENT_README.md # Quick reference guide
```

---

## ⚡ 3 MINUTLIK QUICK START (Serverchiga beradigan)

Serverda terminal ochib, quyidagini copy-paste qiling:

```bash
# 1. SSH qilish
ssh user@YOUR_SERVER_IP

# 2. Dependencies o'rnatish
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get update
sudo apt-get install -y nodejs nginx certbot python3-certbot-nginx

# 3. Papka yaratish
sudo mkdir -p /var/www/qulay-ish
sudo chown -R $USER:$USER /var/www/qulay-ish

# 4. Fayllar yuklash (local mashinasidan YANGI TERMINAL OCHIB):
scp -r dist/* user@YOUR_SERVER_IP:/var/www/qulay-ish/
scp nginx-config.conf user@YOUR_SERVER_IP:~/

# 5. Server tarafida davom ettirish
sudo cp ~/nginx-config.conf /etc/nginx/sites-available/qulay-ish
sudo sed -i 's/YOUR_DOMAIN.COM/your-actual-domain.com/g' /etc/nginx/sites-available/qulay-ish
sudo ln -s /etc/nginx/sites-available/qulay-ish /etc/nginx/sites-enabled/qulay-ish
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx

# 6. SSL sertifikat (agar domain DNS ga ko'rsatilgan bo'lsa)
sudo certbot certonly --standalone -d your-actual-domain.com -d www.your-actual-domain.com

# 7. NGINX SSL path update (sertifikat olindi bo'lsa)
sudo systemctl restart nginx

# 8. HTTPS orqali test qilish
curl -I https://your-actual-domain.com

# ✅ TAYYOR!
```

---

## 📝 SERVERCHIGA YUBORILADIGAN KO'RSATMA

```
🚀 QULAY ISH - DEPLOYMENT INSTRUCTIONS

Serverdan joy bo'lganida, quyidagini qilish kerak:

1️⃣ SERVER REQUIREMENTS:
   - Ubuntu 20.04+
   - 2GB RAM, 10GB disk
   - Root/sudo access

2️⃣ QUICK INSTALL:
   a) SSH qilish
   b) Quick Start commands (yuqorida) copy-paste qiling
   c) curl -I https://domain.com → 200 OK ko'rish
   d) Tayyor!

3️⃣ FILES UPLOADED:
   ✓ dist/               → Production build
   ✓ deploy.sh           → Avtomatik script (optional)
   ✓ .env.production     → Settings
   ✓ nginx-config.conf   → Web server config

4️⃣ TROUBLESHOOTING:
   - Logs: sudo tail -f /var/log/nginx/qulay-ish-error.log
   - Nginx: sudo systemctl status nginx
   - DNS: Domain to server IP
   - SSL: sudo certbot renew

5️⃣ AFTER DEPLOYMENT:
   - Visit: https://your-domain.com
   - Test: Kirish → kod → rol tanlash → dashboard
   - Check: Profil saqlash → Firestore
```

---

## 🎁 BONUS: SERVERGA DEPLOY SCRIPT BILAN

Agar serverchi terminali o'rnatilgan bo'lsa:

```bash
# Server tarafida
bash deploy.sh your-actual-domain.com

# Avtomatik qilar:
# ✓ Papka yaratish
# ✓ Ruxsatlar o'rnatish
# ✓ NGINX config
# ✓ .env.production
# ✓ NGINX restart

# Tayyor! ✅
```

---

## ✅ DEPLOYMENT CHECKLIST (Serverchiga beradigan)

Yuklashdan oldin:
- [ ] Server access (SSH key)
- [ ] Domen DNS nuqtasi
- [ ] Admin/sudo privileges
- [ ] 2GB RAM va 10GB disk

Yuklashda:
- [ ] dist/ papka yuklandi
- [ ] nginx-config.conf yuklandi
- [ ] .env.production yuklandi
- [ ] Nginx tekshirildi (nginx -t)
- [ ] Nginx restart qilindi

Yuklashdan so'ng:
- [ ] HTTPS orqali sayt ochiladi
- [ ] HTML yuklanydi (curl https://domain)
- [ ] Kirish sahifasi ko'rinadi
- [ ] Kod input qabul qilinadi
- [ ] Profile saqlansa Firestore da yoziladi

---

## 🔗 QO'SHIMCHA LINKLAR

| Nima kerak | Qayerdan |
|-----------|---------|
| Free SSL certificate | https://letsencrypt.org |
| Nginx docs | https://nginx.org |
| Domain DNS | Domain registar |
| Firestore setup | https://firebase.google.com |

---

## 📞 SERVERGA UPLOAD QILISH

### **Option 1: SCP orqali (Eng oson)**

```bash
# Local mashinasida:
scp -r dist/* user@SERVER_IP:/var/www/qulay-ish/

# Yoki bat bir papka:
scp -r ./ user@SERVER_IP:/home/user/qulay-ish/
```

### **Option 2: SFTP orqali (GUI)**

1. FileZilla yoki WinSCP ochish
2. Server credentials
3. dist/ → /var/www/qulay-ish/ drag-drop

### **Option 3: Git orqali (Professional)**

```bash
# Server tarafida
cd /var/www/qulay-ish
git clone https://your-repo-url .
npm run build
sudo systemctl reload nginx
```

---

## 🎯 FINAL SUMMARY

```
UPLOAD THIS:
  dist/
  deploy.sh
  .env.production
  nginx-config.conf
  DEPLOYMENT_FULL_GUIDE.md
  SERVER_DEPLOYMENT_README.md

SERVERCHI DOES:
  1. SSH → server access
  2. Copy Quick Start commands
  3. Paste va jarayoni kutish
  4. curl https://domain.com
  5. Test kirish → dashboard

RESULT:
  ✅ Sayt online
  ✅ HTTPS ishga tushgan
  ✅ Firestore connected
  ✅ Production ready! 🚀
```

---

**Ertada serverga topshiradigan bo'lsangiz, bu fayllarni zip qilib beering!**

```bash
zip -r qulay-ish-deployment.zip dist/ deploy.sh .env.production nginx-config.conf *.md
```

**📧 Email orqali yuboring yoki USB da qo'ying.**
