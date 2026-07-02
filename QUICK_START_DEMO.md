# 🚀 Quick Start - Demo Mode Testing

## Start Testing in 3 Steps

### Step 1: Start Server
```bash
npm run dev
```

### Step 2: Register
1. Go to http://localhost:3000/auth
2. Click **"Ro'yxatdan o'tish"**
3. Fill form:
   - Name: "Test User"
   - Phone: "+998 90 123 4567"
   - Email: "test@example.com"
   - Password: "123"
   - Confirm: "123"
4. Click **"Ro'yxatdan o'tish"**

✅ **Result**: Redirected to `/worker/dashboard`

### Step 3: Verify Firestore
- Open Firebase Console
- Go to Firestore Database
- Check `profiles` collection
- See new document with ID: `demo_worker_[timestamp]_[random]`

---

## 🎯 What Just Happened?

1. ✅ No Firebase Auth required
2. ✅ No SMS OTP sent
3. ✅ Weak password accepted (just "123")
4. ✅ Profile created in Firestore
5. ✅ Session saved to localStorage
6. ✅ Auto-logged in as **worker**

---

## 🧪 Test Different Scenarios

### Test 1: Multiple Users
Register again with different phone/email → New profile created

### Test 2: Logout & Login
Logout → Go to /auth → Login with any phone/password → Creates new session

### Test 3: Page Refresh
Refresh page → Session persists (from localStorage)

### Test 4: Dashboard Access
Navigate to `/worker/dashboard` → Profile loads correctly

### Test 5: Profile Edit
Go to `/my-profile` → Edit profile → Saves to Firestore

---

## 📊 Check Implementation

### Browser DevTools:

**Application > Local Storage > localhost:3000**
```json
{
  "qulay_ish_demo_session": {
    "uid": "demo_worker_1234567890_abc123",
    "fullName": "Test User",
    "email": "test@example.com",
    "phoneNumber": "+998901234567",
    "role": "worker",
    "createdAt": 1234567890
  }
}
```

### Firestore Console:

**profiles/demo_worker_1234567890_abc123**
```json
{
  "uid": "demo_worker_1234567890_abc123",
  "fullName": "Test User",
  "email": "test@example.com",
  "phoneNumber": "+998901234567",
  "role": "worker",
  "region": "Samarqand",
  "district": "",
  "skills": [],
  "isVerified": false,
  "verificationStatus": "pending",
  "status": "active",
  "rating": 0,
  "reviewCount": 0,
  "completedJobs": 0
}
```

---

## ⚠️ Important Notes

### Demo Mode Features:
- ✅ Password: ANY 3+ characters (no complexity)
- ✅ Phone: Format checked, but NOT verified
- ✅ Email: Format checked, but NOT verified
- ✅ Role: ALWAYS "worker" (hardcoded)
- ✅ Auth: localStorage only (no Firebase Auth)

### Limitations:
- ❌ No real authentication security
- ❌ No password reset
- ❌ No email verification
- ❌ Cannot create "employer" role (yet)
- ❌ Session lost if localStorage cleared

---

## 🔄 Adding "Ish Beruvchi" Role

### Quick Fix (5 minutes):

Edit `src/lib/demoAuth.ts` line 81:

```typescript
// CHANGE FROM:
role: 'worker', // Always create as worker in demo mode

// TO:
role: 'employer', // Always create as employer in demo mode
```

Now registration creates employers instead!

### Better Solution (10 minutes):

Add role parameter to `demoRegister()` in `src/lib/demoAuth.ts`:

```typescript
export async function demoRegister(data: {
  fullName: string;
  email: string;
  phoneNumber: string;
  password: string;
  role: 'worker' | 'employer'; // ADD THIS
})
```

Then pass role from `AuthPage.tsx`:

```typescript
await demoRegister({
  phoneNumber: state.phoneNumber,
  email: state.email,
  fullName: state.fullName,
  password: state.password,
  role: 'worker', // or from a dropdown
});
```

---

## 🛑 Before Production

**READ**: `DEMO_MODE_README.md` for full revert instructions

**Summary**:
1. Delete `src/lib/demoAuth.ts`
2. Delete `DEMO_MODE_README.md`
3. Restore `validation.ts`
4. Restore `AuthPage.tsx`
5. Restore `AuthContext.tsx`
6. Remove yellow banner
7. Clean demo users from Firestore

---

## 🆘 Help

**Issue**: Page won't load
- Check `npm run dev` is running
- Check no TypeScript errors in console
- Try `npm install` again

**Issue**: Profile not found
- Check Firestore Console
- Verify document ID starts with `demo_worker_`
- Check localStorage has session

**Issue**: Cannot access dashboard
- Refresh page after registration
- Check browser console for errors
- Verify `useAuth()` returns user and profile

---

**✅ Demo Mode is ready for testing!**
