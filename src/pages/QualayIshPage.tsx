import React, { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, QueryConstraint } from 'firebase/firestore';
import { Job } from '../types';
import { useTranslation } from 'react-i18next';
import { Search, MapPin, Briefcase, Heart, Loader } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { jobRecommendationService, RecommendationScore } from '../services/qulay-ish';
import JobCard from '../components/JobCard';
import ApplyModal from '../components/ApplyModal';

export default function QualayIshPage() {
  const { profile, isDemo } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [recommendations, setRecommendations] = useState<RecommendationScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('');

  // Fetch all jobs
  useEffect(() => {
    setLoading(true);

    const constraints: QueryConstraint[] = [
      where('status', '==', 'open'),
      orderBy('createdAt', 'desc')
    ];

    try {
      const q = query(collection(db, 'jobs'), ...constraints);
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const jobsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Job[];

        setJobs(jobsData);

        // Generate recommendations if user has profile
        if (profile && !isDemo) {
          const scores = jobsData.map(job =>
            jobRecommendationService.calculateMatchScore(profile, job)
          );
          const topRecommendations = scores
            .filter(s => s.score >= 40)
            .sort((a, b) => b.score - a.score)
            .slice(0, 5);

          setRecommendations(topRecommendations);
        }

        setLoading(false);
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'jobs');
        setLoading(false);
      });

      return () => unsubscribe();
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'jobs');
      setLoading(false);
    }
  }, [profile, isDemo]);

  // Filter and search logic
  const filteredJobs = jobs.filter(job => {
    const matchesSearch = !searchQuery ||
      job.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.description?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory = !filterCategory || job.category === filterCategory;

    return matchesSearch && matchesCategory;
  });

  const handleApply = (job: Job) => {
    setSelectedJob(job);
    setIsApplyModalOpen(true);
  };

  const handleSaveJob = (jobId: string) => {
    if (!profile) {
      navigate('/auth');
      return;
    }
    // Save functionality would be implemented here
  };

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <h1 className="text-4xl font-bold mb-2">Qulay Ish</h1>
            <p className="text-foreground/60">Uyingiz yaqinida qulay va xavfsiz ish topib oling</p>
          </motion.div>

          {/* Search and Filter */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-8"
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="relative">
                <Search className="absolute left-4 top-3.5 text-foreground/40" size={20} />
                <input
                  type="text"
                  placeholder={t('common.search', { defaultValue: 'Search jobs...' })}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-2.5 bg-card border border-border rounded-xl focus:outline-none focus:border-primary transition-colors"
                />
              </div>
              <div className="relative">
                <Briefcase className="absolute left-4 top-3.5 text-foreground/40" size={20} />
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="w-full pl-12 pr-4 py-2.5 bg-card border border-border rounded-xl focus:outline-none focus:border-primary transition-colors appearance-none cursor-pointer"
                >
                  <option value="">Barcha kategoriyalar</option>
                  <option value="cooking">Paxta tayyorlash</option>
                  <option value="cleaning">Tozalash</option>
                  <option value="childcare">Bolalarni paqo'y olish</option>
                  <option value="elderly_care">Keksa odam paqo'y olish</option>
                  <option value="tutoring">O'quv mashgulotlari</option>
                </select>
              </div>
            </div>
          </motion.div>

          {/* Recommendations Section */}
          {recommendations.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="mb-12"
            >
              <div className="flex items-center gap-2 mb-6">
                <div className="w-2 h-8 bg-gradient-to-b from-primary to-primary/50 rounded-full" />
                <h2 className="text-2xl font-bold">Sizga tavsiya etilgan ishlar</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <AnimatePresence>
                  {recommendations.slice(0, 3).map((rec, idx) => {
                    const job = jobs.find(j => j.id === rec.jobId);
                    if (!job) return null;

                    return (
                      <motion.div
                        key={rec.jobId}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ delay: idx * 0.05 }}
                        className="relative"
                      >
                        <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/20 to-transparent rounded-2xl blur opacity-0 group-hover:opacity-100 transition duration-1000" />
                        <div className="relative">
                          <div className="absolute top-4 right-4 bg-primary/10 text-primary text-xs font-bold px-3 py-1 rounded-full">
                            {rec.score}% mos
                          </div>
                          <JobCard
                            job={job}
                            onApply={() => handleApply(job)}
                          />
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </motion.div>
          )}

          {/* All Jobs Section */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="flex items-center gap-2 mb-6">
              <div className="w-2 h-8 bg-gradient-to-b from-primary to-primary/50 rounded-full" />
              <h2 className="text-2xl font-bold">Barcha mavjud ishlar</h2>
              <span className="ml-auto text-sm text-foreground/60">{filteredJobs.length} ish</span>
            </div>

            {loading ? (
              <div className="flex justify-center py-20">
                <Loader className="animate-spin text-primary" size={40} />
              </div>
            ) : filteredJobs.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <AnimatePresence>
                  {filteredJobs.map((job, idx) => (
                    <motion.div
                      key={job.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ delay: idx * 0.03 }}
                      className="group relative"
                    >
                      <button
                        onClick={() => handleSaveJob(job.id)}
                        className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/80 hover:bg-white text-red-500 transition-all duration-200 shadow-lg"
                      >
                        <Heart size={20} />
                      </button>
                      <JobCard
                        job={job}
                        onApply={() => handleApply(job)}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-20"
              >
                <Briefcase className="mx-auto mb-4 text-foreground/30" size={48} />
                <p className="text-foreground/60">{t('common.noResults', { defaultValue: 'Hech qanday ish topilmadi' })}</p>
              </motion.div>
            )}
          </motion.div>
        </div>
      </div>

      {/* Apply Modal */}
      <ApplyModal
        job={selectedJob}
        isOpen={isApplyModalOpen}
        onClose={() => {
          setIsApplyModalOpen(false);
          setSelectedJob(null);
        }}
      />
    </Layout>
  );
}
