import { Job } from '../types';

export const DEMO_JOBS: Job[] = [
  // Toshkent
  {
    id: 'demo-1',
    employerId: 'demo-employer-1',
    title: 'Hovli tozalash va tartibga keltirish',
    description: 'Katta hovlini tozalash, barglarni yigʻish va gullarni sugʻorish kerak. Ish bir martalik.',
    category: 'cleaner',
    price: 150000,
    region: 'Samarqand viloyati',
    district: 'Samarqand shahri',
    neighborhood: 'Bogʻishamol',
    workType: 'one-time',
    requirements: ['Ishga masʻuliyatli yondashish, Oʻz vaqtida kelish'],
    status: 'open',
    createdAt: { seconds: Math.floor(Date.now() / 1000) - 3600, nanoseconds: 0 } as any
  },
  {
    id: 'demo-2',
    employerId: 'demo-employer-2',
    title: 'Enaga (Nanny) kerak',
    description: '3 yoshli bolaga qarab turish uchun tajribali enaga kerak. Ish vaqti 09:00 dan 18:00 gacha.',
    category: 'nanny',
    price: 3000000,
    region: 'Samarqand viloyati',
    district: 'Samarqand shahri',
    neighborhood: 'Oqtepa',
    workType: 'full-time',
    requirements: ['Kamida 2 yil tajriba, Pedagogik maʻlumot boʻlsa yaxshi'],
    status: 'open',
    createdAt: { seconds: Math.floor(Date.now() / 1000) - 7200, nanoseconds: 0 } as any
  },
  // Samarqand
  {
    id: 'demo-3',
    employerId: 'demo-employer-3',
    title: 'Uy oshpazi kerak',
    description: 'Oilaviy tadbir uchun milliy taomlar tayyorlaydigan oshpaz kerak.',
    category: 'cook',
    price: 500000,
    region: 'Samarqand viloyati',
    district: 'Samarqand shahri',
    neighborhood: 'Siyob',
    workType: 'one-time',
    requirements: ['Milliy taomlarni yaxshi bilish, Tozalikka rioya qilish'],
    status: 'open',
    createdAt: { seconds: Math.floor(Date.now() / 1000) - 10800, nanoseconds: 0 } as any
  },
  // Farg'ona
  {
    id: 'demo-4',
    employerId: 'demo-employer-4',
    title: 'Tikuvchi (Seamstress) kerak',
    description: 'Yangi ochilgan sexga tajribali tikuvchilar taklif etiladi.',
    category: 'seamstress',
    price: 2500000,
    region: 'Samarqand viloyati',
    district: 'Pastdargʻom',
    neighborhood: 'Ipakchi',
    workType: 'full-time',
    requirements: ['Tikuv mashinasida ishlash tajribasi, Tezkorlik'],
    status: 'open',
    createdAt: { seconds: Math.floor(Date.now() / 1000) - 14400, nanoseconds: 0 } as any
  },
  // Buxoro
  {
    id: 'demo-5',
    employerId: 'demo-employer-5',
    title: 'Ingliz tili repetitori',
    description: 'Maktab oʻquvchisiga haftada 3 marta ingliz tili darslari oʻtish kerak.',
    category: 'tutor',
    price: 800000,
    region: 'Samarqand viloyati',
    district: 'Samarqand shahri',
    neighborhood: 'Eski shahar',
    workType: 'recurring',
    requirements: ['IELTS 7.0+, Bolalar bilan ishlash tajribasi'],
    status: 'open',
    createdAt: { seconds: Math.floor(Date.now() / 1000) - 18000, nanoseconds: 0 } as any
  },
  // Namangan
  {
    id: 'demo-6',
    employerId: 'demo-employer-6',
    title: 'Gullar parvarishi boʻyicha yordamchi',
    description: 'Issiqxonada gullarni sugʻorish va parvarish qilish uchun yordamchi kerak.',
    category: 'florist',
    price: 1200000,
    region: 'Samarqand viloyati',
    district: 'Samarqand shahri',
    neighborhood: 'Guliston',
    workType: 'recurring',
    requirements: ['Gullarni sevish, Mehnatsevarlik'],
    status: 'open',
    createdAt: { seconds: Math.floor(Date.now() / 1000) - 21600, nanoseconds: 0 } as any
  },
  // Andijon
  {
    id: 'demo-7',
    employerId: 'demo-employer-7',
    title: 'Kasalga qarovchi (Caregiver)',
    description: 'Katta yoshli ayolga qarab turish va dori-darmonlarini berish kerak.',
    category: 'caregiver',
    price: 2000000,
    region: 'Samarqand viloyati',
    district: 'Samarqand shahri',
    neighborhood: 'Mustaqillik',
    workType: 'full-time',
    requirements: ['Tibbiy bilimlar, Sabr-toqatli boʻlish'],
    status: 'open',
    createdAt: { seconds: Math.floor(Date.now() / 1000) - 25200, nanoseconds: 0 } as any
  },
  // Qashqadaryo
  {
    id: 'demo-8',
    employerId: 'demo-employer-8',
    title: 'Uy yordamchisi',
    description: 'Haftada 2 marta uyni tozalash va dazmol qilish kerak.',
    category: 'cleaner',
    price: 200000,
    region: 'Samarqand viloyati',
    district: 'Samarqand shahri',
    neighborhood: 'Nasaf',
    workType: 'recurring',
    requirements: ['Tozalikka eʻtiborli boʻlish, Halollik'],
    status: 'open',
    createdAt: { seconds: Math.floor(Date.now() / 1000) - 28800, nanoseconds: 0 } as any
  },
  // Surxondaryo
  {
    id: 'demo-9',
    employerId: 'demo-employer-9',
    title: 'Bogʻbon kerak',
    description: 'Meva bogʻini parvarish qilish va daraxtlarni butash kerak.',
    category: 'florist',
    price: 1500000,
    region: 'Samarqand viloyati',
    district: 'Samarqand shahri',
    neighborhood: 'Jayhun',
    workType: 'recurring',
    requirements: ['Bogʻdorchilik tajribasi, Mehnatsevarlik'],
    status: 'open',
    createdAt: { seconds: Math.floor(Date.now() / 1000) - 32400, nanoseconds: 0 } as any
  },
  // Jizzax
  {
    id: 'demo-10',
    employerId: 'demo-employer-10',
    title: 'Matematika repetitori',
    description: 'Abituriyentni oliy oʻquv yurtiga tayyorlash kerak.',
    category: 'tutor',
    price: 1000000,
    region: 'Samarqand viloyati',
    district: 'Samarqand shahri',
    neighborhood: 'Zargarlik',
    workType: 'recurring',
    requirements: ['Kuchli bilim, Oʻqitish tajribasi'],
    status: 'open',
    createdAt: { seconds: Math.floor(Date.now() / 1000) - 36000, nanoseconds: 0 } as any
  },
  // Navoiy
  {
    id: 'demo-11',
    employerId: 'demo-employer-11',
    title: 'Ofis tozalovchisi',
    description: 'Har kuni ertalab ofisni tozalash kerak.',
    category: 'cleaner',
    price: 1200000,
    region: 'Samarqand viloyati',
    district: 'Samarqand shahri',
    neighborhood: 'Gʻalaba',
    workType: 'full-time',
    requirements: ['Masʻuliyat, Tozalikka rioya qilish'],
    status: 'open',
    createdAt: { seconds: Math.floor(Date.now() / 1000) - 39600, nanoseconds: 0 } as any
  },
  // Xorazm
  {
    id: 'demo-12',
    employerId: 'demo-employer-12',
    title: 'Milliy taomlar oshpazi',
    description: 'Xiva milliy taomlarini tayyorlaydigan oshpaz kerak.',
    category: 'cook',
    price: 3000000,
    region: 'Samarqand viloyati',
    district: 'Samarqand shahri',
    neighborhood: 'Ichan Qala',
    workType: 'full-time',
    requirements: ['Xiva taomlarini bilish, Tajriba'],
    status: 'open',
    createdAt: { seconds: Math.floor(Date.now() / 1000) - 43200, nanoseconds: 0 } as any
  }
];
