import { debugLogger } from '../lib/debugLogger';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { db } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { Profile } from '../types';
import { motion } from 'motion/react';
import { TrendingUp, Users, MapPin, BarChart2, ArrowLeft } from 'lucide-react';
import Layout from '../components/Layout';
import { DISTRICTS } from '../constants/locations';
import { getDistrictKey } from '../lib/utils';
import { useNavigate } from 'react-router-dom';

interface DistrictStat {
  id: string;
  region: string;
  workerCount: number;
}

export default function StatisticsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [stats, setStats] = React.useState<DistrictStat[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchDistrictStats = async () => {
      try {
        const profilesQuery = query(
          collection(db, 'profiles'),
          where('role', '==', 'worker'),
          where('region', '==', 'Samarqand viloyati')
        );
        
        const profilesSnapshot = await getDocs(profilesQuery);
        const profiles = profilesSnapshot.docs.map(doc => doc.data() as Profile);
        
        const districtCounts: Record<string, number> = {};
        profiles.forEach(profile => {
          const district = profile.district || 'Unknown';
          districtCounts[district] = (districtCounts[district] || 0) + 1;
        });
        
        const districtStats: DistrictStat[] = DISTRICTS["Samarqand viloyati"].map((district, idx) => ({
          id: idx.toString(),
          region: district,
          workerCount: districtCounts[district] || 0
        }));
        
        districtStats.sort((a, b) => b.workerCount - a.workerCount);
        
        setStats(districtStats);
        setLoading(false);
      } catch (error) {
        debugLogger.error('Error fetching district statistics:', error);
        setLoading(false);
      }
    };

    fetchDistrictStats();
  }, []);

  const totalEmployed = stats.reduce((acc, curr) => acc + curr.workerCount, 0);

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <button
          onClick={() => navigate(-1)}
          className="mb-6 flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 border border-gray-200 dark:border-slate-700 rounded-2xl text-gray-900 dark:text-white font-bold transition-all shadow-sm"
        >
          <ArrowLeft size={18} />
          {t('common.back')}
        </button>

        <div className="text-center mb-16">
          <h1 className="text-4xl font-black text-foreground mb-4 tracking-tight">{t('stats.title')}</h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            {t('stats.subtitle')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 p-8 rounded-[40px] border border-blue-400 dark:border-blue-500 shadow-xl text-center">
            <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-3xl flex items-center justify-center text-white mx-auto mb-6">
              <Users size={32} />
            </div>
            <div className="text-5xl font-black text-white mb-3 drop-shadow-lg">{totalEmployed.toLocaleString()}</div>
            <div className="text-sm font-bold text-blue-100 uppercase tracking-widest">{t('stats.total_employed')}</div>
          </div>
          <div className="bg-gradient-to-br from-green-500 to-green-600 dark:from-green-600 dark:to-green-700 p-8 rounded-[40px] border border-green-400 dark:border-green-500 shadow-xl text-center">
            <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-3xl flex items-center justify-center text-white mx-auto mb-6">
              <TrendingUp size={32} />
            </div>
            <div className="text-5xl font-black text-white mb-3 drop-shadow-lg">85%</div>
            <div className="text-sm font-bold text-green-100 uppercase tracking-widest">{t('stats.monthly_growth')}</div>
          </div>
          <div className="bg-gradient-to-br from-purple-500 to-purple-600 dark:from-purple-600 dark:to-purple-700 p-8 rounded-[40px] border border-purple-400 dark:border-purple-500 shadow-xl text-center">
            <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-3xl flex items-center justify-center text-white mx-auto mb-6">
              <MapPin size={32} />
            </div>
            <div className="text-5xl font-black text-white mb-3 drop-shadow-lg">{DISTRICTS["Samarqand viloyati"].length}</div>
            <div className="text-sm font-bold text-purple-100 uppercase tracking-widest">{t('stats.covered_districts')}</div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-[40px] border border-gray-200 dark:border-slate-700 shadow-2xl overflow-hidden">
          <div className="px-8 py-6 bg-gradient-to-r from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 flex items-center justify-between">
            <h3 className="text-xl font-black text-white tracking-tight flex items-center">
              <BarChart2 size={24} className="mr-2 text-white" /> {t('stats.by_district')}
            </h3>
            <div className="text-xs font-bold text-blue-100 uppercase tracking-widest">{t('stats.regional_indicators')}</div>
          </div>
          <div className="p-8">
            <div className="space-y-6">
              {loading ? (
                Array(5).fill(0).map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="flex justify-between items-center mb-2">
                      <div className="h-4 bg-secondary rounded w-32"></div>
                      <div className="h-4 bg-secondary rounded w-20"></div>
                    </div>
                    <div className="w-full bg-secondary h-3 rounded-full"></div>
                  </div>
                ))
              ) : stats.length > 0 ? (
                stats.map((stat, idx) => (
                  <div key={stat.id}>
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-bold text-gray-900 dark:text-white">{t(`districts.${getDistrictKey(stat.region)}`, { defaultValue: stat.region })}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-gray-600 dark:text-slate-400">{stat.workerCount} {t('stats.workers').toLowerCase()}</span>
                        <span className="text-sm font-black text-blue-600 dark:text-blue-400">{t('stats.people_count', { count: stat.workerCount })}</span>
                      </div>
                    </div>
                    <div className="w-full bg-secondary dark:bg-slate-700 h-3 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: stats[0].workerCount > 0 ? `${(stat.workerCount / stats[0].workerCount) * 100}%` : '0%' }}
                        transition={{ duration: 1, delay: idx * 0.1 }}
                        className="bg-blue-500 dark:bg-blue-400 h-full rounded-full"
                      />
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p>{t('common.no_data')}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
