# 🚧 DEMO MODE - TESTING ONLY

## ⚠️ WARNING: This is NOT production code!

Demo Mode bypasses Firebase Authentication and creates mock users directly in Firestore for rapid testing. **DELETE ALL DEMO MODE FILES** before deploying to production!

---

## 🎯 What Demo Mode Does

### Bypasses:
- ✅ Firebase Authentication (Email/Password)
- ✅ SMS OTP verification
- ✅ Password complexity requirements
- ✅ Email verification flows

### Simplifies:
- ✅ **Registration**: Instantly creates worker profile in Firestore
- ✅ **Login**: Uses localStorage session (no real auth)
- ✅ **Validation**: Accepts any 3+ character password

### Creates:
- ✅ Real Firestore profiles in `profiles` collection
- ✅ Mock user sessions in localStorage
- ✅ Direct navigation to `/worker/dashboard`

---

## 📂 Demo Mode Files

### Files to DELETE before production:

```
src/lib/demoAuth.ts              # Mock authentication service
DEMO_MODE_README.md              # This file
```

### Files MODIFIED (revert changes):

```
src/lib/validation.ts            # Added validatePasswordDemo()
src/pages/AuthPage.tsx           # Registration/Login use demo functions
src/context/AuthContext.tsx      # Checks getDemoSession()
```

---

## 🚀 How to Use Demo Mode

### 1. Start Development Server

```bash
npm run dev
```

Visit: http://localhost:3000/auth

### 2. Register New User

**Form Fields:**
- **Full Name**: Any name (e.g., "Test Worker")
- **Phone**: Any Uzbek number (e.g., "+998 90 123 4567")
- **Email**: Any email (e.g., "test@example.com")
- **Password**: Any 3+ characters (e.g., "123")
- **Confirm Password**: Same as password

Click **"Ro'yxatdan o'tish"**

**Result:**
- ✅ Profile created in Firestore `profiles` collection
- ✅ Role automatically set to `worker`
- ✅ Session saved to localStorage
- ✅ Redirected to `/worker/dashboard`

### 3. Login Existing User

**Form Fields:**
- **Phone**: Any phone number
- **Password**: Any password

Click **"Kirish"**

**Result:**
- ✅ Mock session created
- ✅ Redirected to `/worker/dashboard`

### 4. Check Firestore

**Firebase Console > Firestore > profiles**

You'll see:
```
Document ID: demo_worker_1234567890_abc123
{
  uid: "demo_worker_1234567890_abc123",
  fullName: "Test Worker",
  email: "test@example.com",
  phoneNumber: "+998901234567",
  role: "worker",
  region: "Samarqand",
  skills: [],
  isVerified: false,
  createdAt: Timestamp,
  ...
}
```

### 5. Logout

Click logout button → Session cleared from localStorage

---

## 🔍 What Gets Stored

### LocalStorage:
```javascript
{
  "qulay_ish_demo_session": {
    "uid": "demo_worker_1234567890_abc123",
    "fullName": "Test Worker",
    "email": "test@example.com",
    "phoneNumber": "+998901234567",
    "role": "worker",
    "createdAt": 1234567890
  }
}
```

### Firestore `profiles` Collection:
```javascript
{
  uid: string,
  fullName: string,
  email: string,
  phoneNumber: string,
  role: "worker",          // Always "worker" in demo mode
  region: "Samarqand",
  district: "",
  bio: "",
  skills: [],
  isVerified: false,
  verificationStatus: "pending",
  status: "active",
  rating: 0,
  reviewCount: 0,
  completedJobs: 0,
  createdAt: Timestamp,
  updatedAt: Timestamp,
  lastActive: Timestamp
}
```

---

## 🧪 Testing Checklist

### Registration Flow:
- [ ] Form accepts any 3+ char password
- [ ] Profile created in Firestore
- [ ] Session saved to localStorage
- [ ] Redirects to `/worker/dashboard`
- [ ] User can see their profile
- [ ] Navigation works

### Login Flow:
- [ ] Form accepts any credentials
- [ ] Session created in localStorage
- [ ] Redirects to `/worker/dashboard`
- [ ] User can navigate app

### Logout Flow:
- [ ] Session cleared from localStorage
- [ ] Redirects to home page
- [ ] Cannot access protected routes

### Firestore Integration:
- [ ] Profile visible in Firebase Console
- [ ] Profile has correct structure
- [ ] UID format: `demo_worker_[timestamp]_[random]`
- [ ] Role is "worker"

---

## 🔄 How to Add "Ish Beruvchi" (Employer) Role

### Option 1: Role Selection Modal (Recommended)

Uncomment role selection in `AuthPage.tsx`:

```typescript
// After successful registration
if (result.success) {
  setPartialState({ loading: false });
  setShowRoleSelection(true); // Show role picker
}
```

### Option 2: Separate Registration Forms

Create two separate forms:
- `/auth/worker` → Auto-create as worker
- `/auth/employer` → Auto-create as employer

### Option 3: Dropdown in Form

Add role dropdown before registration:

```typescript
<select value={selectedRole} onChange={(e) => setSelectedRole(e.target.value)}>
  <option value="worker">Ishchi</option>
  <option value="employer">Ish beruvchi</option>
</select>
```

Pass to `demoRegister()`:

```typescript
await demoRegister({
  ...data,
  role: selectedRole as 'worker' | 'employer'
});
```

Update `demoAuth.ts`:

```typescript
export async function demoRegister(data: {
  fullName: string;
  email: string;
  phoneNumber: string;
  password: string;
  role: 'worker' | 'employer'; // Add this
})
```

---

## 🔒 Reverting to Production

### Step 1: Delete Demo Files

```bash
rm src/lib/demoAuth.ts
rm DEMO_MODE_README.md
```

### Step 2: Restore `validation.ts`

Remove demo function and uncomment production:

```typescript
// DELETE THIS:
export function validatePasswordDemo(password: string): ValidationError { ... }

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

### Step 3: Restore `AuthPage.tsx`

**Imports:**
```typescript
// DELETE:
import { demoRegister, demoLogin, getDemoSession } from '../lib/demoAuth';
import { validatePasswordDemo } from '../lib/validation';

// ADD:
import { passwordService } from '../lib/passwordService';
```

**Registration:**
```typescript
// DELETE demo code and UNCOMMENT production code:
/* PRODUCTION CODE - COMMENTED OUT FOR DEMO MODE
try {
  const result = await authService.registerWithPassword({ ... });
  ...
}
*/
```

**Login:**
```typescript
// DELETE demo code and UNCOMMENT production code:
/* PRODUCTION CODE - COMMENTED OUT FOR DEMO MODE
try {
  const result = await authService.loginWithPassword({ ... });
  ...
}
*/
```

**Remove Banner:**
```typescript
// DELETE:
<div className="fixed top-0 left-0 right-0 bg-yellow-500 ...">
  🚧 DEMO MODE ACTIVE ...
</div>
```

### Step 4: Restore `AuthContext.tsx`

**Imports:**
```typescript
// DELETE:
import { getDemoSession, clearDemoSession } from '../lib/demoAuth';
```

**useEffect:**
```typescript
// DELETE demo session check
const demoSession = getDemoSession();
if (demoSession) { ... }

// UNCOMMENT old localStorage check
const savedDemo = localStorage.getItem('is_demo') === 'true';
if (savedDemo) { ... }
```

**signOut:**
```typescript
// Keep simple demo check or use old localStorage approach
if (isDemo) {
  clearDemoSession(); // or use old localStorage.removeItem()
  ...
}
```

### Step 5: Clean Firestore (Optional)

Remove demo users from production:

```javascript
// Firebase Console > Firestore > profiles
// Filter by: uid starts with "demo_worker_"
// Delete all demo profiles
```

Or run cleanup script:

```bash
npm run clean:demo-users
```

### Step 6: Test Production Flow

```bash
npm run build
npm run preview
```

Test:
- [ ] Registration with strong password works
- [ ] Login with correct credentials works
- [ ] Weak passwords rejected
- [ ] No demo banner visible
- [ ] No console errors

---

## 📊 Demo vs Production Comparison

| Feature | Demo Mode | Production |
|---------|-----------|------------|
| Password | Any 3+ chars | 8+ chars, uppercase, lowercase, number |
| Auth | localStorage | Firebase Auth |
| SMS OTP | Skipped | Required |
| Email Verify | Skipped | Required |
| Role Selection | Auto "worker" | User selects |
| Security | ⚠️ None | ✅ Full bcrypt + Firebase |
| Session | localStorage | Firebase tokens |
| Speed | ⚡ Instant | 🐌 Normal |

---

## 🆘 Troubleshooting

### Issue: User not redirecting after registration

**Solution:**
```typescript
// Check navigate is imported and used:
setTimeout(() => {
  navigate('/worker/dashboard', { replace: true });
}, 1000);
```

### Issue: Profile not loading in dashboard

**Solution:**
```typescript
// Verify Firestore profile exists:
// Firebase Console > Firestore > profiles > [uid]

// Check AuthContext is loading profile:
const demoSession = getDemoSession();
if (demoSession) {
  const profileSnap = await getDoc(doc(db, 'profiles', demoSession.uid));
  // Should exist!
}
```

### Issue: Cannot access protected routes

**Solution:**
```typescript
// Verify localStorage has session:
const session = localStorage.getItem('qulay_ish_demo_session');
console.log(JSON.parse(session));

// Check useAuth() returns user and profile:
const { user, profile, loading } = useAuth();
console.log({ user, profile, loading });
```

### Issue: "Demo worker" instead of actual name

**Solution:**
```typescript
// Check demoRegister() is using form data:
await demoRegister({
  fullName: state.fullName, // Not hardcoded "Demo Worker"
  email: state.email,
  phoneNumber: state.phoneNumber,
  password: state.password,
});
```

---

## ⚠️ FINAL REMINDER

**Before deploying to production server:**

1. ❌ DELETE `src/lib/demoAuth.ts`
2. ❌ DELETE `DEMO_MODE_README.md`
3. ✅ RESTORE `validation.ts`
4. ✅ RESTORE `AuthPage.tsx`
5. ✅ RESTORE `AuthContext.tsx`
6. ✅ REMOVE demo banner
7. ✅ TEST production build
8. ✅ CLEAN demo users from Firestore

---

**🎉 Demo Mode is great for testing, but NEVER use in production!**
