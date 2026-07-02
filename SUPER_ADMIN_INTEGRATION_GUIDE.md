# Super Admin Dashboard Integration Guide

## Overview

Three new Super Admin Dashboard pages have been implemented with full backend connectivity and real-time Firestore integration:

1. **Settings Page** - Rate limit configuration and feature toggles
2. **Logs Page** - Live audit logs with real-time updates and filtering
3. **Contracts Page** - Contract approval workflow with dual-party notifications

## Implementation Status

### ✅ Completed
- **systemLogService.ts**: Complete system logging with Firestore real-time subscriptions
- **rateLimitService.ts**: 7-day rolling window rate limiting for jobs, services, and applications
- **SettingsPage.tsx**: Rate limit UI with Firestore sync
- **LogsPage.tsx**: Real-time audit logs table with filtering and CSV export
- **ContractsPage.tsx**: Contract audit workflow with approval/rejection
- **jobService.ts**: Enhanced with `createWithRateLimit()` method
- **applicationService.ts**: Enhanced with `createWithRateLimit()` method

### 🔄 Pending

1. **Route Integration** - Add routes to App.tsx
2. **Sidebar Navigation** - Update Super Admin dashboard sidebar
3. **Rate Limit Enforcement Hooks** - Integrate checks into existing job/application creation forms
4. **System Logging Hooks** - Add logAction calls to key user actions

---

## Part 1: Route Integration

### Location: src/App.tsx

Find the super admin routes section and add the three new routes:

```typescript
// In your super admin routes (look for /super-admin/dashboard or similar)
import SuperAdminSettingsPage from './pages/super-admin/SettingsPage';
import SuperAdminLogsPage from './pages/super-admin/LogsPage';
import SuperAdminContractsPage from './pages/super-admin/ContractsPage';

// Add these routes to your super admin protected route group:
{
  path: '/super-admin/settings',
  element: <RoleProtectedRoute allowedRoles={['super-admin']}><SuperAdminSettingsPage /></RoleProtectedRoute>
},
{
  path: '/super-admin/logs',
  element: <RoleProtectedRoute allowedRoles={['super-admin']}><SuperAdminLogsPage /></RoleProtectedRoute>
},
{
  path: '/super-admin/contracts',
  element: <RoleProtectedRoute allowedRoles={['super-admin']}><SuperAdminContractsPage /></RoleProtectedRoute>
},
```

---

## Part 2: Sidebar Navigation

### Location: src/components/Sidebar.tsx or DashboardLayout.tsx

Update the Super Admin sidebar menu items to include new pages:

```typescript
// In the super admin menu section, add:
{
  name: 'Settings',
  icon: <Settings size={20} />,
  path: '/super-admin/settings',
  label: 'Sozlamalar'
},
{
  name: 'Logs',
  icon: <FileText size={20} />,
  path: '/super-admin/logs',
  label: 'Audit Jurnali'
},
{
  name: 'Contracts',
  icon: <FileCheck size={20} />,
  path: '/super-admin/contracts',
  label: 'Shartnomalar'
},
```

---

## Part 3: Rate Limit Enforcement - Job Creation

### Location: Pages that create jobs (e.g., src/pages/employer/PostJobPage.tsx)

Replace the legacy `jobService.create()` with `jobService.createWithRateLimit()`:

```typescript
// OLD (no rate limiting):
const jobId = await jobService.create(jobData);

// NEW (with rate limiting and logging):
import { jobService } from '../../services/jobService';

const result = await jobService.createWithRateLimit(
  jobData,
  globalSettings?.maxJobPostsPerWeek || 5
);

if (!result.success) {
  toast.error(result.error || 'Ish e\'loni yaratishda xatolik');
  return;
}

const jobId = result.jobId;
toast.success('Ish e\'loni muvaffaqiyatli yaratildi');
```

**Note**: `globalSettings` should be fetched from `systemLogService.subscribeGlobalSettings()` on component mount.

---

## Part 4: Rate Limit Enforcement - Application Submission

### Location: Pages that submit applications (e.g., src/pages/JobsPage.tsx, application modal)

Replace the legacy `applicationService.create()` with `applicationService.createWithRateLimit()`:

```typescript
// OLD (no rate limiting):
const applicationId = await applicationService.create(applicationData);

// NEW (with rate limiting and logging):
import { applicationService } from '../../services/applicationService';

const result = await applicationService.createWithRateLimit(
  applicationData,
  globalSettings?.maxApplicationsPerDay || 10
);

if (!result.success) {
  toast.error(result.error || 'Ishtiromi yuborishda xatolik');
  return;
}

const applicationId = result.applicationId;
toast.success('Ishtiromi muvaffaqiyatli yuborildi');
```

---

## Part 5: Fetching Global Settings

### In any page that needs rate limits, subscribe to global settings:

```typescript
import systemLogService from '../../services/systemLogService';

export default function MyPage() {
  const [globalSettings, setGlobalSettings] = useState(null);

  useEffect(() => {
    // Subscribe to real-time global settings
    const unsubscribe = systemLogService.subscribeGlobalSettings((settings) => {
      setGlobalSettings(settings);
    });

    return () => unsubscribe();
  }, []);

  // Now you can use globalSettings.maxJobPostsPerWeek, etc.
  const maxJobs = globalSettings?.maxJobPostsPerWeek || 5;
}
```

---

## Part 6: Additional System Logging Integration

### To enhance audit trail, add logging to key actions:

```typescript
import systemLogService from '../../services/systemLogService';

// When user creates a profile
await systemLogService.logAction(
  'CREATE_PROFILE',
  userId,
  userEmail,
  { name: fullName, phone: phoneNumber, role },
  'info'
);

// When user updates their profile
await systemLogService.logAction(
  'UPDATE_PROFILE',
  userId,
  userEmail,
  { changes: updateFields },
  'info'
);

// When user rejects an application (in ApplyModal or similar)
await systemLogService.logAction(
  'REJECT_APPLICATION',
  employerId,
  employerEmail,
  { applicationId, workerId },
  'info'
);
```

---

## Service Reference

### systemLogService

```typescript
import systemLogService from '../../services/systemLogService';

// Log an action
await systemLogService.logAction(
  action: string,           // e.g., 'POST_JOB', 'APPLY_JOB'
  userId: string,
  userEmail?: string,
  details?: object,
  type: 'info' | 'warning' | 'error' = 'info'
);

// Subscribe to real-time logs (for LogsPage)
const unsubscribe = systemLogService.subscribeLogs(
  limit: number = 100,
  callback: (logs: SystemLog[]) => void
);

// Subscribe to global settings (for SettingsPage and rate limit usage)
const unsubscribe = systemLogService.subscribeGlobalSettings(
  callback: (settings: GlobalSettings) => void
);

// Update global settings
await systemLogService.updateGlobalSettings(
  settings: Partial<GlobalSettings>,
  adminId: string
);
```

### rateLimitService

```typescript
import rateLimitService from '../../services/rateLimitService';

// Check job post limit
const result = await rateLimitService.checkJobPostLimit(
  userId: string,
  maxPosts: number = 5
);
// Returns: { allowed: boolean, currentCount: number, limit: number, message?: string }

// Check application limit
const result = await rateLimitService.checkApplicationLimit(
  userId: string,
  maxApps: number = 10
);

// Check service post limit
const result = await rateLimitService.checkServicePostLimit(
  userId: string,
  maxPosts: number = 3
);

// Log a rate limit violation
await rateLimitService.logRateLimitViolation(
  userId: string,
  type: 'JOB_POST' | 'APPLICATION' | 'SERVICE_POST',
  details?: object
);
```

---

## Firestore Collections Reference

### system_logs
```
system_logs/{logId}
  - timestamp: Timestamp
  - action: string ('POST_JOB', 'APPLY_JOB', 'APPROVE_CONTRACT', etc.)
  - userId: string
  - userEmail?: string
  - details: object
  - type: 'info' | 'warning' | 'error'
```

### settings
```
settings/global_config
  - maxJobPostsPerWeek: number (default: 5)
  - maxServicePostsPerWeek: number (default: 3)
  - maxApplicationsPerDay: number (default: 10)
  - enableNotifications: boolean
  - enableModeration: boolean
  - maintenanceMode: boolean
  - updatedAt: Timestamp
  - updatedBy: string
```

### contracts (existing, enhanced for audit)
```
contracts/{contractId}
  - ishchi: { id, name, email, phone }
  - ish_beruvchi: { id, name, email, phone }
  - jobId: string
  - jobTitle: string
  - amount: number
  - currency: string
  - startDate: Timestamp
  - endDate?: Timestamp
  - adminApproved: 'pending' | 'approved' | 'rejected'
  - signatures: { worker?, employer? }
  - termsAccepted: boolean
  - createdAt: Timestamp
  - updatedAt: Timestamp
```

---

## Testing Checklist

- [ ] Routes added to App.tsx
- [ ] Sidebar navigation updated
- [ ] Can navigate to /super-admin/settings
- [ ] Can navigate to /super-admin/logs
- [ ] Can navigate to /super-admin/contracts
- [ ] Settings page loads and syncs with Firestore
- [ ] Logs page shows real-time entries
- [ ] Can approve/reject contracts with notifications
- [ ] Rate limits enforced in job creation
- [ ] Rate limits enforced in application submission
- [ ] System logs recorded for key actions
- [ ] CSV export works on Logs page

---

## Environment Variables

Verify these are in your .env file:

```
VITE_SUPER_ADMIN_PHONE="+998900707081"
VITE_SUPER_ADMIN_PASSWORD="Hur_135642"
VITE_SUPER_ADMIN_EMAIL="superadmin@qulay-ish.local"
```

---

## Troubleshooting

### Logs page shows no data
- Check that `systemLogService.logAction()` is being called
- Verify Firestore `system_logs` collection has documents
- Check browser console for subscription errors

### Settings changes not persisting
- Verify Super Admin email matches environment variable
- Check Firestore `settings/global_config` document exists
- Enable Firestore rules for Super Admin user

### Contracts page shows "Shartnomalar topilmadi"
- Check Firestore `contracts` collection for documents
- Verify collection has `adminApproved` field on all docs
- Check browser console for Firestore permission errors

### Rate limit not blocking
- Verify `createWithRateLimit()` is being called instead of `create()`
- Check `globalSettings` is being fetched correctly
- Verify Firestore rules allow reading from `jobs` collection

---

## Production Deployment Notes

1. **Update Super Admin Credentials**: Replace `VITE_SUPER_ADMIN_PASSWORD` and phone with production values
2. **Set Up Firestore Rules**: Ensure Super Admin user has write access to `system_logs`, `settings/global_config`, and can update contracts
3. **Monitor Audit Logs**: Regularly check logs page for suspicious activity
4. **Backup Settings**: Export global settings before major updates
5. **Enable Notifications**: Ensure Firebase Cloud Messaging is configured for contract notifications

---

## Support

For issues or questions:
1. Check Firestore permissions are correctly configured
2. Verify all environment variables are set
3. Check browser console and Firestore logs for errors
4. Ensure collections exist with proper indexes
