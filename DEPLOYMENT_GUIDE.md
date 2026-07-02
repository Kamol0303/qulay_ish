# 🚀 PRODUCTION DEPLOYMENT GUIDE

Complete step-by-step guide for deploying Qulay Ish platform to production server.

---

## 📋 Pre-Deployment Checklist

### ✅ Required:
- [ ] Firebase project created
- [ ] Firebase Authentication enabled (Email/Password)
- [ ] Firestore database created
- [ ] Production domain configured
- [ ] Environment variables prepared
- [ ] Super Admin credentials secured

---

## 🔧 Step 1: Environment Setup

### Create `.env.local` file:

```bash
# Firebase Configuration (Production)
VITE_FIREBASE_API_KEY="your-production-api-key"
VITE_FIREBASE_AUTH_DOMAIN="your-project.firebaseapp.com"
VITE_FIREBASE_PROJECT_ID="your-production-project-id"
VITE_FIREBASE_STORAGE_BUCKET="your-project.firebasestorage.app"
VITE_FIREBASE_MESSAGING_SENDER_ID="your-sender-id"
VITE_FIREBASE_APP_ID="your-production-app-id"
VITE_FIRESTORE_DATABASE_ID="(default)"

# Super Admin Credentials (KEEP SECRET!)
VITE_SUPER_ADMIN_PHONE="+998900707081"
VITE_SUPER_ADMIN_PASSWORD="Hur_135642"
```

### Security Check:
```bash
# Verify .env.local is in .gitignore
cat .gitignore | grep .env.local
```

---

## 🗃️ Step 2: Database Migration (If Needed)

### If you have existing demo users:

```bash
# Run migration script to add passwords
npm run migrate:passwords
```

**This will:**
- Find all users without passwords
- Generate temporary password: `TempPass123`
- Hash and store passwords
- Output credentials for notification

### Send credentials to users:
```
Subject: Qulay Ish - Yangi parol tizimi
Body:
Hurmatli foydalanuvchi,

Platform yangilandi va endi parol bilan kirish kerak.

Sizning vaqtinchalik parolingiz: TempPass123

Iltimos, birinchi kirishda parolni o'zgartiring.

Rahmat!
Qulay Ish jamoasi
```

---

## 🏗️ Step 3: Build Production Bundle

### Clean previous builds:
```bash
npm run clean
```

### Install dependencies:
```bash
npm install
```

### Build for production:
```bash
npm run build
```

### Test production build locally:
```bash
npm run preview
```

**Visit:** http://localhost:4173

### Test checklist:
- [ ] Registration works
- [ ] Login works
- [ ] Super Admin login works
- [ ] Role badges display
- [ ] Navigation works
- [ ] Chat loads
- [ ] No console errors

---

## 🔐 Step 4: Firebase Security Rules

### Update Firestore Rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Helper functions
    function isSignedIn() {
      return request.auth != null;
    }
    
    function isOwner(userId) {
      return isSignedIn() && request.auth.uid == userId;
    }
    
    function getRole() {
      return get(/databases/$(database)/documents/profiles/$(request.auth.uid)).data.role;
    }
    
    function isAdmin() {
      return isSignedIn() && getRole() in ['admin', 'super_admin'];
    }
    
    // Profiles collection
    match /profiles/{userId} {
      // Anyone can read profiles
      allow read: if true;
      
      // Users can only create worker/employer profiles
      allow create: if isSignedIn() 
        && request.auth.uid == userId
        && request.resource.data.role in ['worker', 'employer'];
      
      // Users can update their own profile (but not role)
      allow update: if isOwner(userId)
        && request.resource.data.role == resource.data.role;
      
      // Admins can update any profile
      allow update: if isAdmin();
      
      // No one can delete profiles
      allow delete: if false;
    }
    
    // Jobs collection
    match /jobs/{jobId} {
      allow read: if true;
      allow create: if isSignedIn() && getRole() == 'employer';
      allow update, delete: if isSignedIn() 
        && (resource.data.employerId == request.auth.uid || isAdmin());
    }
    
    // Applications collection
    match /applications/{appId} {
      allow read: if isSignedIn() 
        && (resource.data.workerId == request.auth.uid 
            || resource.data.employerId == request.auth.uid
            || isAdmin());
      allow create: if isSignedIn() && getRole() == 'worker';
      allow update: if isSignedIn()
        && (resource.data.employerId == request.auth.uid || isAdmin());
      allow delete: if isOwner(resource.data.workerId);
    }
    
    // Contracts collection
    match /contracts/{contractId} {
      allow read: if isSignedIn()
        && (resource.data.workerId == request.auth.uid
            || resource.data.employerId == request.auth.uid
            || isAdmin());
      allow create: if isSignedIn()
        && (getRole() == 'employer' || isAdmin());
      allow update: if isSignedIn()
        && (resource.data.workerId == request.auth.uid
            || resource.data.employerId == request.auth.uid
            || isAdmin());
    }
    
    // Chat messages
    match /messages/{messageId} {
      allow read: if isSignedIn()
        && (request.auth.uid in resource.data.participants || isAdmin());
      allow create: if isSignedIn()
        && request.auth.uid == request.resource.data.senderId;
    }
  }
}
```

---

## 🌐 Step 5: Firebase Hosting Deployment

### Install Firebase CLI:
```bash
npm install -g firebase-tools
```

### Login to Firebase:
```bash
firebase login
```

### Initialize Firebase Hosting:
```bash
firebase init hosting
```

**Configuration:**
- Public directory: `dist`
- Single-page app: `Yes`
- GitHub integration: `No` (optional)

### Deploy to Firebase:
```bash
firebase deploy --only hosting
```

**Output:**
```
✔  Deploy complete!

Project Console: https://console.firebase.google.com/project/your-project
Hosting URL: https://your-project.web.app
```

---

## 🔍 Step 6: Post-Deployment Testing

### Test Production Site:

1. **Registration Flow:**
   ```
   - Go to /auth
   - Click "Ro'yxatdan o'tish"
   - Enter: Name, Phone, Email, Password
   - Verify account created in Firestore
   ```

2. **Login Flow:**
   ```
   - Go to /auth
   - Click "Kirish"
   - Enter: Phone, Password
   - Verify successful login
   ```

3. **Super Admin Access:**
   ```
   - Go to /auth
   - Click "Kirish"
   - Phone: +998900707081
   - Password: Hur_135642
   - Verify redirect to /super-admin/dashboard
   ```

4. **Role Badges:**
   ```
   - Check worker profiles show "Ishchi" badge
   - Check employer profiles show "Ish beruvchi" badge
   - Check admin dashboard shows "Administrator"
   ```

5. **Navigation:**
   ```
   - Test all back buttons
   - Verify smooth navigation
   - Check mobile menu works
   ```

6. **Chat System:**
   ```
   - Send test message
   - Verify real-time delivery
   - Check Firestore messages collection
   ```

---

## 📊 Step 7: Monitor & Verify

### Firebase Console Checks:

1. **Authentication:**
   - Go to Firebase Console > Authentication
   - Verify new users appearing
   - Check email/password provider enabled

2. **Firestore:**
   - Go to Firebase Console > Firestore
   - Check `profiles` collection
   - Verify `passwordHash` field exists
   - Check data structure correct

3. **Hosting:**
   - Go to Firebase Console > Hosting
   - Check deployment status
   - Verify domain connected

### Performance Monitoring:

```bash
# Enable Firebase Performance Monitoring
firebase deploy --only performance
```

---

## 🔐 Step 8: Security Hardening

### 1. Secure Super Admin Credentials:

**Move to Server Environment Variables:**
```bash
# On production server
export VITE_SUPER_ADMIN_PHONE="+998900707081"
export VITE_SUPER_ADMIN_PASSWORD="Hur_135642"
```

### 2. Enable HTTPS:

Firebase Hosting automatically provides HTTPS. Verify:
```
https://your-domain.web.app
```

### 3. Set Security Headers:

Create `firebase.json`:
```json
{
  "hosting": {
    "public": "dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ],
    "headers": [
      {
        "source": "**",
        "headers": [
          {
            "key": "X-Content-Type-Options",
            "value": "nosniff"
          },
          {
            "key": "X-Frame-Options",
            "value": "DENY"
          },
          {
            "key": "X-XSS-Protection",
            "value": "1; mode=block"
          },
          {
            "key": "Referrer-Policy",
            "value": "strict-origin-when-cross-origin"
          }
        ]
      }
    ]
  }
}
```

Redeploy:
```bash
firebase deploy --only hosting
```

---

## 📱 Step 9: Mobile & Browser Testing

### Test on multiple devices:

- [ ] Desktop Chrome
- [ ] Desktop Firefox
- [ ] Desktop Safari
- [ ] Mobile Android Chrome
- [ ] Mobile iOS Safari
- [ ] Tablet iPad

### Test different screen sizes:
```
- Mobile: 375px, 414px
- Tablet: 768px, 1024px
- Desktop: 1280px, 1920px
```

---

## 📧 Step 10: User Notification

### Notify existing users:

**Email Template:**
```
Subject: Qulay Ish platformasi yangilandi! 🚀

Hurmatli foydalanuvchilar,

Qulay Ish platformasi yangilandi va endi xavfsiz parol tizimi bilan ishlaydi.

✅ Yangi imkoniyatlar:
- Xavfsiz parol bilan kirish
- Yaxshilangan profil ko'rinishi
- Tezkor navigatsiya
- Mobil qulay interfeys

📱 Qanday kirishim mumkin?

1. Saytga kiring: https://your-domain.web.app/auth
2. "Kirish" tugmasini bosing
3. Telefon raqamingizni kiriting
4. Parolingizni kiriting

Agar parolingizni unutgan bo'lsangiz, support@qulayish.uz ga murojaat qiling.

Rahmat!
Qulay Ish jamoasi
```

---

## 🎉 Deployment Complete!

### ✅ Final Checklist:

- [ ] Production site is live
- [ ] Users can register successfully
- [ ] Users can login successfully
- [ ] Super Admin can access dashboard
- [ ] All features working
- [ ] Security rules deployed
- [ ] Passwords are hashed
- [ ] Role badges visible
- [ ] Mobile responsive
- [ ] No console errors
- [ ] Users notified

---

## 🆘 Troubleshooting

### Issue: Users can't register

**Solution:**
```bash
# Check Firebase Authentication
- Go to Firebase Console > Authentication
- Verify Email/Password provider is enabled
- Check error logs
```

### Issue: Super Admin can't login

**Solution:**
```bash
# Verify environment variables
echo $VITE_SUPER_ADMIN_PHONE
echo $VITE_SUPER_ADMIN_PASSWORD

# Check super admin profile exists in Firestore
# Collection: profiles
# Document ID: super admin's uid
# Field: role = 'super_admin'
```

### Issue: Passwords not working

**Solution:**
```bash
# Verify bcryptjs is installed
npm list bcryptjs

# Check passwordHash field exists in profiles
# Re-run migration if needed
npm run migrate:passwords
```

### Issue: Build fails

**Solution:**
```bash
# Clear cache and rebuild
rm -rf node_modules dist
npm install
npm run build
```

---

## 📞 Support

For deployment issues:
- Email: deploy@qulayish.uz
- Telegram: @qulayish_support

---

**🎊 Tabriklaymiz! Platform production serverda!**
