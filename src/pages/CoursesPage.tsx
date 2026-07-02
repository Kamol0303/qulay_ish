import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'motion/react';
import { BookOpen, Play, Star, Clock, Users } from 'lucide-react';
import Layout from '../components/Layout';

interface Course {
  id: string;
  title: string;
  titleUz: string;
  titleRu: string;
  titleEn: string;
  category: string;
  videoId: string;
  duration: string;
  level: 'beginner' | 'intermediate' | 'advanced';
  views: number;
  rating: number;
}

const COURSES: Course[] = [
  {
    id: '1',
    title: 'Tikuvchilik asoslari',
    titleUz: 'Tikuvchilik asoslari',
    titleRu: 'Osnovy shitya',
    titleEn: 'Sewing Basics',
    category: 'sewing',
    videoId: 'UAzlLsZjn8k',
    duration: '45 min',
    level: 'beginner',
    views: 1250,
    rating: 4.8
  },
  {
    id: '2',
    title: 'Toqimachilik sanati',
    titleUz: 'Toqimachilik sanati',
    titleRu: 'Iskusstvo vyazaniya',
    titleEn: 'Knitting Art',
    category: 'knitting',
    videoId: 'SbwyMXzX2Rw',
    duration: '60 min',
    level: 'intermediate',
    views: 980,
    rating: 4.9
  },
  {
    id: '3',
    title: 'Bisser bilan ishlash',
    titleUz: 'Bisser bilan ishlash',
    titleRu: 'Rabota s biserom',
    titleEn: 'Beadwork',
    category: 'beadwork',
    videoId: 'fE7zQ13gWHo',
    duration: '30 min',
    level: 'beginner',
    views: 750,
    rating: 4.7
  },
  {
    id: '4',
    title: 'Uy biznesi boshlash',
    titleUz: 'Uy biznesi boshlash',
    titleRu: 'Nachalo domashnego biznesa',
    titleEn: 'Starting Home Business',
    category: 'business',
    videoId: 'LIukMzVK3p4',
    duration: '90 min',
    level: 'beginner',
    views: 2100,
    rating: 4.9
  },
  {
    id: '5',
    title: 'Qol mehnati mahsulotlari',
    titleUz: 'Qol mehnati mahsulotlari',
    titleRu: 'Izdeliya ruchnoy raboty',
    titleEn: 'Handmade Products',
    category: 'handmade',
    videoId: 'MzUIshbRoDE',
    duration: '50 min',
    level: 'intermediate',
    views: 1450,
    rating: 4.8
  },
  {
    id: '6',
    title: 'Professional tikuvchilik',
    titleUz: 'Professional tikuvchilik',
    titleRu: 'Professionalnoe shitye',
    titleEn: 'Professional Sewing',
    category: 'sewing',
    videoId: '7X4lAcyOHfE',
    duration: '120 min',
    level: 'advanced',
    views: 890,
    rating: 5.0
  }
];

const CATEGORIES = [
  { id: 'all', nameUz: 'Barchasi', nameRu: 'Vse', nameEn: 'All' },
  { id: 'sewing', nameUz: 'Tikuvchilik', nameRu: 'Shitye', nameEn: 'Sewing' },
  { id: 'knitting', nameUz: 'Toqimachilik', nameRu: 'Vyazanie', nameEn: 'Knitting' },
  { id: 'beadwork', nameUz: 'Bisser', nameRu: 'Biser', nameEn: 'Beadwork' },
  { id: 'business', nameUz: 'Uy biznesi', nameRu: 'Domashniy biznes', nameEn: 'Home Business' },
  { id: 'handmade', nameUz: 'Qol mehnati', nameRu: 'Ruchnaya rabota', nameEn: 'Handmade' }
];

export default function CoursesPage() {
  const { t, i18n } = useTranslation();
  const [selectedCategory, setSelectedCategory] = React.useState('all');
  const [selectedCourse, setSelectedCourse] = React.useState<Course | null>(null);

  const filteredCourses = selectedCategory === 'all'
    ? COURSES
    : COURSES.filter(c => c.category === selectedCategory);

  const getCategoryName = (cat: typeof CATEGORIES[0]) => {
    switch (i18n.language) {
      case 'ru': return cat.nameRu;
      case 'en': return cat.nameEn;
      default: return cat.nameUz;
    }
  };

  const getCourseTitle = (course: Course) => {
    switch (i18n.language) {
      case 'ru': return course.titleRu;
      case 'en': return course.titleEn;
      default: return course.titleUz;
    }
  };

  const getLevelText = (level: string) => {
    const levels: Record<string, { uz: string; ru: string; en: string }> = {
      beginner: { uz: 'Boshlangich', ru: 'Nachalnyy', en: 'Beginner' },
      intermediate: { uz: 'Orta', ru: 'Sredniy', en: 'Intermediate' },
      advanced: { uz: 'Yuqori', ru: 'Prodvinutyy', en: 'Advanced' }
    };
    return levels[level]?.[i18n.language as 'uz' | 'ru' | 'en'] || level;
  };

  return (
    <Layout>
      <div className="bg-gradient-to-br from-blue-600 to-indigo-700 pt-24 pb-32 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'url(https://www.transparenttextures.com/patterns/cubes.png)' }} />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            <div className="inline-flex items-center px-4 py-2 rounded-full bg-white/10 border border-white/20 text-white text-xs font-bold uppercase mb-6">
              <BookOpen size={16} className="mr-2" />
              {i18n.language === 'ru' ? 'Besplatnoe obuchenie' : i18n.language === 'en' ? 'Free Learning' : 'Bepul talim'}
            </div>
            <h1 className="text-4xl md:text-6xl font-black text-white mb-6 tracking-tight">
              {i18n.language === 'ru' ? 'Besplatnye Uroki' : i18n.language === 'en' ? 'Free Courses' : 'Bepul Darsliklar'}
            </h1>
            <p className="text-xl text-blue-100 max-w-2xl mx-auto">
              {i18n.language === 'ru' 
                ? 'Izuchayte novye navyki i razvivayte svoy biznes s nashimi besplatnymi videourkami'
                : i18n.language === 'en'
                ? 'Learn new skills and grow your business with our free video tutorials'
                : 'Yangi konikmalarni organing va biznesingizni rivojlantiring'}
            </p>
          </motion.div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-16 pb-20 relative z-20">
        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-6 mb-8">
          <div className="flex flex-wrap gap-3">
            {CATEGORIES.map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-6 py-3 rounded-xl font-bold transition-all ${
                  selectedCategory === cat.id
                    ? 'bg-blue-500 text-white shadow-lg'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {getCategoryName(cat)}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCourses.map((course) => (
            <motion.div
              key={course.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden hover:shadow-2xl transition-all cursor-pointer"
              onClick={() => setSelectedCourse(course)}
            >
              <div className="relative h-48 bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                <div className="absolute inset-0 bg-black/20" />
                <Play size={48} className="text-white relative z-10" />
                <div className="absolute top-4 right-4 bg-black/50 backdrop-blur-sm px-3 py-1 rounded-full text-white text-xs font-bold">
                  <Clock size={12} className="inline mr-1" />
                  {course.duration}
                </div>
              </div>

              <div className="p-6">
                <h3 className="text-lg font-black text-gray-900 mb-2">
                  {getCourseTitle(course)}
                </h3>
                
                <div className="flex items-center gap-4 text-sm text-gray-600 mb-4">
                  <div className="flex items-center">
                    <Star size={14} className="text-yellow-500 fill-current mr-1" />
                    <span className="font-bold">{course.rating}</span>
                  </div>
                  <div className="flex items-center">
                    <Users size={14} className="mr-1" />
                    <span>{course.views}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                    course.level === 'beginner' ? 'bg-green-100 text-green-700' :
                    course.level === 'intermediate' ? 'bg-blue-100 text-blue-700' :
                    'bg-purple-100 text-purple-700'
                  }`}>
                    {getLevelText(course.level)}
                  </span>
                  <button className="text-blue-600 font-bold text-sm hover:text-blue-700">
                    {i18n.language === 'ru' ? 'Smotret' : i18n.language === 'en' ? 'Watch' : 'Korish'}
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {selectedCourse && (
          <div 
            className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedCourse(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-3xl overflow-hidden max-w-4xl w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="aspect-video">
                <iframe
                  width="100%"
                  height="100%"
                  src={`https://www.youtube.com/embed/${selectedCourse.videoId}`}
                  title={getCourseTitle(selectedCourse)}
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
              <div className="p-6">
                <h2 className="text-2xl font-black text-gray-900 mb-2">
                  {getCourseTitle(selectedCourse)}
                </h2>
                <div className="flex items-center gap-4 text-gray-600">
                  <span className="flex items-center">
                    <Clock size={16} className="mr-1" />
                    {selectedCourse.duration}
                  </span>
                  <span className="flex items-center">
                    <Star size={16} className="text-yellow-500 fill-current mr-1" />
                    {selectedCourse.rating}
                  </span>
                  <span className="flex items-center">
                    <Users size={16} className="mr-1" />
                    {selectedCourse.views}
                  </span>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </Layout>
  );
}
