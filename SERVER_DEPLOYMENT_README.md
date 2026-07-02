# 📦 QULAY ISH - DEPLOYMENT PACKAGE

Bu papka serverga yuklash uchun tayyor. Serverchi quyidagi fayllarni ishlatadi.

---

## 📋 FAYLLAR BO'YI

| Fayl | Maqsad |
|-----|--------|
| `dist/` | **Production build** - Bu yuklash kerak |
| `DEPLOYMENT_FULL_GUIDE.md` | **TO'LIQ QO'LLANMA** - Serverchi uchun qadam-qadami |
| `deploy.sh` | **Avtomatik script** - Bash orqali o'rnatish |
| `.env.production` | **Production settings** - Firebase va boshqa config |
| `nginx-config.conf` | **Web server config** - NGINX konfiguratsiyasi |
| `ecosystem.config.json` | **Process manager** - PM2 uchun (ixtiyoriy) |

---

## 🚀 SERVER TAYYORLASH (3 VARIANT)

### **VARIANT 1: BASH SCRIPT ORQALI (Eng oson, 5 daqiqa)**

Serverga SSH qilip:

```bash
# dist va deploy.sh ni serverga nusxa ko'chish
scp -r dist/ user@SERVER_IP:/home/user/
scp deploy.sh user@SERVER_IP:/home/user/

# SSH qilish
ssh user@SERVER_IP

# Script jarayoni
bash deploy.sh your-domain.com

# Tayyor! 🎉
```

---

### **VARIANT 2: MANUAL (Asl bilim uchun, 15 daqiqa)**

```bash
# SSH qilish
ssh user@SERVER_IP

# 1. Dependencies o'rnatish
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs nginx certbot

# 2. Papka yaratish
sudo mkdir -p /var/www/qulay-ish
sudo chown -R $USER:$USER /var/www/qulay-ish

# 3. Fayllar yuklash (local mashinasidan)
# Terminal 1 (local): 
scp -r dist/* user@SERVER_IP:/var/www/qulay-ish/

# 4. NGINX config
sudo cp nginx-config.conf /etc/nginx/sites-available/qulay-ish
sudo sed -i 's/YOUR_DOMAIN.COM/your-actual-domain.com/g' /etc/nginx/sites-available/qulay-ish
sudo ln -s /etc/nginx/sites-available/qulay-ish /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default

# 5. NGINX start
sudo nginx -t
sudo systemctl restart nginx

# 6. SSL (Let's Encrypt)
sudo certbot certonly --standalone -d your-actual-domain.com

# Done! ✅
```

---

### **VARIANT 3: DOCKER (Advanced, 20 daqiqa)**

```dockerfile
# Dockerfile
FROM node:18-alpine
WORKDIR /app
COPY dist /app/
RUN npm install -g serve
CMD ["serve", "-s", ".", "-l", "3000"]
```

```bash
docker build -t qulay-ish .
docker run -p 80:3000 qulay-ish
```

---

## 🔧 QUICK SETUP COMMANDS

**Serverchi uchun:**

```bash
# 1. SSH qilish
ssh user@YOUR_SERVER_IP

# 2. O'rnatish
sudo apt-get update
sudo apt-get install -y nodejs nginx
sudo npm install -g pm2

# 3. Papka yaratish
sudo mkdir -p /var/www/qulay-ish
sudo chown -R www-data:www-data /var/www/qulay-ish

# 4. Fayl yuklash (local mashinasidan)
# Terminal yana ochib:
scp -r dist/* user@YOUR_SERVER_IP:/var/www/qulay-ish/
scp nginx-config.conf user@YOUR_SERVER_IP:~/

# 5. Server tarafida
sudo cp ~/nginx-config.conf /etc/nginx/sites-available/qulay-ish
sudo sed -i 's/YOUR_DOMAIN.COM/YOUR_ACTUAL_DOMAIN/g' /etc/nginx/sites-available/qulay-ish
sudo ln -s /etc/nginx/sites-available/qulay-ish /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx

# 6. SSL sertifikat
sudo certbot certonly --standalone -d YOUR_ACTUAL_DOMAIN -d www.YOUR_ACTUAL_DOMAIN

# 7. NGINX Update (SSL bilan)
# nginx-config.conf dagi SSL path larini update qilish

# Done! ✅
```

---

## 📊 TEKSHIRISH COMMANDALARI

Sayt ishlayotganini tekshirish uchun:

```bash
# 1. HTTPS orqali ochiladi?
curl -I https://your-domain.com

# 2. HTML yuklanyapti?
curl https://your-domain.com | head -50

# 3. Nginx logs
sudo tail -f /var/log/nginx/qulay-ish-error.log

# 4. Firestore ulanish (Browser Console)
# F12 → Console → Firebase log ko'rish

# 5. Performance test
ab -n 100 -c 10 https://your-domain.com/
```

---

## 🆘 MUAMMOLARGA JAVOB

| Muammo | Yechim |
|-------|--------|
| Sahifa ochilmaydi | `sudo systemctl status nginx` + logs ko'rish |
| 404 error | NGINX config `/index.html` fallback qilayotganini tekshirish |
| SSL xatosi | `sudo certbot renew` |
| Slow performance | Gzip enabled, cache settings tekshirish |
| Firestore not loading | Firebase credentials va API keys tekshirish |

---

## 📝 ENVIRONMENT VARIABLES

`.env.production` faylida:

```bash
# Firebase (ózgarmasdan ishlatish mumkin)
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_PROJECT_ID=...

# Demo rejimini o'chirish
VITE_ENABLE_DEMO_MODE=false
VITE_SHOW_DEBUG_BANNER=false
```

---

## 🔄 UPDATES VA REDEPLOY

Yangi versiyadagi qilish uchun:

```bash
# Local mashinasida:
npm run build
scp -r dist/* user@SERVER_IP:/var/www/qulay-ish/

# Server tarafida:
sudo systemctl reload nginx
# Yoki
pm2 restart qulay-ish
```

---

## ✅ DEPLOYMENT CHECKLIST

Tayyorlanganini tekshirish:

- [ ] `dist/` papka mavjud
- [ ] `nginx-config.conf` updated with domain
- [ ] `.env.production` Firebase keys bilan
- [ ] Server access va SSH keys tayyar
- [ ] Domain DNS updated to server IP
- [ ] SSL sertifikat olindi
- [ ] Firestore credentials tayyar

---

## 📞 TECHNICAL SUPPORT

**Q: Firestore bilan muammo?**
A: Firebase Console da project ID va credentials.json tekshiring.

**Q: Domain server ga ko'rsatmaydi?**
A: DNS propagation 24 soat vaqt oladi, CDN cache clear qiling.

**Q: Performance sekin?**
A: Gzip compression, CDN, image optimization tekshiring.

---

## 🎯 SUMMARY

```
1. SSH qilish → server admin credentials
2. deploy.sh jarayoni yoki manual setup
3. NGINX restart
4. SSL sertifikat
5. Firestore credentials
6. Test: https://your-domain.com
7. Ready! 🚀
```

---

**Ertada serverdan joy berganda bu qo'llanmani serverchiga bering. Ular bu commandalarni copy-paste qilsa, sayt ishlaydi!**
