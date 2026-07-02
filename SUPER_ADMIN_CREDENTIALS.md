# 🔑 SUPER ADMIN ACCESS & CREDENTIALS

## ⚡ Quick Access

**Super Admin Login Page:**
```
http://localhost:3000/super-admin-login
```

## 📱 Credentials (DO NOT SHARE)

```
Phone Number: +998900707081
Password:     Hur_135642
Email:        superadmin@qulay-ish.local
```

## ✅ How to Login as Super Admin

1. Open: http://localhost:3000/super-admin-login
2. Enter Phone: **+998900707081**
3. Enter Password: **Hur_135642**
4. Click **Login**
5. You'll be redirected to: http://localhost:3000/super-admin/dashboard

## 🔐 Changing Credentials

### If you want to change the password:

**Option 1: Local Development**
Edit `.env`:
```
VITE_SUPER_ADMIN_PHONE="+998900707081"
VITE_SUPER_ADMIN_PASSWORD="NewPassword123"
VITE_SUPER_ADMIN_EMAIL="superadmin@qulay-ish.local"
```

Then restart: `npm run dev`

**Option 2: Production**
Edit `.env.production`:
```
VITE_SUPER_ADMIN_PHONE="+998900707081"
VITE_SUPER_ADMIN_PASSWORD="NewPassword123"
VITE_SUPER_ADMIN_EMAIL="superadmin@qulay-ish.local"
```

Then rebuild and redeploy.

## 🧪 Testing Other Roles

### Create a Worker Account:
- URL: http://localhost:3000/auth?mode=register
- Name: Test Worker
- Phone: +998 90 123 45 67
- Email: worker@example.com
- Password: TestPass123
- Role: Worker ← Select this

### Create an Employer Account:
- URL: http://localhost:3000/auth?mode=register
- Name: Test Employer
- Phone: +998 90 222 33 44
- Email: employer@example.com
- Password: TestPass123
- Role: Employer ← Select this

### Login as Worker:
- Phone: +998 90 123 45 67
- Password: TestPass123

### Login as Employer:
- Phone: +998 90 222 33 44
- Password: TestPass123

## 🚨 Important Notes

⚠️ **KEEP CREDENTIALS PRIVATE**
- These credentials grant full platform control
- Store in secure password manager
- Only share with authorized admins
- Change periodically in production

⚠️ **ENVIRONMENT VARIABLES REQUIRED**
- Without these in `.env` or `.env.production`, super admin login won't work
- Both .env and .env.production must have:
  - VITE_SUPER_ADMIN_PHONE
  - VITE_SUPER_ADMIN_PASSWORD
  - VITE_SUPER_ADMIN_EMAIL

⚠️ **HIDDEN ROUTE**
- /super-admin-login is not linked in the UI on purpose
- You must type the URL directly in the address bar
- This provides security through obscurity

## 📊 Super Admin Dashboard Features

After logging in, you have access to:
- 👥 User Management
- 💼 Application Reviews
- 📋 Job Listings
- 💬 System Moderations
- 📊 Analytics
- ⚙️ System Settings
- 📝 Activity Logs
- 🔍 Verification Management

## ✅ Verification Checklist

- [x] Super admin credentials set in environment
- [x] Login page accessible at /super-admin-login
- [x] Firebase configured and connected
- [x] Firestore role verification working
- [x] Dashboard redirects working
- [x] No demo codes visible
- [x] Build passing

## 🆘 Troubleshooting

**Problem:** "Super Admin muhit konfiguratsiyasi yaroqsiz"
- **Solution:** Check that .env has all three variables: VITE_SUPER_ADMIN_PHONE, VITE_SUPER_ADMIN_PASSWORD, VITE_SUPER_ADMIN_EMAIL

**Problem:** "Telefon raqam yoki parol noto'g'ri"
- **Solution:** Check that you entered exactly: +998900707081 and Hur_135642 (case-sensitive)

**Problem:** "Kirish rad etildi. Faqat Super Admin hisobi bilan kirishingiz mumkin."
- **Solution:** Super admin profile doesn't exist in Firestore yet. First login will create it automatically.

**Problem:** App not loading at all
- **Solution:** Restart dev server: `npm run dev`

---

**Last Updated:** June 11, 2026  
**Status:** ✅ Production Ready
