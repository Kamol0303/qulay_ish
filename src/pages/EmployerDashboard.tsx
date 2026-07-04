import { debugLogger } from '../lib/debugLogger';
import React from 'react';
import { jobService } from '../services/jobService';
import { applicationService } from '../services/applicationService';
import { api } from '../lib/api';
import { Job, Application } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Briefcase, Users, CheckCircle, XCircle, Trash2, Image as ImageIcon, X } from 'lucide-react';
import Layout from '../components/Layout';
import { useAuth } from '../hooks/useAuth';
import { CATEGORIES } from '../constants/categories';
import { REGIONS, DISTRICTS } from '../constants/locations';
import { useTranslation } from 'react-i18next';
import { getDistrictKey } from '../lib/utils';

export default function EmployerDashboard() {
  const { t } = useTranslation();
  const { user, profile } = useAuth();
  const [jobs, setJobs] = React.useState<Job[]>([]);
  const [applications, setApplications] = React.useState<Application[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [isPosting, setIsPosting] = React.useState(false);
  const [newJob, setNewJob] = React.useState({
    title: '',
    description: '',
    category: '',
    price: '',
    region: '',
    district: '',
    neighborhood: ''
  });

  React.useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const load = async () => {
      try {
        const [jobRows, appRows] = await Promise.all([
          jobService.getByEmployer(user.uid),
          api.applications.list({ status: 'pending' }),
        ]);
        if (cancelled) return;
        setJobs(jobRows);
        setApplications(appRows.filter(a => jobRows.some(j => j.id === a.jobId)));
      } catch (error) {
        debugLogger.error('Employer dashboard load error:', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    const interval = setInterval(load, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [user]);

  const handlePostJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      await jobService.create({
        ...newJob,
        employerId: user.uid,
        price: Number(newJob.price),
        status: 'open',
        images: [],
      } as Parameters<typeof jobService.create>[0]);
      setIsPosting(false);
      setNewJob({
        title: '',
        description: '',
        category: '',
        price: '',
        region: '',
        district: '',
        neighborhood: ''
      });
    } catch (error) {
      debugLogger.error("Post job error:", error);
    }
  };

  const handleDeleteJob = async (jobId: string) => {
    if (window.confirm(t('employer.dashboard.delete_job_confirm'))) {
      await jobService.delete(jobId);
    }
  };

  const handleUpdateAppStatus = async (appId: string, status: 'accepted' | 'rejected') => {
    await applicationService.updateStatus(appId, status);
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex justify-between items-center mb-12">
          <div>
            <h1 className="text-3xl font-black text-gray-900 tracking-tight">{t('employer.dashboard.title')}</h1>
            <p className="text-gray-500">{t('employer.dashboard.subtitle')}</p>
          </div>
          <button
            onClick={() => setIsPosting(true)}
            className="bg-blue-500 text-white px-8 py-4 rounded-2xl font-bold flex items-center shadow-xl hover:bg-blue-600 transition-all"
          >
            <Plus size={20} className="mr-2" /> {t('employer.dashboard.post_job')}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Jobs List */}
          <div className="lg:col-span-2 space-y-6">
            <h2 className="text-xl font-black text-gray-900 tracking-tight flex items-center">
              <Briefcase size={24} className="mr-2 text-blue-600" /> {t('employer.dashboard.my_jobs')}
            </h2>
            {jobs.length > 0 ? (
              <div className="grid grid-cols-1 gap-4">
                {jobs.map(job => (
                  <div key={job.id} className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex justify-between items-center">
                    <div>
                      <h3 className="font-bold text-gray-900">{job.title}</h3>
                      <div className="text-xs text-gray-400 mt-1">
                        {t(`categories.${job.category}`, { defaultValue: job.category })} • {t(`districts.${getDistrictKey(job.district)}`, { defaultValue: job.district })}
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <div className="font-black text-blue-600">{job.price.toLocaleString()} {t('common.uzs')}</div>
                        <div className={`text-[10px] font-bold uppercase ${job.status === 'open' ? 'text-green-500' : 'text-gray-400'}`}>
                          {job.status === 'open' ? t('common.active') : t('common.closed')}
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteJob(job.id)}
                        className="p-2 text-gray-300 hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={20} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-3xl p-12 text-center border border-dashed border-gray-200">
                <p className="text-gray-400">{t('employer.dashboard.no_jobs')}</p>
              </div>
            )}
          </div>

          {/* Applications */}
          <div className="space-y-6">
            <h2 className="text-xl font-black text-gray-900 tracking-tight flex items-center">
              <Users size={24} className="mr-2 text-green-600" /> {t('employer.dashboard.new_applicants')}
            </h2>
            {applications.length > 0 ? (
              <div className="space-y-4">
                {applications.map(app => (
                  <div key={app.id} className="bg-white p-6 rounded-3xl border border-gray-100 shadow-lg">
                    <div className="flex items-center space-x-3 mb-4">
                      <div className="w-10 h-10 bg-gray-100 rounded-xl"></div>
                      <div>
                        <div className="font-bold text-gray-900 text-sm">{t('common.role')}: {t('auth.worker')}</div>
                        <div className="text-[10px] text-gray-400 font-bold uppercase">{t('employer.dashboard.applications')}</div>
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleUpdateAppStatus(app.id, 'accepted')}
                        className="flex-1 bg-green-50 text-green-600 py-2 rounded-xl text-xs font-bold hover:bg-green-100 transition-all flex items-center justify-center"
                      >
                        <CheckCircle size={14} className="mr-1" /> {t('employer.dashboard.accept')}
                      </button>
                      <button
                        onClick={() => handleUpdateAppStatus(app.id, 'rejected')}
                        className="flex-1 bg-red-50 text-red-600 py-2 rounded-xl text-xs font-bold hover:bg-red-100 transition-all flex items-center justify-center"
                      >
                        <XCircle size={14} className="mr-1" /> {t('employer.dashboard.reject')}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-3xl p-12 text-center border border-dashed border-gray-200">
                <p className="text-gray-400">{t('employer.dashboard.no_applicants')}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Post Job Modal */}
      <AnimatePresence>
        {isPosting && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsPosting(false)}
              className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm"
            ></motion.div>
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-2xl rounded-[40px] shadow-2xl relative z-10 overflow-hidden"
            >
              <div className="px-8 py-6 border-b border-gray-50 flex justify-between items-center">
                <h3 className="text-2xl font-black text-gray-900 tracking-tight">{t('employer.dashboard.post_job')}</h3>
                <button onClick={() => setIsPosting(false)} className="text-gray-400 hover:text-gray-600">
                  <X size={24} />
                </button>
              </div>
              <form onSubmit={handlePostJob} className="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">{t('employer.dashboard.job_title')}</label>
                    <input
                      required
                      type="text"
                      value={newJob.title}
                      onChange={(e) => setNewJob({ ...newJob, title: e.target.value })}
                      className="w-full px-5 py-3.5 rounded-2xl border border-gray-100 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                      placeholder={t('employer.dashboard.job_title_placeholder')}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">{t('common.category')}</label>
                    <select
                      required
                      value={newJob.category}
                      onChange={(e) => setNewJob({ ...newJob, category: e.target.value })}
                      className="w-full px-5 py-3.5 rounded-2xl border border-gray-100 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    >
                      <option value="">{t('common.select')}...</option>
                      {CATEGORIES.map(c => <option key={c.id} value={c.id}>{t(`categories.${c.id}`)}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">{t('employer.dashboard.offered_price')} ({t('common.uzs')})</label>
                    <input
                      required
                      type="number"
                      value={newJob.price}
                      onChange={(e) => setNewJob({ ...newJob, price: e.target.value })}
                      className="w-full px-5 py-3.5 rounded-2xl border border-gray-100 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                      placeholder="50000"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">{t('common.region')}</label>
                    <select
                      required
                      value={newJob.region}
                      onChange={(e) => setNewJob({ ...newJob, region: e.target.value, district: '' })}
                      className="w-full px-5 py-3.5 rounded-2xl border border-gray-100 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    >
                      <option value="">{t('common.select')}...</option>
                      {REGIONS.map(r => <option key={r} value={r}>{r === 'Samarqand viloyati' ? t('common.region_name') : r}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">{t('common.district')}</label>
                    <select
                      required
                      disabled={!newJob.region}
                      value={newJob.district}
                      onChange={(e) => setNewJob({ ...newJob, district: e.target.value })}
                      className="w-full px-5 py-3.5 rounded-2xl border border-gray-100 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all disabled:opacity-50"
                    >
                      <option value="">{t('common.select')}...</option>
                      {newJob.region && DISTRICTS[newJob.region]?.map(d => <option key={d} value={d}>{t(`districts.${getDistrictKey(d)}`)}</option>)}
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">{t('common.description')}</label>
                    <textarea
                      value={newJob.description}
                      onChange={(e) => setNewJob({ ...newJob, description: e.target.value })}
                      rows={4}
                      className="w-full px-5 py-3.5 rounded-2xl border border-gray-100 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none"
                      placeholder={t('employer.dashboard.job_desc_placeholder')}
                    />
                  </div>
                </div>
                <div className="pt-4">
                  <button
                    type="submit"
                    className="w-full bg-blue-500 text-white py-5 rounded-2xl font-black text-xl hover:bg-blue-600 shadow-xl transition-all"
                  >
                    {t('employer.dashboard.post_job')}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </Layout>
  );
}
