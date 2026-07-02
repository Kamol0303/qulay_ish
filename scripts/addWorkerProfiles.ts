import { initializeApp } from 'firebase/app';
import { getFirestore, collection, setDoc, doc } from 'firebase/firestore';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env.local') });

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const workers = [
  {
    fullName: 'Dilnoza Rahimova',
    district: 'Samarqand',
    skills: ['Tikuvchilik', 'Libos tikish', 'Ko\'ylak tikish', 'Parda tikish', 'Naqsh chizish'],
    bio: '10 yillik tajribaga ega professional tikuvchi. Har qanday libosni sifatli tikaman. Milliy va zamonaviy uslublarni bilaman.',
    rating: 4.8,
    reviewCount: 45,
    completedJobs: 87
  },
  {
    fullName: 'Gulnora Karimova',
    district: 'Urgut',
    skills: ['Uy tozalash', 'Ovqat pishirish', 'Kir yuvish', 'Dazmollash', 'Umumiy tozalash'],
    bio: 'Uy ishlarida 8 yillik tajriba. Toza va tartibli ishlashni yaxshi ko\'raman. Mas\'uliyatli va ishonchli.',
    rating: 4.6,
    reviewCount: 38,
    completedJobs: 92
  },
  {
    fullName: 'Zarina Tursunova',
    district: 'Jomboy',
    skills: ['Bolalarga qarash', 'O\'qitish', 'O\'yin o\'rgatish', 'Ovqat pishirish', 'Uy tozalash'],
    bio: 'Bolalarga qarashda 5 yillik tajriba. Pedagogik ma\'lumotim bor. Mehribon va mas\'uliyatli. Bolalar bilan ishlashni yaxshi ko\'raman.',
    rating: 4.9,
    reviewCount: 52,
    completedJobs: 68
  },
  {
    fullName: 'Malika Yusupova',
    district: 'Kattaqo\'rg\'on',
    skills: ['To\'qimachilik', 'Igna ishi', 'Qo\'l san\'ati', 'Paypoq to\'qish', 'Sviter to\'qish'],
    bio: 'To\'qimachilik san\'atini mukammal bilaman. 12 yillik tajriba. Har xil mahsulotlar tayyorlayman. Buyurtmalar qabul qilaman.',
    rating: 4.7,
    reviewCount: 41,
    completedJobs: 76
  },
  {
    fullName: 'Nodira Azimova',
    district: 'Narpay',
    skills: ['Soch turmaklash', 'Makiyaj', 'Manikür', 'Soch bo\'yash', 'Soch olish'],
    bio: 'Professional sartarosh va stilist. Zamonaviy va klassik uslublarni bilaman. 7 yillik tajriba. Uyga chiqaman.',
    rating: 4.8,
    reviewCount: 63,
    completedJobs: 124
  },
  {
    fullName: 'Sevara Mahmudova',
    district: 'Oqdaryo',
    skills: ['Ovqat pishirish', 'Milliy taomlar', 'Shirinliklar', 'Osh pishirish', 'Tort pishirish'],
    bio: 'Milliy taomlarni juda mazali pishiraman. 15 yillik tajriba. To\'ylar va tadbirlarga buyurtma qabul qilaman.',
    rating: 4.9,
    reviewCount: 71,
    completedJobs: 143
  },
  {
    fullName: 'Feruza Saidova',
    district: 'Toyloq',
    skills: ['Tikuvchilik', 'Libos dizayni', 'Naqsh chizish', 'Ko\'rpa-to\'shak tikish', 'Uy tekstili'],
    bio: 'Libos dizayni va tikuvchilikda mutaxassis. Kreativ yondashaman. Individual buyurtmalar qabul qilaman.',
    rating: 4.7,
    reviewCount: 34,
    completedJobs: 59
  },
  {
    fullName: 'Kamola Ibragimova',
    district: 'Paxtachi',
    skills: ['Uy tozalash', 'Oyna yuvish', 'Umumiy tozalash', 'Ofis tozalash', 'Kir yuvish'],
    bio: 'Uy va ofislarni professional darajada tozalayman. 6 yillik tajriba. Tez va sifatli ishlayman.',
    rating: 4.6,
    reviewCount: 47,
    completedJobs: 98
  },
  {
    fullName: 'Dilfuza Nurmatova',
    district: 'Payariq',
    skills: ['Igna ishi', 'Bisser ishi', 'Qo\'l san\'ati', 'Kashtachilik', 'Naqsh solish'],
    bio: 'Qo\'l san\'ati va igna ishida professional. Noyob mahsulotlar yarataman. O\'rgataman ham. 9 yillik tajriba.',
    rating: 4.8,
    reviewCount: 29,
    completedJobs: 54
  },
  {
    fullName: 'Munira Alimova',
    district: 'Bulung\'ur',
    skills: ['Ovqat pishirish', 'Tort pishirish', 'Shirinliklar', 'Milliy taomlar', 'Uy tozalash'],
    bio: 'Tort va shirinliklar tayyorlashda mutaxassis. To\'y va tadbirlarga buyurtma qabul qilaman. 11 yillik tajriba.',
    rating: 4.9,
    reviewCount: 58,
    completedJobs: 102
  }
];

async function addWorkers() {
  console.log('🚀 Adding 10 female worker profiles to Firestore...\n');

  for (let i = 0; i < workers.length; i++) {
    const worker = workers[i];
    const uid = `worker_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 9)}`;
    
    const profile = {
      uid,
      fullName: worker.fullName,
      email: `${worker.fullName.toLowerCase().replace(/\s+/g, '')}@worker.uz`,
      phoneNumber: `+998 ${90 + Math.floor(Math.random() * 9)} ${Math.floor(Math.random() * 900) + 100} ${Math.floor(Math.random() * 90) + 10} ${Math.floor(Math.random() * 90) + 10}`,
      role: 'worker',
      region: 'Samarqand viloyati',
      district: worker.district,
      bio: worker.bio,
      skills: worker.skills,
      photoUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(worker.fullName)}&background=random&size=200`,
      experienceLevel: worker.completedJobs > 80 ? 'expert' : 'intermediate',
      isPremium: worker.rating >= 4.8,
      rating: worker.rating,
      reviewCount: worker.reviewCount,
      completedJobs: worker.completedJobs,
      isVerified: worker.rating >= 4.7,
      verificationStatus: worker.rating >= 4.7 ? 'verified' : 'none',
      trustScore: Math.floor(worker.rating * 20),
      violationCount: 0,
      riskScore: 0,
      isBlocked: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastActive: new Date().toISOString()
    };

    try {
      await setDoc(doc(db, 'profiles', uid), profile);
      console.log(`✅ ${i + 1}/10 - Added: ${worker.fullName} (${worker.district}) - ${worker.skills[0]}`);
      await new Promise(resolve => setTimeout(resolve, 300));
    } catch (error) {
      console.error(`❌ Error adding ${worker.fullName}:`, error.message);
    }
  }

  console.log('\n🎉 Successfully added 10 worker profiles!');
  process.exit(0);
}

addWorkers();
