/** Service directions offered on the orders screen. */
export const SERVICE_DIRECTIONS = [
  {
    id: 'childcare',
    name: 'Yosh bolalarga enagalik',
    aliases: ['nanny', 'babysitting'],
    keywords: ['enaga', 'нян', 'nanny', 'bolalarga', 'yosh bola'],
  },
  {
    id: 'house_cleaning',
    name: 'Uy tozalash',
    aliases: ['cleaner'],
    keywords: ['uy tozalash', 'uy-joy', 'house clean', 'уборка дома', 'уборка квартир'],
  },
  {
    id: 'hotel_cleaning',
    name: 'Mehmonxona tozalash',
    aliases: ['hospitality'],
    keywords: ['mehmonxona', 'hotel', 'гостиниц'],
  },
  {
    id: 'elder_care',
    name: 'Keksalarga qarash',
    aliases: ['caregiver'],
    keywords: ['keksa', 'qariya', 'пожил', 'elder'],
  },
  {
    id: 'postpartum_care',
    name: 'Tugʻruqdan keyingi parvarish',
    aliases: ['midwifery'],
    keywords: ['tugʻruq', 'tugruq', "tug'ruq", 'keyingi parvarish', 'postpartum', 'послеродов'],
  },
] as const;

export type ServiceDirectionId = (typeof SERVICE_DIRECTIONS)[number]['id'];

export function isServiceDirection(value?: string | null): value is ServiceDirectionId {
  return SERVICE_DIRECTIONS.some((direction) => direction.id === value);
}

/** A job matches a direction by its saved category or by the words in the title. */
export function jobMatchesDirection(
  job: { category?: string | null; title?: string | null; description?: string | null },
  directionId: string,
): boolean {
  const direction = SERVICE_DIRECTIONS.find((item) => item.id === directionId);
  if (!direction) return true;
  const category = (job.category || '').trim();
  if (category === direction.id || (direction.aliases as readonly string[]).includes(category)) return true;
  const titled = `${job.title || ''} ${job.description || ''}`.toLowerCase();
  if (titled.includes(direction.name.toLowerCase())) return true;
  return direction.keywords.some((word) => titled.includes(word));
}

/** A worker matches a direction by profession, skills, or the words in the bio. */
export function workerMatchesDirection(
  worker: {
    profession?: string | null;
    skills?: readonly string[] | null;
    bio?: string | null;
    professionalSummary?: string | null;
  },
  directionId: string,
): boolean {
  const direction = SERVICE_DIRECTIONS.find((item) => item.id === directionId);
  if (!direction) return true;
  const ids = new Set<string>([direction.id, ...direction.aliases]);
  const fields = [worker.profession, ...(worker.skills ?? [])].filter(
    (value): value is string => Boolean(value),
  );
  if (fields.some((field) => ids.has(field))) return true;
  const text = `${worker.bio || ''} ${worker.professionalSummary || ''} ${fields.join(' ')}`.toLowerCase();
  if (text.includes(direction.name.toLowerCase())) return true;
  if (direction.keywords.some((word) => text.includes(word))) return true;
  return direction.aliases.some((alias) => text.includes(alias));
}

export const CATEGORIES = [
  { id: 'nurse', name: 'Hamshira', icon: '👩‍⚕️' },
  { id: 'pedagogue', name: 'Pedagog', icon: '👨‍🏫' },
  { id: 'educator', name: 'Tarbiyachi', icon: '🧑‍🏫' },
  { id: 'nanny', name: 'Enaga', icon: '👶' },
  { id: 'preschool_education', name: 'Maktabgacha taʼlim', icon: '🧸' },
  { id: 'music_education', name: 'Musiqa taʼlimi', icon: '🎵' },
  { id: 'physical_education', name: 'Jismoniy tarbiya', icon: '🏃' },
  { id: 'medical_nursing', name: 'Tibbiy hamshiralik', icon: '🩺' },
  { id: 'midwifery', name: 'Akusherlik', icon: '🤰' },
  { id: 'pharmacy', name: 'Farmatsiya', icon: '💊' },
  { id: 'lab_diagnostics', name: 'Laboratoriya diagnostikasi', icon: '🔬' },
  { id: 'software_engineering', name: 'Dasturiy injiniring', icon: '💻' },
  { id: 'computer_engineering', name: 'Kompyuter injiniringi', icon: '🖥️' },
  { id: 'information_technology', name: 'Axborot texnologiyalari', icon: '🌐' },
  { id: 'electrical_engineering', name: 'Elektrotexnika', icon: '⚡' },
  { id: 'auto_service', name: 'Avtomobillarga texnik xizmat koʻrsatish', icon: '🔧' },
  { id: 'auto_repair', name: 'Avtomobillarni taʼmirlash', icon: '🚗' },
  { id: 'construction', name: 'Qurilish', icon: '🏗️' },
  { id: 'architecture', name: 'Arxitektura', icon: '📐' },
  { id: 'geodesy', name: 'Geodeziya', icon: '🧭' },
  { id: 'land_management', name: 'Yer tuzish', icon: '🗺️' },
  { id: 'agriculture', name: 'Qishloq xoʻjaligi', icon: '🌾' },
  { id: 'agronomy', name: 'Agronomiya', icon: '🌱' },
  { id: 'veterinary', name: 'Veterinariya', icon: '🐾' },
  { id: 'food_technology', name: 'Oziq-ovqat texnologiyasi', icon: '🍲' },
  { id: 'sewing_technology', name: 'Tikuvchilik texnologiyasi', icon: '🧵' },
  { id: 'textile_technology', name: 'Toʻqimachilik texnologiyasi', icon: '🧶' },
  { id: 'design', name: 'Dizayn', icon: '🎨' },
  { id: 'cosmetology', name: 'Kosmetologiya', icon: '💄' },
  { id: 'hairdressing', name: 'Sartaroshlik', icon: '💇' },
  { id: 'cooking', name: 'Oshpazlik', icon: '🍳' },
  { id: 'confectionery_craft', name: 'Qandolatchilik', icon: '🧁' },
  { id: 'hospitality', name: 'Mehmonxona xoʻjaligi', icon: '🏨' },
  { id: 'tourism', name: 'Turizm', icon: '✈️' },
  { id: 'trade', name: 'Savdo ishi', icon: '🛒' },
  { id: 'human_resources', name: 'Kadrlar ishi', icon: '👔' },
  { id: 'law', name: 'Huquqshunoslik', icon: '⚖️' },
  { id: 'social_work', name: 'Ijtimoiy ish', icon: '🫶' },
  { id: 'librarianship', name: 'Kutubxonachilik', icon: '📚' },
  { id: 'archiving', name: 'Arxiv ishi', icon: '🗄️' },
  { id: 'printing', name: 'Poligrafiya', icon: '🖨️' },
  { id: 'metal_chasing', name: 'Zarbgarlik', icon: '🔨' },
  { id: 'embroidery', name: 'Kashtachilik', icon: '🪡' },
  { id: 'pottery', name: 'Kulolchilik', icon: '🏺' },
  { id: 'carpet_weaving', name: 'Gilamchilik', icon: '🧿' },
  { id: 'other', name: 'Boshqa', icon: '✨' }
];

export const EDUCATION_LEVELS = [
  { id: 'none', name: "Ma'lumoti yo'q" },
  { id: 'secondary', name: "O'rta ta'lim" },
  { id: 'vocational', name: "O'rta maxsus (kollej/litsey)" },
  { id: 'other', name: 'Boshqa' },
];

export const SKILLS = [
  { id: "house_cleaning", name: "Uy tozalash" },
  { id: "cooking", name: "Ovqat pishirish" },
  { id: "sewing", name: "Tikuvchilik" },
  { id: "babysitting", name: "Bolalarga qarash" },
  { id: "english", name: "Ingliz tili" },
  { id: "russian", name: "Rus tili" },
  { id: "math", name: "Matematika" },
  { id: "makeup", name: "Makiyaj" },
  { id: "manicure", name: "Manikyur" },
  { id: "knitting", name: "Toʻqish" },
  { id: "confectionery", name: "Qandolatpazlik" }
];
