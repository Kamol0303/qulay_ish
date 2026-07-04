import { debugLogger } from '../../lib/debugLogger';
import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import DashboardLayout from '../../components/DashboardLayout';
import { useAuth } from '../../hooks/useAuth';
import { api } from '../../lib/api';
import { applicationService } from '../../services/applicationService';
import { contractService } from '../../services/contractService';
import { jobService } from '../../services/jobService';
import { Application, Job, Profile } from '../../types';
import { motion } from 'motion/react';
import { 
  FileText, 
  ChevronLeft, 
  DollarSign, 
  Calendar, 
  User, 
  Briefcase,
  AlertCircle,
  CheckCircle
} from 'lucide-react';

import { useTranslation } from 'react-i18next';

export default function CreateContract() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const appId = searchParams.get('appId');
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [application, setApplication] = useState<Application | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [worker, setWorker] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    amount: 0,
    startDate: '',
    endDate: '',
    terms: ''
  });

  useEffect(() => {
    async function fetchData() {
      if (!appId || !profile?.uid) return;
      try {
        const appData = await applicationService.getById(appId);
        if (!appData) {
          navigate('/employer/applicants');
          return;
        }
        setApplication(appData);

        const jobData = await jobService.getById(appData.jobId);
        if (jobData) {
          setJob(jobData);
          setFormData(prev => ({ ...prev, amount: jobData.price }));
        }

        const workerData = await api.users.get(appData.workerId).catch(() => null);
        if (workerData) setWorker(workerData);
      } catch (error) {
        debugLogger.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [appId, profile, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!application || !profile) return;
    setSubmitting(true);
    try {
      await contractService.create({
        jobId: application.jobId,
        workerId: application.workerId,
        employerId: profile.uid,
        title: job?.title || application.jobTitle || 'Shartnoma',
        amount: formData.amount,
        terms: formData.terms,
      });
      navigate('/employer/dashboard');
    } catch (error) {
      debugLogger.error('Error creating contract:', error);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <DashboardLayout><div className="p-8 animate-pulse">{t('common.loading')}...</div></DashboardLayout>;
  if (!application || !job || !worker) return <DashboardLayout><div className="p-8">{t('profile.not_found')}</div></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-8">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-muted-foreground hover:text-foreground font-bold transition-colors">
          <ChevronLeft size={20} />
          {t('common.back')}
        </button>

        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-[24px] bg-primary/10 flex items-center justify-center text-primary">
            <FileText size={32} />
          </div>
          <div>
            <h1 className="text-3xl font-black text-foreground tracking-tight">{t('contracts.create_title')}</h1>
            <p className="text-muted-foreground">{t('contracts.create_subtitle')}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-2">
            <form onSubmit={handleSubmit} className="bg-card rounded-[40px] border border-border p-8 shadow-sm space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-muted-foreground uppercase tracking-widest ml-1">{t('employer.dashboard.offered_price')} ({t('common.uzs')})</label>
                  <div className="relative">
                    <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
                    <input
                      type="number"
                      required
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })}
                      className="w-full pl-12 pr-4 py-4 bg-secondary/30 border border-border rounded-2xl focus:ring-2 focus:ring-primary outline-none font-bold"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-muted-foreground uppercase tracking-widest ml-1">{t('contracts.start_date')}</label>
                  <div className="relative">
                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
                    <input
                      type="date"
                      required
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                      className="w-full pl-12 pr-4 py-4 bg-secondary/30 border border-border rounded-2xl focus:ring-2 focus:ring-primary outline-none font-bold"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-muted-foreground uppercase tracking-widest ml-1">{t('contracts.end_date')}</label>
                  <div className="relative">
                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
                    <input
                      type="date"
                      required
                      value={formData.endDate}
                      onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                      className="w-full pl-12 pr-4 py-4 bg-secondary/30 border border-border rounded-2xl focus:ring-2 focus:ring-primary outline-none font-bold"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-muted-foreground uppercase tracking-widest ml-1">{t('contracts.terms')}</label>
                <textarea
                  rows={6}
                  required
                  placeholder={t('contracts.terms_placeholder')}
                  value={formData.terms}
                  onChange={(e) => setFormData({ ...formData, terms: e.target.value })}
                  className="w-full px-4 py-4 bg-secondary/30 border border-border rounded-2xl focus:ring-2 focus:ring-primary outline-none font-medium leading-relaxed"
                ></textarea>
              </div>

              <div className="bg-amber-50 border border-amber-100 p-6 rounded-3xl flex gap-4">
                <AlertCircle className="text-amber-600 shrink-0" size={24} />
                <p className="text-sm text-amber-800 leading-relaxed">
                  {t('contracts.warning_desc')}
                </p>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-5 bg-primary text-primary-foreground rounded-[24px] font-black text-lg shadow-xl shadow-primary/20 hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-3"
              >
                {submitting ? t('common.saving') : (
                  <>
                    <CheckCircle size={24} />
                    {t('contracts.confirm_and_send')}
                  </>
                )}
              </button>
            </form>
          </div>

          <div className="space-y-6">
            <div className="bg-card rounded-[32px] border border-border p-6 shadow-sm space-y-6">
              <h3 className="font-bold text-foreground uppercase tracking-widest text-xs text-muted-foreground">{t('contracts.parties')}</h3>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                    <Briefcase size={20} />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{t('auth.employer')}</p>
                    <p className="text-sm font-bold">{profile.fullName}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-green-50 text-green-600 flex items-center justify-center">
                    <User size={20} />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{t('auth.worker')}</p>
                    <p className="text-sm font-bold">{worker.fullName}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-card rounded-[32px] border border-border p-6 shadow-sm space-y-4">
              <h3 className="font-bold text-foreground uppercase tracking-widest text-xs text-muted-foreground">{t('contracts.job_info')}</h3>
              <p className="text-sm font-bold text-foreground">{job.title}</p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <DollarSign size={14} />
                {t('employer.dashboard.offered_price')}: {(job.price ?? 0).toLocaleString()} {t('common.uzs')}
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
