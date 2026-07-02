import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Search, MapPin, Briefcase, Users, TrendingUp, ShieldCheck, ArrowRight, FileText, ClipboardCheck, Edit3 } from 'lucide-react';
import { REGIONS, DISTRICTS } from '../constants/locations';
import { CATEGORIES } from '../constants/categories';
import Layout from '../components/Layout';
import { useAuth } from '../hooks/useAuth';
import { useTranslation } from 'react-i18next';
import { getDistrictKey } from '../lib/utils';

export default function LandingPage() {
  const { user, profile } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [currentDistrictIndex, setCurrentDistrictIndex] = React.useState(0);
  const samarkandDistricts = DISTRICTS["Samarqand viloyati"];

  useEffect(() => {
    if (user && profile) {
      if (profile.role === 'worker') navigate('/worker/dashboard');
      else if (profile.role === 'employer') navigate('/employer/dashboard');
      else if (profile.role === 'admin') navigate('/admin/dashboard');
      else if (profile.role === 'super_admin') navigate('/super-admin/dashboard');
    }
  }, [user, profile, navigate]);

  React.useEffect(() => {
    const interval = setInterval(() => {
      setCurrentDistrictIndex((prev) => (prev + 1) % samarkandDistricts.length);
    }, 2000);
    return () => clearInterval(interval);
  }, [samarkandDistricts.length]);

  return (
    <Layout>
      {/* Hero Section */}
      <section className="relative h-[600px] flex items-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img
            src="https://samarkand.uz/templates/dreamzero/img/bodybg.jpg"
            alt="Samarkand Background"
            className="w-full h-full object-cover brightness-50"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-blue-900/70 to-transparent"></div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 w-full">
          <div className="max-w-2xl">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="inline-flex items-center gap-2 mb-4 text-sm uppercase tracking-[0.35em] font-black text-pink-300">
                <span>{t('landing.women_only_tagline')}</span>
              </div>
              <h1 className="text-4xl md:text-6xl font-black text-white leading-tight mb-6 tracking-tight">
                {t('landing.samarkand')} <br />
                <span className="text-blue-400 inline-block min-w-[280px]">
                  <motion.span
                    key={currentDistrictIndex}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="inline-block"
                  >
                    {t(`districts.${getDistrictKey(samarkandDistricts[currentDistrictIndex])}`)}
                  </motion.span>
                </span>
                <br />
                {t('landing.hero_title_suffix')}
              </h1>
              <p className="text-xl text-gray-200 mb-10 leading-relaxed font-medium">
                {t('landing.hero_subtitle')}
              </p>

              <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
                <Link
                  to="/jobs"
                  className="bg-blue-500 text-white px-8 py-4 rounded-2xl font-bold text-lg hover:bg-blue-600 transition-all shadow-xl flex items-center justify-center group"
                >
                  {t('landing.find_job')}
                  <ArrowRight size={20} className="ml-2 group-hover:translate-x-1 transition-transform" />
                </Link>
                <Link
                  to="/auth"
                  className="bg-white/10 backdrop-blur-md border border-white/20 text-white px-8 py-4 rounded-2xl font-bold text-lg hover:bg-white/20 transition-all flex items-center justify-center"
                >
                  {t('landing.post_job')}
                </Link>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Search Section */}
      <section className="relative z-20 -mt-12 max-w-5xl mx-auto px-4">
        <div className="bg-white p-3 rounded-[32px] shadow-2xl border border-gray-100 flex flex-col md:flex-row gap-2">
          <div className="flex-1 flex items-center px-6 py-4 border-b md:border-b-0 md:border-r border-gray-100">
            <Search className="text-gray-400 mr-3" size={24} />
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('landing.search_placeholder')} 
              className="w-full bg-transparent border-none focus:ring-0 outline-none text-lg font-medium"
            />
          </div>
          <div className="flex-1 flex items-center px-6 py-4">
            <MapPin className="text-gray-400 mr-3" size={24} />
            <select 
              className="w-full bg-transparent border-none focus:ring-0 outline-none text-lg font-medium appearance-none cursor-pointer"
              value={selectedDistrict}
              onChange={(e) => setSelectedDistrict(e.target.value)}
            >
              <option value="">{t('landing.all_districts')}</option>
              {samarkandDistricts.map(d => <option key={d} value={d}>{t(`districts.${getDistrictKey(d)}`)}</option>)}
            </select>
          </div>
          <button 
            onClick={() => {
              const params = new URLSearchParams();
              if (searchQuery.trim()) params.set('search', searchQuery.trim());
              if (selectedDistrict) params.set('district', selectedDistrict);
              navigate(`/jobs${params.toString() ? `?${params.toString()}` : ''}`);
            }}
            className="bg-blue-500 text-white px-10 py-5 rounded-[24px] font-black text-lg hover:bg-blue-600 transition-all shadow-lg shadow-blue-500/20 active:scale-95"
          >
            {t('common.search')}
          </button>
        </div>
      </section>

      {/* Action cards for HH-style workflow */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <p className="text-sm uppercase tracking-[0.35em] font-black text-pink-600 mb-4">
              {t('landing.women_only_tagline')}
            </p>
            <h2 className="text-3xl md:text-4xl font-black text-gray-900 mb-4">
              {t('landing.action_cards_title')}
            </h2>
            <p className="text-gray-500 text-base md:text-lg">
              {t('landing.steps_subtitle')}
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            <div className="p-8 rounded-3xl border border-gray-200 shadow-sm hover:shadow-lg transition-all">
              <div className="w-14 h-14 rounded-3xl bg-blue-500/10 text-blue-600 flex items-center justify-center mb-6">
                <Search size={24} />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">{t('landing.step_search_job')}</h3>
              <p className="text-gray-500 mb-6">{t('landing.step_search_job_desc')}</p>
              <button
                onClick={() => navigate('/jobs')}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-all"
              >
                {t('landing.find_job')}
                <ArrowRight size={18} />
              </button>
            </div>
            <div className="p-8 rounded-3xl border border-gray-200 shadow-sm hover:shadow-lg transition-all">
              <div className="w-14 h-14 rounded-3xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center mb-6">
                <ClipboardCheck size={24} />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">{t('landing.step_apply')}</h3>
              <p className="text-gray-500 mb-6">{t('landing.step_apply_desc')}</p>
              <button
                onClick={() => navigate(profile?.role === 'worker' ? '/worker/applications' : '/auth?mode=login')}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-emerald-600 text-white font-semibold hover:bg-emerald-700 transition-all"
              >
                {t('landing.submit_application')}
                <ArrowRight size={18} />
              </button>
            </div>
            <div className="p-8 rounded-3xl border border-gray-200 shadow-sm hover:shadow-lg transition-all">
              <div className="w-14 h-14 rounded-3xl bg-pink-500/10 text-pink-600 flex items-center justify-center mb-6">
                <FileText size={24} />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">{t('landing.step_resume')}</h3>
              <p className="text-gray-500 mb-6">{t('landing.step_resume_desc')}</p>
              <button
                onClick={() => navigate(profile?.role === 'worker' ? '/my-profile' : '/auth?mode=login')}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-pink-600 text-white font-semibold hover:bg-pink-700 transition-all"
              >
                {t('landing.write_resume')}
                <ArrowRight size={18} />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-12 bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="text-3xl font-black text-blue-600 mb-1">1,240+</div>
              <div className="text-sm font-medium text-gray-500 uppercase tracking-wider">{t('stats.active_jobs')}</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-black text-blue-600 mb-1">820+</div>
              <div className="text-sm font-medium text-gray-500 uppercase tracking-wider">{t('stats.workers')}</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-black text-blue-600 mb-1">560+</div>
              <div className="text-sm font-medium text-gray-500 uppercase tracking-wider">{t('stats.employers')}</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-black text-blue-600 mb-1">{samarkandDistricts.length}</div>
              <div className="text-sm font-medium text-gray-500 uppercase tracking-wider">{t('stats.districts')}</div>
            </div>
          </div>
        </div>
      </section>

      {/* Categories Section */}
      <section className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-black text-gray-900 mb-4 tracking-tight">{t('landing.popular_categories')}</h2>
            <p className="text-gray-500 max-w-2xl mx-auto">
              {t('landing.popular_categories_subtitle')}
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
            {CATEGORIES.map((category) => (
              <motion.div
                key={category.id}
                whileHover={{ scale: 1.02 }}
                className="bg-white p-8 rounded-3xl border border-gray-200 shadow-sm hover:shadow-md transition-all cursor-pointer text-center group"
              >
                <div className="text-4xl mb-4 group-hover:scale-110 transition-transform">{category.icon}</div>
                <h3 className="font-bold text-gray-900">{t(`categories.${category.id}`)}</h3>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-3xl font-black text-gray-900 mb-8 leading-tight tracking-tight">
                {t('landing.why_us_title')}
              </h2>
              <div className="space-y-8">
                <div className="flex items-start space-x-4">
                  <div className="bg-blue-50 p-3 rounded-2xl text-blue-600">
                    <MapPin size={24} />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900 mb-1">{t('landing.geo_based')}</h4>
                    <p className="text-gray-500 text-sm leading-relaxed">
                      {t('landing.geo_based_desc')}
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-4">
                  <div className="bg-green-50 p-3 rounded-2xl text-green-600">
                    <ShieldCheck size={24} />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900 mb-1">{t('landing.trusted')}</h4>
                    <p className="text-gray-500 text-sm leading-relaxed">
                      {t('landing.trusted_desc')}
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-4">
                  <div className="bg-purple-50 p-3 rounded-2xl text-purple-600">
                    <TrendingUp size={24} />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900 mb-1">{t('landing.income')}</h4>
                    <p className="text-gray-500 text-sm leading-relaxed">
                      {t('landing.income_desc')}
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="relative">
              <div className="aspect-square bg-blue-500 rounded-[40px] overflow-hidden shadow-2xl rotate-3">
                <img
                  src="https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?auto=format&fit=crop&q=80&w=800&h=800"
                  alt="Happy worker"
                  className="w-full h-full object-cover -rotate-3 scale-110"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="absolute -bottom-8 -left-8 bg-white p-6 rounded-3xl shadow-xl border border-gray-100 max-w-[200px]">
                <div className="flex items-center space-x-2 mb-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{t('landing.active_now')}</span>
                </div>
                <div className="text-2xl font-black text-gray-900">2,450+</div>
                <div className="text-xs text-gray-500">{t('landing.women_found_job')}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Top Workers Section */}
      <section className="py-24 bg-white border-t border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between mb-12">
            <div>
              <h2 className="text-3xl font-black text-gray-900 mb-4 tracking-tight">{t('landing.top_workers')}</h2>
              <p className="text-gray-500">{t('landing.top_workers_subtitle')}</p>
            </div>
            <Link to="/workers" className="text-blue-600 font-bold flex items-center hover:underline">
              {t('landing.view_all')} <ArrowRight size={16} className="ml-2" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { name: 'Zilola Ahmedova', skill: t('categories.seamstress'), rating: 5.0, district: t('districts.samarkand_city') },
              { name: 'Madina Karimova', skill: t('categories.cook'), rating: 4.9, district: t('districts.urgut') },
              { name: 'Nigora Usmonova', skill: t('categories.nanny'), rating: 4.8, district: t('districts.pastdargom') },
              { name: 'Guli Ergasheva', skill: t('categories.cleaner'), rating: 4.8, district: t('districts.bulungur') }
            ].map((worker, i) => (
              <div key={i} className="bg-gray-50 p-6 rounded-[2rem] border border-gray-100 hover:shadow-xl transition-all group">
                <div className="w-20 h-20 bg-white rounded-2xl mb-4 overflow-hidden border border-gray-100 shadow-inner">
                  <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(worker.name)}&background=random`} alt={worker.name} className="w-full h-full object-cover" />
                </div>
                <h3 className="font-black text-gray-900 mb-1">{worker.name}</h3>
                <p className="text-blue-600 text-xs font-bold uppercase tracking-wider mb-3">{worker.skill}</p>
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200/50">
                  <div className="flex items-center text-amber-500">
                    <TrendingUp size={14} className="mr-1.5" />
                    <span className="text-sm font-black text-gray-900">{worker.rating}</span>
                  </div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase">{worker.district}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-blue-500 overflow-hidden relative">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500 rounded-full blur-3xl opacity-50 -mr-32 -mt-32"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-600 rounded-full blur-3xl opacity-50 -ml-32 -mb-32"></div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <h2 className="text-3xl md:text-5xl font-black text-white mb-8 tracking-tight">
            {t('landing.cta_title')}
          </h2>
          <p className="text-blue-100 text-xl mb-12 max-w-2xl mx-auto leading-relaxed">
            {t('landing.cta_subtitle')}
          </p>
          <div className="flex flex-col sm:flex-row justify-center space-y-4 sm:space-y-0 sm:space-x-6">
            <Link
              to="/auth"
              className="bg-white text-blue-600 px-10 py-5 rounded-2xl font-black text-xl hover:bg-blue-50 transition-all shadow-2xl"
            >
              {t('landing.register_now')}
            </Link>
            <Link
              to="/statistics"
              className="bg-blue-600 text-white px-10 py-5 rounded-2xl font-black text-xl hover:bg-blue-600 transition-all border border-blue-500"
            >
              {t('landing.view_stats')}
            </Link>
          </div>
        </div>
      </section>
    </Layout>
  );
}
