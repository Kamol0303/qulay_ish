#!/usr/bin/env tsx

/**
 * MIGRATION SCRIPT: Add passwords to existing demo users
 * 
 * This script:
 * 1. Finds all users without passwordHash
 * 2. Generates temporary password: TempPass123
 * 3. Hashes password with bcrypt
 * 4. Updates profile with passwordHash
 * 5. Logs credentials for admin notification
 * 
 * Run: npm run migrate:passwords
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, updateDoc, query, where } from 'firebase/firestore';
import bcrypt from 'bcryptjs';

// Firebase config - update with your production config
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || "AIzaSyCg0p8UOPAoe6WmhCRCbEBntCcL026w25o",
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || "gen-lang-client-0528497200.firebaseapp.com",
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || "gen-lang-client-0528497200",
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || "gen-lang-client-0528497200.firebasestorage.app",
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "519605089294",
  appId: process.env.VITE_FIREBASE_APP_ID || "1:519605089294:web:ee4f72e5d340748e8cb85f",
};

const TEMP_PASSWORD = 'TempPass123'; // Temporary password for all users
const SALT_ROUNDS = 10;

async function migratePasswords() {
  console.log('🚀 Starting password migration...\n');

  // Initialize Firebase
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);

  try {
    // Get all profiles
    const profilesRef = collection(db, 'profiles');
    const snapshot = await getDocs(profilesRef);

    console.log(`📊 Found ${snapshot.size} total profiles\n`);

    let migratedCount = 0;
    let skippedCount = 0;
    const credentials: Array<{ phone: string; email: string; password: string }> = [];

    // Hash the temporary password once
    const passwordHash = await bcrypt.hash(TEMP_PASSWORD, SALT_ROUNDS);
    console.log('🔐 Temporary password hashed\n');

    // Process each profile
    for (const docSnap of snapshot.docs) {
      const profile = docSnap.data();
      const uid = docSnap.id;

      // Skip if already has password or is super admin
      if (profile.passwordHash || profile.role === 'super_admin') {
        skippedCount++;
        continue;
      }

      // Update profile with passwordHash
      await updateDoc(doc(db, 'profiles', uid), {
        passwordHash,
      });

      credentials.push({
        phone: profile.phoneNumber || 'N/A',
        email: profile.email || 'N/A',
        password: TEMP_PASSWORD,
      });

      migratedCount++;
      console.log(`✅ Migrated: ${profile.fullName} (${profile.phoneNumber})`);
    }

    console.log('\n' + '='.repeat(60));
    console.log('📈 MIGRATION COMPLETE');
    console.log('='.repeat(60));
    console.log(`✅ Migrated: ${migratedCount} profiles`);
    console.log(`⏭️  Skipped: ${skippedCount} profiles (already have passwords)`);
    console.log('='.repeat(60));

    if (credentials.length > 0) {
      console.log('\n📧 SEND THESE CREDENTIALS TO USERS:\n');
      console.log('Temporary Password: ' + TEMP_PASSWORD);
      console.log('\nUsers:');
      credentials.forEach((cred, idx) => {
        console.log(`${idx + 1}. Phone: ${cred.phone} | Email: ${cred.email}`);
      });
      console.log('\n⚠️  Users must change their password on first login!');
    }

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }

  console.log('\n✅ Migration script completed successfully!\n');
  process.exit(0);
}

// Run migration
migratePasswords();
