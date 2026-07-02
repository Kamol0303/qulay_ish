# ✅ DEMO MODE → PRODUCTION CHECKLIST

Use this checklist when reverting Demo Mode before production deployment.

---

## 🗑️ Step 1: Delete Demo Files

```bash
# Delete demo authentication service
rm src/lib/demoAuth.ts

# Delete documentation files
rm DEMO_MODE_README.md
rm QUICK_START_DEMO.md
rm DEMO_IMPLEMENTATION_SUMMARY.md
rm DEMO_PRODUCTION_CHECKLIST.md  # This file
```

**Verify deletion:**
```bash
# These should return "No such file":
ls src/lib/demoAuth.ts
ls DEMO_MODE_README.md
```

---

## 🔄 Step 2: Revert validation.ts

**File:** `src/lib/validation.ts`

### Remove Demo Function:
```typescript
// DELETE THESE LINES:
export function validatePasswordDemo(password: string): ValidationError {
  if (!password || password.length < 3) {
    return { isValid: false, error: 'Parol kamida 3 ta belgidan iborat bo\'lishi kerak' };
  }
  return { isValid: true };
}

/* PRODUCTION PASSWORD VALIDATION - COMMENTED OUT FOR DEMO
...
*/
```

### Restore Production Function:
```typescript
// UNCOMMENT THIS:
export function validatePassword(password: string): ValidationError {
  if (!password || password.length < 8) {
    return { isValid: false, error: 'Parol kamida 8 ta belgidan iborat bo\'lishi kerak' };
  }

  if (!/[A-Z]/.test(password)) {
    return { isValid: false, error: 'Parolda kamida 1 ta katta harf bo\'lishi kerak' };
  }

  if (!/[a-z]/.test(password)) {
    return { isValid: false, error: 'Parolda kamida 1 ta kichik harf bo\'lishi kerak' };
  }

  if (!/[0-9]/.test(password)) {
    return { isValid: false, error: 'Parolda kamida 1 ta raqam bo\'lishi kerak' };
  }

  return { isValid: true };
}
```

**Verification:**
- [ ] `validatePasswordDemo` deleted
- [ ] `validatePassword` uncommented
- [ ] No syntax errors

---

## 🔄 Step 3: Revert AuthPage.tsx

**File:** `src/pages/AuthPage.tsx`

### 3.1: Fix Imports

**Remove:**
```typescript
import { demoRegister, demoLogin, getDemoSession } from '../lib/demoAuth';
import { validatePasswordDemo } from '../lib/validation';
```

**Add:**
```typescript
import { passwordService } from '../lib/passwordService';
```

### 3.2: Remove Demo Banner

**Delete:**
```typescript
{/* DEMO MODE BANNER */}
<div className="fixed top-0 left-0 right-0 bg-yellow-500 text-black px-4 py-2 text-center font-bold text-sm z-50">
  🚧 DEMO MODE ACTIVE - Simplified authentication for testing - Remove before production! 🚧
</div>

<div className="w-full max-w-md mt-12">
```

**Replace with:**
```typescript
<div className="w-full max-w-md">
```

### 3.3: Restore handleRegister

**Delete demo code and uncomment production:**

Find:
```typescript
// ========================================
// DEMO MODE: Simplified Registration
// ========================================
... entire demo implementation ...

/* PRODUCTION CODE - COMMENTED OUT FOR DEMO MODE
try {
  const result = await authService.registerWithPassword({ ... });
  ...
}
*/
```

Replace with:
```typescript
// Validations
const phoneValidation = validatePhoneNumber(state.phoneNumber);
if (!phoneValidation.isValid) {
  setPartialState({ error: phoneValidation.error });
  return;
}

const emailValidation = validateEmail(state.email);
if (!emailValidation.isValid) {
  setPartialState({ error: emailValidation.error });
  return;
}

const nameValidation = validateFullName(state.fullName);
if (!nameValidation.isValid) {
  setPartialState({ error: nameValidation.error });
  return;
}

const passwordValidation = passwordService.validatePassword(state.password);
if (!passwordValidation.isValid) {
  setPartialState({ error: passwordValidation.error });
  return;
}

if (state.password !== state.confirmPassword) {
  setPartialState({ error: 'Parollar bir xil emas' });
  return;
}

setPartialState({ loading: true });

try {
  const result = await authService.registerWithPassword({
    phoneNumber: state.phoneNumber,
    email: state.email,
    fullName: state.fullName,
    password: state.password,
  });

  if (result.success) {
    if (result.needsRoleSelection) {
      setPartialState({ loading: false });
      setShowRoleSelection(true);
    } else {
      setPartialState({
        loading: false,
        success: 'Ro\'yxatdan o\'tdingiz! Kirilmoqda...',
        error: '',
      });
    }
  } else {
    setPartialState({
      loading: false,
      error: result.error || 'Ro\'yxatdan o\'tishda xatolik',
    });
  }
} catch (err) {
  console.error('[Register Error]', err);
  setPartialState({
    loading: false,
    error: 'Xatolik yuz berdi. Qayta urinib ko\'ring.',
  });
}
```

### 3.4: Restore handleLogin

**Delete demo code and uncomment production:**

Find:
```typescript
// ========================================
// DEMO MODE: Simplified Login
// ========================================
... entire demo implementation ...

/* PRODUCTION CODE - COMMENTED OUT FOR DEMO MODE
... production code ...
*/
```

Replace with production code (uncomment the /* PRODUCTION CODE */ block)

### 3.5: Update Dependencies

**Verify callback dependencies:**
```typescript
const handleRegister = useCallback(
  async (e: React.FormEvent) => { ... },
  [state, clearMessages, setPartialState] // Remove navigate if added
);

const handleLogin = useCallback(
  async (e: React.FormEvent) => { ... },
  [state, clearMessages, setPartialState] // Remove navigate if added
);
```

**Verification:**
- [ ] Demo imports removed
- [ ] passwordService imported
- [ ] Demo banner deleted
- [ ] handleRegister restored
- [ ] handleLogin restored
- [ ] No TypeScript errors

---

## 🔄 Step 4: Revert AuthContext.tsx

**File:** `src/context/AuthContext.tsx`

### 4.1: Remove Demo Import

**Delete:**
```typescript
import { getDemoSession, clearDemoSession } from '../lib/demoAuth';
```

### 4.2: Restore useEffect

**Find:**
```typescript
// ========================================
// DEMO MODE: Check for demo session first
// ========================================
const demoSession = getDemoSession();
if (demoSession) { ... }

/* PRODUCTION CODE - COMMENTED OUT FOR DEMO MODE
const savedDemo = localStorage.getItem('is_demo') === 'true';
...
*/
```

**Replace with:**
```typescript
const savedDemo = localStorage.getItem('is_demo') === 'true';
if (savedDemo) {
  const savedUser = localStorage.getItem('demo_user');
  const savedProfile = localStorage.getItem('demo_profile');
  if (savedUser && savedProfile) {
    try {
      setIsDemo(true);
      setUser(JSON.parse(savedUser) as User);
      setProfile(JSON.parse(savedProfile) as Profile);
      setLoading(false);
      return;
    } catch {
      // corrupt data — fall through to clear
    }
  }
  localStorage.removeItem('is_demo');
  localStorage.removeItem('demo_user');
  localStorage.removeItem('demo_profile');
}
```

### 4.3: Restore signOut

**Find:**
```typescript
// DEMO MODE: Clear demo session
if (isDemo) {
  clearDemoSession();
  ...
}

/* PRODUCTION CODE
if (isDemo) {
  localStorage.removeItem('is_demo');
  ...
}
*/
```

**Replace with:**
```typescript
if (isDemo) {
  setIsDemo(false);
  setUser(null);
  setProfile(null);
  setLoading(false);
  localStorage.removeItem('is_demo');
  localStorage.removeItem('demo_user');
  localStorage.removeItem('demo_profile');
  return;
}
```

**Verification:**
- [ ] Demo imports removed
- [ ] useEffect restored
- [ ] signOut restored
- [ ] No TypeScript errors

---

## 🧹 Step 5: Clean Firestore

### Option 1: Manual Delete (Firebase Console)

1. Open Firebase Console
2. Go to Firestore Database
3. Open `profiles` collection
4. Filter: Document ID starts with `demo_worker_`
5. Delete all matching documents

### Option 2: Script (if you have many demo users)

Create `scripts/cleanDemoUsers.ts`:
```typescript
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, deleteDoc, doc } from 'firebase/firestore';

// Your Firebase config
const firebaseConfig = { ... };

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function cleanDemoUsers() {
  const profilesRef = collection(db, 'profiles');
  const snapshot = await getDocs(profilesRef);
  
  let count = 0;
  for (const docSnap of snapshot.docs) {
    if (docSnap.id.startsWith('demo_worker_')) {
      await deleteDoc(doc(db, 'profiles', docSnap.id));
      count++;
      console.log(`Deleted: ${docSnap.id}`);
    }
  }
  
  console.log(`Total deleted: ${count}`);
}

cleanDemoUsers();
```

Run:
```bash
tsx scripts/cleanDemoUsers.ts
```

**Verification:**
- [ ] No documents with ID starting with `demo_worker_` in Firestore
- [ ] Production user profiles intact

---

## 🧪 Step 6: Test Production Build

### Build:
```bash
npm run build
```

**Expected:** No errors

### Preview:
```bash
npm run preview
```

**Test URL:** http://localhost:4173

### Test Registration:

**Input:**
- Name: "Production Test"
- Phone: "+998 90 123 4567"
- Email: "prod@test.com"
- Password: "Test1234" (8+ chars, uppercase, lowercase, number)
- Confirm: "Test1234"

**Expected:**
- ✅ Weak passwords rejected (e.g., "123")
- ✅ Strong password accepted
- ✅ Role selection modal appears
- ✅ Profile created in Firestore
- ✅ Redirects to appropriate dashboard

### Test Login:

**Input:**
- Phone: "+998 90 123 4567"
- Password: "Test1234"

**Expected:**
- ✅ Correct credentials: Login successful
- ✅ Wrong password: Error shown
- ✅ Session persists on refresh

### Test UI:

**Check:**
- [ ] No yellow demo banner
- [ ] All navigation works
- [ ] Dashboard loads correctly
- [ ] Profile page works
- [ ] Chat accessible
- [ ] No console errors

---

## 🔐 Step 7: Security Verification

### Check Environment Variables:

```bash
# Verify .env.local exists and has production values
cat .env.local | grep VITE_FIREBASE

# Expected: Production Firebase config
```

### Verify .gitignore:

```bash
# Ensure .env.local is ignored
cat .gitignore | grep .env.local

# Expected: .env.local listed
```

### Test Password Strength:

**Try these registrations:**
- [ ] "12345678" → Rejected (no uppercase)
- [ ] "password" → Rejected (no uppercase/number)
- [ ] "Password" → Rejected (no number)
- [ ] "Pass123" → Rejected (less than 8 chars)
- [ ] "Password123" → Accepted ✅

---

## 🚀 Step 8: Deploy to Production

### Firebase Hosting:

```bash
# Build production bundle
npm run build

# Deploy to Firebase
firebase deploy --only hosting
```

### Verify Deployment:

**URL:** https://your-project.web.app

**Test:**
- [ ] Site loads
- [ ] Registration works
- [ ] Login works
- [ ] Strong password required
- [ ] No demo banner
- [ ] SSL certificate valid
- [ ] All features functional

---

## 📋 Final Verification Checklist

### Code:
- [ ] `src/lib/demoAuth.ts` deleted
- [ ] `src/lib/validation.ts` reverted
- [ ] `src/pages/AuthPage.tsx` reverted
- [ ] `src/context/AuthContext.tsx` reverted
- [ ] All demo documentation deleted
- [ ] `npm run lint` passes (or only pre-existing errors)
- [ ] `npm run build` succeeds

### Firestore:
- [ ] No demo users (demo_worker_*) in profiles collection
- [ ] Production users can register
- [ ] Profiles have correct structure

### Testing:
- [ ] Registration requires strong password
- [ ] Login requires correct credentials
- [ ] Session persists on refresh
- [ ] All dashboards accessible
- [ ] No demo banner visible
- [ ] No console errors

### Security:
- [ ] Passwords hashed with bcrypt
- [ ] Environment variables secured
- [ ] .env.local not in git
- [ ] Firebase security rules deployed
- [ ] SSL enabled

### Documentation:
- [ ] README.md updated
- [ ] Deployment guide available
- [ ] User documentation current

---

## 🎉 Production Ready!

When all checkboxes are ✅, your platform is ready for production deployment!

**Questions?** Review:
- Original production code in commented sections
- Firebase documentation
- React/TypeScript best practices

**Issues?** Double-check:
- All demo code removed
- Production code uncommented
- Dependencies installed
- Firebase configured

---

**Good luck with your production deployment! 🚀**
