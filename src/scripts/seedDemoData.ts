import { debugLogger } from '../../lib/debugLogger';
import { db } from '../firebase';
import { collection, addDoc, setDoc, doc, Timestamp } from 'firebase/firestore';

// Demo Workers
const DEMO_WORKERS = [
  {
    uid: 'demo-worker-1',
    fullName: 'Malika Karimova',
    email: 'malika.karimova@demo.uz',
    phoneNumber: '+998901234501',
    role: 'worker',
    region: 'Samarqand viloyati',
    district: 'Samarqand shahri',
    neighborhood: 'Bogʻishamol',
    bio: '5 yillik tajribaga ega professional tozalovchi. Uylarni, ofislarni tozalashda mutaxassis.',
    skills: ['house_cleaning', 'cooking'],
    experienceLevel: 'professional',
    rating: 4.8,
    reviewCount: 24,
    completedJobs: 45,
    isVerified: true,
    verificationStatus: 'verified',
    createdAt: Timestamp.now()
  },
  {
    uid: 'demo-worker-2',
    fullName: 'Dilnoza Rahimova',
    email: 'dilnoza.rahimova@demo.uz',
    phoneNumber: '+998901234502',
    role: 'worker',
    region: 'Samarqand viloyati',
    district: 'Samarqand shahri',
    neighborhood: 'Siyob',
    bio: 'Bolalarga qarash va ularni rivojlantirish bo\'yicha 3 yillik tajriba.',
    skills: ['babysitting', 'english'],
    experienceLevel: 'intermediate',
    rating: 4.9,
    reviewCount: 18,
    completedJobs: 32,
    isVerified: true,
    verificationStatus: 'verified',
    createdAt: Timestamp.now()
  },
  {
    uid: 'demo-worker-3',
    fullName: 'Nodira Toshmatova',
    email: 'nodira.toshmatova@demo.uz',
    phoneNumber: '+998901234503',
    role: 'worker',
    region: 'Samarqand viloyati',
    district: 'Urgut',
    neighborhood: 'Markaz',
    bio: 'Milliy taomlar tayyorlashda professional oshpaz. To\'ylar va tadbirlar uchun.',
    skills: ['cooking', 'confectionery'],
    experienceLevel: 'professional',
    rating: 5.0,
    reviewCount: 31,
    completedJobs: 58,
    isVerified: true,
    verificationStatus: 'verified',
    createdAt: Timestamp.now()
  },
  {
    uid: 'demo-worker-4',
    fullName: 'Zarina Abdullayeva',
    email: 'zarina.abdullayeva@demo.uz',
    phoneNumber: '+998901234504',
    role: 'worker',
    region: 'Samarqand viloyati',
    district: 'Samarqand shahri',
    neighborhood: 'Mustaqillik',
    bio: 'Tikuvchilik va dizayn bo\'yicha 7 yillik tajriba. Har qanday kiyim tikaman.',
    skills: ['sewing', 'knitting'],
    experienceLevel: 'expert',
    rating: 4.7,
    reviewCount: 42,
    completedJobs: 89,
    isVerified: true,
    verificationStatus: 'verified',
    createdAt: Timestamp.now()
  },
  {
    uid: 'demo-worker-5',
    fullName: 'Feruza Yusupova',
    email: 'feruza.yusupova@demo.uz',
    phoneNumber: '+998901234505',
    role: 'worker',
    region: 'Samarqand viloyati',
    district: 'Kattaqoʻrgʻon',
    neighborhood: 'Yangi shahar',
    bio: 'Ingliz tili va matematika repetitori. IELTS 7.5 sertifikatiga egaman.',
    skills: ['english', 'math'],
    experienceLevel: 'professional',
    rating: 4.9,
    reviewCount: 27,
    completedJobs: 54,
    isVerified: true,
    verificationStatus: 'verified',
    createdAt: Timestamp.now()
  },
  {
    uid: 'demo-worker-6',
    fullName: 'Gulnora Sharipova',
    email: 'gulnora.sharipova@demo.uz',
    phoneNumber: '+998901234506',
    role: 'worker',
    region: 'Samarqand viloyati',
    district: 'Samarqand shahri',
    neighborhood: 'Oqtepa',
    bio: 'Katta yoshli odamlarga qarash va tibbiy yordam ko\'rsatish tajribasi bor.',
    skills: ['house_cleaning'],
    experienceLevel: 'intermediate',
    rating: 4.6,
    reviewCount: 15,
    completedJobs: 28,
    isVerified: false,
    verificationStatus: 'pending',
    createdAt: Timestamp.now()
  },
  {
    uid: 'demo-worker-7',
    fullName: 'Sevara Alimova',
    email: 'sevara.alimova@demo.uz',
    phoneNumber: '+998901234507',
    role: 'worker',
    region: 'Samarqand viloyati',
    district: 'Pastdargʻom',
    neighborhood: 'Ipakchi',
    bio: 'Manikyur, pedikyur va makiyaj xizmatlari. Uyga chiqaman.',
    skills: ['manicure', 'makeup'],
    experienceLevel: 'intermediate',
    rating: 4.8,
    reviewCount: 22,
    completedJobs: 41,
    isVerified: true,
    verificationStatus: 'verified',
    createdAt: Timestamp.now()
  },
  {
    uid: 'demo-worker-8',
    fullName: 'Madina Ergasheva',
    email: 'madina.ergasheva@demo.uz',
    phoneNumber: '+998901234508',
    role: 'worker',
    region: 'Samarqand viloyati',
    district: 'Samarqand shahri',
    neighborhood: 'Guliston',
    bio: 'Gullar parvarishi va bog\'dorchilik bo\'yicha mutaxassis.',
    skills: ['house_cleaning'],
    experienceLevel: 'beginner',
    rating: 4.5,
    reviewCount: 8,
    completedJobs: 12,
    isVerified: false,
    verificationStatus: 'none',
    createdAt: Timestamp.now()
  },
  {
    uid: 'demo-worker-9',
    fullName: 'Nigora Saidova',
    email: 'nigora.saidova@demo.uz',
    phoneNumber: '+998901234509',
    role: 'worker',
    region: 'Samarqand viloyati',
    district: 'Jomboy',
    neighborhood: 'Markaz',
    bio: 'Rus tili va adabiyot o\'qituvchisi. Maktabgacha va maktab yoshidagi bolalarga dars beraman.',
    skills: ['russian'],
    experienceLevel: 'professional',
    rating: 4.9,
    reviewCount: 19,
    completedJobs: 36,
    isVerified: true,
    verificationStatus: 'verified',
    createdAt: Timestamp.now()
  },
  {
    uid: 'demo-worker-10',
    fullName: 'Shoira Nurmatova',
    email: 'shoira.nurmatova@demo.uz',
    phoneNumber: '+998901234510',
    role: 'worker',
    region: 'Samarqand viloyati',
    district: 'Bulungʻur',
    neighborhood: 'Qishloq',
    bio: 'Kandolatchilik va tortlar tayyorlash. Buyurtmaga ishlash.',
    skills: ['confectionery', 'cooking'],
    experienceLevel: 'intermediate',
    rating: 4.7,
    reviewCount: 14,
    completedJobs: 25,
    isVerified: false,
    verificationStatus: 'pending',
    createdAt: Timestamp.now()
  }
];

// Demo Employers
const DEMO_EMPLOYERS = [
  {
    uid: 'demo-employer-1',
    fullName: 'Aziz Rahmonov',
    email: 'aziz.rahmonov@demo.uz',
    phoneNumber: '+998901234601',
    role: 'employer',
    region: 'Samarqand viloyati',
    district: 'Samarqand shahri',
    neighborhood: 'Bogʻishamol',
    bio: 'Oilaviy tadbirlar uchun xizmatlar kerak.',
    isVerified: true,
    verificationStatus: 'verified',
    createdAt: Timestamp.now()
  },
  {
    uid: 'demo-employer-2',
    fullName: 'Jamshid Tursunov',
    email: 'jamshid.tursunov@demo.uz',
    phoneNumber: '+998901234602',
    role: 'employer',
    region: 'Samarqand viloyati',
    district: 'Samarqand shahri',
    neighborhood: 'Siyob',
    bio: 'Restoran egasi. Doimiy oshpazlar kerak.',
    isVerified: true,
    verificationStatus: 'verified',
    createdAt: Timestamp.now()
  },
  {
    uid: 'demo-employer-3',
    fullName: 'Sardor Karimov',
    email: 'sardor.karimov@demo.uz',
    phoneNumber: '+998901234603',
    role: 'employer',
    region: 'Samarqand viloyati',
    district: 'Urgut',
    neighborhood: 'Markaz',
    bio: 'Ofis tozalash xizmatlari kerak.',
    isVerified: true,
    verificationStatus: 'verified',
    createdAt: Timestamp.now()
  },
  {
    uid: 'demo-employer-4',
    fullName: 'Otabek Mirzayev',
    email: 'otabek.mirzayev@demo.uz',
    phoneNumber: '+998901234604',
    role: 'employer',
    region: 'Samarqand viloyati',
    district: 'Samarqand shahri',
    neighborhood: 'Mustaqillik',
    bio: 'Bolalarimga ingliz tili repetitori kerak.',
    isVerified: false,
    verificationStatus: 'none',
    createdAt: Timestamp.now()
  },
  {
    uid: 'demo-employer-5',
    fullName: 'Rustam Abdullayev',
    email: 'rustam.abdullayev@demo.uz',
    phoneNumber: '+998901234605',
    role: 'employer',
    region: 'Samarqand viloyati',
    district: 'Kattaqoʻrgʻon',
    neighborhood: 'Yangi shahar',
    bio: 'Tikuvchilar kerak. Katta buyurtma bor.',
    isVerified: true,
    verificationStatus: 'verified',
    createdAt: Timestamp.now()
  }
];

// Demo Jobs
const DEMO_JOBS = [
  {
    employerId: 'demo-employer-1',
    employerName: 'Aziz Rahmonov',
    title: 'Uy tozalash kerak',
    description: 'Katta uyni tozalash. 3 xona, oshxona, hammom. Haftada 2 marta.',
    category: 'cleaner',
    region: 'Samarqand viloyati',
    district: 'Samarqand shahri',
    neighborhood: 'Bogʻishamol',
    price: 200000,
    workType: 'recurring',
    status: 'open',
    requirements: ['Tajriba talab qilinadi', 'Tozalikka eʻtiborli boʻlish'],
    createdAt: Timestamp.now()
  },
  {
    employerId: 'demo-employer-2',
    employerName: 'Jamshid Tursunov',
    title: 'Restoranga oshpaz kerak',
    description: 'Milliy taomlar tayyorlaydigan tajribali oshpaz. Doimiy ish.',
    category: 'cook',
    region: 'Samarqand viloyati',
    district: 'Samarqand shahri',
    neighborhood: 'Siyob',
    price: 3500000,
    workType: 'full-time',
    status: 'open',
    requirements: ['Kamida 3 yil tajriba', 'Milliy taomlarni bilish'],
    createdAt: Timestamp.now()
  },
  {
    employerId: 'demo-employer-3',
    employerName: 'Sardor Karimov',
    title: 'Ofis tozalovchisi',
    description: 'Har kuni ertalab ofisni tozalash. 08:00-10:00',
    category: 'cleaner',
    region: 'Samarqand viloyati',
    district: 'Urgut',
    neighborhood: 'Markaz',
    price: 1500000,
    workType: 'full-time',
    status: 'open',
    requirements: ['Masʻuliyatli boʻlish', 'Vaqtida kelish'],
    createdAt: Timestamp.now()
  },
  {
    employerId: 'demo-employer-4',
    employerName: 'Otabek Mirzayev',
    title: 'Ingliz tili repetitori',
    description: '10 yoshli bolaga ingliz tili darslari. Haftada 3 marta.',
    category: 'tutor',
    region: 'Samarqand viloyati',
    district: 'Samarqand shahri',
    neighborhood: 'Mustaqillik',
    price: 800000,
    workType: 'recurring',
    status: 'open',
    requirements: ['IELTS 6.0+', 'Bolalar bilan ishlash tajribasi'],
    createdAt: Timestamp.now()
  },
  {
    employerId: 'demo-employer-5',
    employerName: 'Rustam Abdullayev',
    title: 'Tikuvchilar kerak',
    description: 'Katta buyurtma uchun 5 ta tikuvchi kerak. 2 oylik ish.',
    category: 'seamstress',
    region: 'Samarqand viloyati',
    district: 'Kattaqoʻrgʻon',
    neighborhood: 'Yangi shahar',
    price: 2800000,
    workType: 'full-time',
    status: 'open',
    requirements: ['Tikuv mashinasida ishlash', 'Tezkorlik'],
    createdAt: Timestamp.now()
  }
];

export async function seedDemoData() {
  try {
    debugLogger.log('Starting demo data seeding...');

    for (const worker of DEMO_WORKERS) {
      await setDoc(doc(db, 'profiles', worker.uid), worker);
      debugLogger.log(`Created worker: ${worker.fullName}`);
    }

    for (const employer of DEMO_EMPLOYERS) {
      await setDoc(doc(db, 'profiles', employer.uid), employer);
      debugLogger.log(`Created employer: ${employer.fullName}`);
    }

    for (const job of DEMO_JOBS) {
      await addDoc(collection(db, 'jobs'), job);
      debugLogger.log(`Created job: ${job.title}`);
    }

    debugLogger.log('Demo data seeding completed successfully!');
    return { success: true, message: 'Demo data created successfully' };
  } catch (error) {
    debugLogger.error('Error seeding demo data:', error);
    return { success: false, error };
  }
}
