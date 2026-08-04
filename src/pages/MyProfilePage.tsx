import { ArrowLeft, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Layout from '../components/Layout';
import { useAuth } from '../hooks/useAuth';
import { useProfileEditor } from '../hooks/useProfileEditor';
import { WorkerProfileView } from '../components/profile/WorkerProfileView';
import { EmployerProfileView } from '../components/profile/EmployerProfileView';

export default function MyProfilePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { profile, loading, refreshProfile } = useAuth();
  const editor = useProfileEditor(profile, refreshProfile);

  if (loading || !profile || !editor.draft) {
    return (
      <Layout>
        <div className="flex min-h-[50vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" aria-label="Yuklanmoqda" />
        </div>
      </Layout>
    );
  }

  const isEmployer = profile.role === 'employer';
  const isAdminPanel = profile.role === 'admin' || profile.role === 'super_admin';
  // Employer + Samarqand shahar hokimligi (admin) profile: stripped header nav
  const useMinimalNav = isEmployer || isAdminPanel;
  const backPath = isEmployer
    ? '/employer/dashboard'
    : isAdminPanel
      ? '/admin/dashboard'
      : '/worker/dashboard';

  return (
    <Layout minimalNav={useMinimalNav}>
      <div className="px-4 py-6 md:px-6 lg:px-8">
        {useMinimalNav && (
          <button
            type="button"
            onClick={() => navigate(backPath)}
            className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft size={18} />
            {t('common.back')}
          </button>
        )}
        {isEmployer || isAdminPanel ? (
          <EmployerProfileView
            draft={editor.draft}
            patch={editor.patch}
            save={editor.save}
            saving={editor.saving}
            error={editor.error}
            success={editor.success}
          />
        ) : (
          <WorkerProfileView
            draft={editor.draft}
            patch={editor.patch}
            save={editor.save}
            saving={editor.saving}
            error={editor.error}
            success={editor.success}
          />
        )}
      </div>
    </Layout>
  );
}
