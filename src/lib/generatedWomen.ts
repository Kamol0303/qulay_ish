import type { Profile } from '../types';

/** How many different women each filter button shows. */
export const FEMALE_FILTER_COUNTS = {
  'price-low': 10,
  'price-high': 8,
  nearest: 9,
  farthest: 13,
} as const;

export type FemaleFilterSort = keyof typeof FEMALE_FILTER_COUNTS;

const FIRST_NAMES = [
  'Nodira', 'Madina', 'Gulchehra', 'Zilola', 'Nigora', 'Dilnoza', 'Sevara', 'Malika',
  'Shahnoza', 'Feruza', 'Dilfuza', 'Barno', 'Mohira', 'Aziza', 'Kamola', 'Saodat',
  'Munisa', 'Rayhona', 'Oydin', 'Shahzoda', 'Yulduz', 'Nilufar', 'Dildora', 'Gulnora',
  'Maftuna', 'Zarina', 'Laylo', 'Asal', 'Diyora', 'Sabina', 'Iroda', 'Nargiza',
  'Umida', 'Muhayyo', 'Sitora', 'Gulsanam', 'Marjona', 'Dilbar', 'Shoira', 'Madinabonu',
];

const LAST_NAMES = [
  'Karimova', 'Giyasova', 'Ergasheva', 'Usmonova', 'Rahimova', 'Yoʻldosheva', 'Abdullayeva',
  'Ismoilova', 'Qodirova', 'Norboyeva', 'Saidova', 'Jalolova', 'Bozorova', 'Mirzayeva',
  'Tursunova', 'Berdiyeva', 'Ochilova', 'Xolmatova', 'Sattorova', 'Eshonqulova',
  'Tojiyeva', 'Nurmatova', 'Qosimova', 'Hakimova', 'Rustamova', 'Sharipova', 'Boboyeva',
  'Alimova', 'Fayzullayeva', 'Joʻrayeva', 'Poʻlatova', 'Xudoyberdiyeva', 'Mamatqulova',
  'Sodiqova', 'Olimova', 'Teshaboyeva', 'Valiyeva', 'Gʻaniyeva', 'Bekmurodova', 'Aminova',
];

const PROFESSIONS = [
  'nanny', 'house_cleaning', 'sewing', 'cooking', 'cosmetology', 'embroidery',
  'hairdressing', 'elder_care', 'hospitality', 'confectionery',
];

const NEAR_DISTRICTS = [
  'samarqand_shahri', 'oqdaryo', 'pastdargom', 'jomboy', 'samarqand_tumani',
  'toyloq', 'jomboy_shahri', 'payariq', 'bulungur',
];

const FAR_DISTRICTS = [
  'qoshrabot', 'paxtachi', 'urgut', 'ishtixon', 'oqtosh_shahri',
  'kattaqorgon_shahri', 'narpay', 'nurobod', 'kattaqorgon',
  'payariq', 'bulungur', 'jomboy', 'pastdargom',
];

const OFFSETS: Record<FemaleFilterSort, number> = {
  'price-low': 0,
  'price-high': 10,
  nearest: 18,
  farthest: 27,
};

export function isFemaleFilterSort(value: string): value is FemaleFilterSort {
  return value in FEMALE_FILTER_COUNTS;
}

export function generateFemaleWorkers(
  sort: FemaleFilterSort,
  direction?: string,
): { workers: Profile[]; prices: Record<string, number> } {
  const count = FEMALE_FILTER_COUNTS[sort];
  const offset = OFFSETS[sort];
  const districts = sort === 'farthest' ? FAR_DISTRICTS : NEAR_DISTRICTS;
  const workers: Profile[] = [];
  const prices: Record<string, number> = {};

  for (let index = 0; index < count; index += 1) {
    const slot = offset + index;
    const firstName = FIRST_NAMES[slot];
    const lastName = LAST_NAMES[slot];
    const profession = direction || PROFESSIONS[slot % PROFESSIONS.length];
    const uid = `gen-${sort}-${index + 1}`;
    const rating = [5, 4.8, 0, 4.9, 4.6][index % 5];
    const reviewCount = rating ? [6, 3, 1, 8, 2][index % 5] : 0;
    workers.push({
      uid,
      fullName: `${firstName} ${lastName}`,
      firstName,
      lastName,
      email: '',
      role: 'worker',
      region: 'Samarqand viloyati',
      district: districts[index % districts.length],
      profession,
      skills: [profession],
      availability: 'available',
      lookingForWork: true,
      isVerified: index % 2 === 0,
      rating,
      reviewCount,
      completedJobs: [4, 11, 0, 7, 2][index % 5],
    });
    const base = sort === 'price-high' ? 620000 : sort === 'price-low' ? 70000 : 160000;
    const step = sort === 'price-high' ? 45000 : sort === 'price-low' ? 12000 : 18000;
    prices[uid] = base + index * step;
  }

  return { workers, prices };
}
