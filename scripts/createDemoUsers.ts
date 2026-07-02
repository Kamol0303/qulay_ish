/**
 * Create predefined demo users in Firestore
 * Run this once: npx ts-node scripts/createDemoUsers.ts
 */

import { db } from '../src/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

const DEMO_USERS = [
  {
    uid: 'demo_worker_001',
    fullName: 'Ishchi Demo',
    email: 'demo@ishchi.uz',
    phoneNumber: '+998901234567',
    role: 'worker',
  },
  {
    uid: 'demo_employer_001',
    fullName: 'Ish Beruvchi Demo',
    email: 'demo@employer.uz',
    phoneNumber: '+998901234568',
    role: 'employer',
  },
];

async function createDemoUsers() {
  console.log('🚀 Demo users yaratilmoqda...');

  try {
    for (const user of DEMO_USERS) {
      const profileRef = doc(db, 'profiles', user.uid);

      const profileData = {
        ...user,
        region: 'Samarqand',
        district: '',
        neighborhood: '',
        bio: 'Demo test akkaunt',
        skills: user.role === 'worker' ? [] : undefined,
        isVerified: false,
        verificationStatus: 'pending',
        status: 'active',
        rating: 0,
        reviewCount: 0,
        completedJobs: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastActive: serverTimestamp(),
      };

      await setDoc(profileRef, profileData);
      console.log(`✅ ${user.role} created: ${user.email}`);
    }

    console.log('✨ Barcha demo users tayyor!');
  } catch (error) {
    console.error('❌ Xatolik:', error);
  }
}

createDemoUsers();
