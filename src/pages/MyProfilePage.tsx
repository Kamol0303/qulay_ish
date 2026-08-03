import { Loader2 } from 'lucide-react';
import Layout from '../components/Layout';
import { useAuth } from '../hooks/useAuth';
import { useProfileEditor } from '../hooks/useProfileEditor';
import { WorkerProfileView } from '../components/profile/WorkerProfileView';
import { EmployerProfileView } from '../components/profile/EmployerProfileView';

export default function MyProfilePage() {
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

  return (
    <Layout>
      <div className="px-4 py-6 md:px-6 lg:px-8">
        {isEmployer ? (
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
