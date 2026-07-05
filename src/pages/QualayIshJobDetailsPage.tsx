import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import Layout from '../components/Layout';
import { jobService } from '../services/jobService';
import { api } from '../lib/api';
import { Job, Profile } from '../types';
import { useTranslation } from 'react-i18next';
import {
  MapPin,
  Briefcase,
  DollarSign,
  Clock,
  AlertCircle,
  CheckCircle,
  AlertTriangle,
  User,
  Phone,
  Mail,
  ArrowLeft,
  Loader,
  Heart
} from 'lucide-react';
import { motion } from 'motion/react';
import {
  salaryEstimationService,
  unsafeJobDetectionService,
  savedJobsService
} from '../services/qulay-ish';
import ApplyModal from '../components/ApplyModal';

export default function QualayIshJobDetailsPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const { profile } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [job, setJob] = useState<Job | null>(null);
  const [employer, setEmployer] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Fetch job and employer details
  useEffect(() => {
    const loadData = async () => {
      if (!jobId) return;

      setLoading(true);
      try {
        const jobData = await jobService.getById(jobId);
        if (!jobData) {
          navigate('/qulay-ish');
          return;
        }
        setJob(jobData);

        const employerData = await api.users.get(jobData.employerId).catch(() => null);
        if (employerData) setEmployer(employerData);

        if (profile?.uid) {
          const saved = await savedJobsService.isJobSaved(profile.uid, jobId);
          setIsSaved(saved);
        }
      } catch {
        navigate('/qulay-ish');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [jobId, profile?.uid, navigate]);

  const handleSaveJob = async () => {
    if (!profile?.uid || !job?.id) return;

    setIsSaving(true);
    try {
      if (isSaved) {
        const result = await savedJobsService.unsaveJob(profile.uid, job.id);
        if (result.success) {
          setIsSaved(false);
        }
      } else {
        const result = await savedJobsService.saveJob(profile.uid, job.id);
        if (result.success) {
          setIsSaved(true);
        }
      }
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center items-center min-h-screen">
          <Loader className="animate-spin text-primary" size={48} />
        </div>
      </Layout>
    );
  }

  if (!job) {
    return (
      <Layout>
        <div className="text-center py-20">
          <p className="text-foreground/60">Ish topilmadi</p>
        </div>
      </Layout>
    );
  }

  // Calculate salary estimation
  const salaryEstimate = salaryEstimationService.estimateSalary({
    category: job.category || 'default',
    location: job.region || '',
    experienceLevel: 'intermediate',
    salaryType: job.salaryType || 'daily'
  });

  // Assess job safety
  const safetyAssessment = unsafeJobDetectionService.assessJobSafety(job);

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-background">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 text-foreground/60 hover:text-foreground mb-6 transition-colors"
            >
              <ArrowLeft size={20} />
              Orqaga
            </button>

            <div className="flex justify-between items-start gap-4 mb-6">
              <div>
                <h1 className="text-4xl font-bold mb-2">{job.title}</h1>
                <div className="flex flex-wrap items-center gap-4 text-foreground/60">
                  {job.region && (
                    <div className="flex items-center gap-1">
                      <MapPin size={18} />
                      <span>{job.region}</span>
                      {job.district && <span>• {job.district}</span>}
                    </div>
                  )}
                  {job.category && (
                    <div className="flex items-center gap-1">
                      <Briefcase size={18} />
                      <span>{job.category}</span>
                    </div>
                  )}
                </div>
              </div>

              {profile && (
                <motion.button
                  onClick={handleSaveJob}
                  disabled={isSaving}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  className={`p-3 rounded-full transition-all ${
                    isSaved
                      ? 'bg-red-100 text-red-500'
                      : 'bg-foreground/10 text-foreground/60 hover:text-red-500'
                  }`}
                >
                  <Heart size={24} fill={isSaved ? 'currentColor' : 'none'} />
                </motion.button>
              )}
            </div>
          </motion.div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            {/* Main Section */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="lg:col-span-2"
            >
              {/* Job Description */}
              <div className="bg-card rounded-2xl border border-border p-8 mb-6">
                <h2 className="text-2xl font-bold mb-4">Ish tavsifi</h2>
                <p className="text-foreground/70 leading-relaxed whitespace-pre-wrap">
                  {job.description || 'Tavsif ko\'rsatilmagan'}
                </p>
              </div>

              {/* Requirements */}
              {job.requirements && job.requirements.length > 0 && (
                <div className="bg-card rounded-2xl border border-border p-8 mb-6">
                  <h2 className="text-2xl font-bold mb-4">Talablar</h2>
                  <ul className="space-y-3">
                    {job.requirements.map((req, idx) => (
                      <motion.li
                        key={idx}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className="flex items-start gap-3 text-foreground/70"
                      >
                        <CheckCircle size={20} className="text-emerald-500 flex-shrink-0 mt-0.5" />
                        <span>{req}</span>
                      </motion.li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Employer Information */}
              {employer && (
                <div className="bg-card rounded-2xl border border-border p-8 mb-6">
                  <h2 className="text-2xl font-bold mb-4">Ish beruvchi</h2>
                  <div className="flex items-center gap-4 mb-4">
                    {employer.photoUrl && (
                      <img
                        src={employer.photoUrl}
                        alt={employer.fullName}
                        className="w-16 h-16 rounded-full object-cover"
                      />
                    )}
                    <div>
                      <p className="font-semibold text-lg">{employer.fullName}</p>
                      <p className="text-foreground/60">{employer.region}</p>
                    </div>
                  </div>

                  <div className="space-y-3 text-foreground/70">
                    {employer.phoneNumber && (
                      <div className="flex items-center gap-3">
                        <Phone size={18} />
                        <span>{employer.phoneNumber}</span>
                      </div>
                    )}
                    {employer.email && (
                      <div className="flex items-center gap-3">
                        <Mail size={18} />
                        <span>{employer.email}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </motion.div>

            {/* Sidebar */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="space-y-6"
            >
              {/* Salary Card */}
              <div className="bg-card rounded-2xl border border-border p-6">
                <div className="flex items-center gap-2 mb-4">
                  <DollarSign className="text-emerald-500" size={24} />
                  <h3 className="text-lg font-bold">Ish haqi</h3>
                </div>
                {job.salary || job.price ? (
                  <div>
                    <p className="text-3xl font-bold text-emerald-500 mb-1">
                      {salaryEstimationService.formatSalary(job.salary || job.price || 0, job.salaryType)}
                    </p>
                    <p className="text-sm text-foreground/60 mb-4">Taqlim etilgan ish haqi</p>

                    <div className="border-t border-border pt-4">
                      <p className="text-xs text-foreground/60 mb-2">Taxmin etilgan diapazoni:</p>
                      <p className="font-semibold">
                        {salaryEstimationService.formatSalaryRange(salaryEstimate)}
                      </p>
                      <p className="text-xs text-foreground/50 mt-2">
                        {salaryEstimate.confidence}% ishonch darajasi
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-foreground/60">Ko'rsatilmagan</p>
                )}
              </div>

              {/* Safety Assessment */}
              <div
                className={`rounded-2xl border p-6 ${
                  safetyAssessment.riskLevel === 'safe'
                    ? 'bg-emerald-500/10 border-emerald-500/20'
                    : safetyAssessment.riskLevel === 'warning'
                    ? 'bg-yellow-500/10 border-yellow-500/20'
                    : 'bg-red-500/10 border-red-500/20'
                }`}
              >
                <div className="flex items-center gap-2 mb-4">
                  {safetyAssessment.riskLevel === 'safe' ? (
                    <CheckCircle className="text-emerald-500" size={24} />
                  ) : safetyAssessment.riskLevel === 'warning' ? (
                    <AlertTriangle className="text-yellow-500" size={24} />
                  ) : (
                    <AlertCircle className="text-red-500" size={24} />
                  )}
                  <h3 className="text-lg font-bold">Xavfsizlik baholash</h3>
                </div>

                <p className="font-semibold mb-3">
                  {safetyAssessment.riskLevel === 'safe'
                    ? '✅ Xavfsiz'
                    : safetyAssessment.riskLevel === 'warning'
                    ? '⚠️ Ehtiyot qilish'
                    : '🚫 Xavfli'}
                </p>

                <p className="text-sm text-foreground/70 mb-4">
                  Xavfsizlik balları: {safetyAssessment.score}/100
                </p>

                {safetyAssessment.issues.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs font-semibold text-foreground/60 mb-2">Muammolar:</p>
                    <ul className="space-y-1">
                      {safetyAssessment.issues.map((issue, idx) => (
                        <li key={idx} className="text-xs text-foreground/60">
                          • {issue}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Apply Button */}
              {profile ? (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setIsApplyModalOpen(true)}
                  className="w-full px-6 py-3 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground rounded-xl font-semibold hover:shadow-lg transition-all"
                >
                  Arizaga berish
                </motion.button>
              ) : (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => navigate('/auth')}
                  className="w-full px-6 py-3 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground rounded-xl font-semibold hover:shadow-lg transition-all"
                >
                  Kirish
                </motion.button>
              )}
            </motion.div>
          </div>
        </div>
      </div>

      {/* Apply Modal */}
      <ApplyModal
        job={job}
        profile={profile}
        isOpen={isApplyModalOpen}
        onClose={() => setIsApplyModalOpen(false)}
      />
    </Layout>
  );
}
