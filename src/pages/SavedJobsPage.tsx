import React, { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import ProtectedRoute from '../components/ProtectedRoute';
import Layout from '../components/Layout';
import { useTranslation } from 'react-i18next';
import { Heart, Loader, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { savedJobsService, SavedJob } from '../services/qulay-ish';
import JobCard from '../components/JobCard';
import ApplyModal from '../components/ApplyModal';
import { Job } from '../types';

export default function SavedJobsPage() {
  const { profile } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [savedJobs, setSavedJobs] = useState<SavedJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);

  useEffect(() => {
    if (!profile?.uid) return;

    const loadSavedJobs = async () => {
      setLoading(true);
      try {
        const saved = await savedJobsService.getSavedJobs(profile.uid);
        setSavedJobs(saved);
      } catch (error) {
        console.error('Error loading saved jobs:', error);
      } finally {
        setLoading(false);
      }
    };

    loadSavedJobs();
  }, [profile?.uid]);

  const handleRemove = async (userId: string, jobId: string) => {
    const result = await savedJobsService.unsaveJob(userId, jobId);
    if (result.success) {
      setSavedJobs(savedJobs.filter(sj => sj.jobId !== jobId));
    }
  };

  const handleApply = (job: Job) => {
    setSelectedJob(job);
    setIsApplyModalOpen(true);
  };

  return (
    <ProtectedRoute>
      <Layout>
        <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-background">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Header */}
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-8"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-red-500/20 to-red-500/10 rounded-2xl flex items-center justify-center">
                  <Heart className="text-red-500" size={24} fill="currentColor" />
                </div>
                <div>
                  <h1 className="text-4xl font-bold">Saqlangan ishlar</h1>
                  <p className="text-foreground/60">Sizning sevimlı ishlaringiz</p>
                </div>
              </div>
            </motion.div>

            {/* Stats */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8"
            >
              <div className="bg-card rounded-2xl border border-border p-6">
                <div className="text-3xl font-bold text-primary mb-1">{savedJobs.length}</div>
                <p className="text-foreground/60">Saqlangan ish</p>
              </div>
              <div className="bg-card rounded-2xl border border-border p-6">
                <div className="text-3xl font-bold text-emerald-500 mb-1">
                  {savedJobs.filter(sj => sj.job?.status === 'open').length}
                </div>
                <p className="text-foreground/60">Aktiv ish</p>
              </div>
              <div className="bg-card rounded-2xl border border-border p-6">
                <div className="text-3xl font-bold text-blue-500 mb-1">
                  {savedJobs.length > 0 ? Math.round((savedJobs.filter(sj => sj.job?.status === 'open').length / savedJobs.length) * 100) : 0}%
                </div>
                <p className="text-foreground/60">Faollik</p>
              </div>
            </motion.div>

            {/* Saved Jobs List */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
            >
              {loading ? (
                <div className="flex justify-center py-20">
                  <Loader className="animate-spin text-primary" size={40} />
                </div>
              ) : savedJobs.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <AnimatePresence>
                    {savedJobs.map((savedJob, idx) => {
                      if (!savedJob.job) return null;

                      return (
                        <motion.div
                          key={savedJob.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -20 }}
                          transition={{ delay: idx * 0.05 }}
                          className="relative group"
                        >
                          {/* Remove button */}
                          <button
                            onClick={() => handleRemove(profile!.uid, savedJob.jobId)}
                            className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/80 hover:bg-red-50 text-red-500 transition-all duration-200 shadow-lg hover:shadow-xl"
                          >
                            <Heart size={20} fill="currentColor" />
                          </button>

                          <JobCard
                            job={savedJob.job}
                            onApply={() => handleApply(savedJob.job!)}
                          />
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center py-20 bg-card rounded-2xl border border-border"
                >
                  <Heart className="mx-auto mb-4 text-foreground/30" size={48} />
                  <p className="text-foreground/60 mb-4 text-lg">Hali saqlangan ish yo'q</p>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => navigate('/qulay-ish')}
                    className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 transition-colors"
                  >
                    Ishlarni ko'rish
                    <ArrowRight size={18} />
                  </motion.button>
                </motion.div>
              )}
            </motion.div>
          </div>
        </div>

        {/* Apply Modal */}
        <ApplyModal
          job={selectedJob}
          profile={profile}
          isOpen={isApplyModalOpen}
          onClose={() => {
            setIsApplyModalOpen(false);
            setSelectedJob(null);
          }}
        />
      </Layout>
    </ProtectedRoute>
  );
}
