import React from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { Profile } from '../types';

export default function ResumeView() {
  const { userId } = useParams();
  const [profile, setProfile] = React.useState<Profile | null>(null);

  React.useEffect(() => {
    if (!userId) return;
    const fetch = async () => {
      try {
        const user = await api.users.get(userId);
        setProfile(user);
      } catch {
        setProfile(null);
      }
    };
    fetch();
  }, [userId]);

  if (!profile) return <div className="p-6">No resume available.</div>;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="bg-white rounded-2xl p-6 border border-border">
        <h3 className="text-xl font-bold mb-2">{profile.fullName}</h3>
        <div className="text-sm text-muted-foreground mb-4">{profile.region} {profile.district ? `, ${profile.district}` : ''}</div>

        <div className="mb-4">
          <div className="text-xs font-bold uppercase text-muted-foreground mb-2">Phone</div>
          <div className="text-sm">{profile.phoneNumber || '-'}</div>
        </div>

        <div className="mb-4">
          <div className="text-xs font-bold uppercase text-muted-foreground mb-2">Skills</div>
          <div className="flex flex-wrap gap-2">
            {profile.skills?.map((s, i) => <span key={i} className="bg-gray-100 px-3 py-1 rounded-full text-sm">{s}</span>)}
          </div>
        </div>

        <div className="mb-4">
          <div className="text-xs font-bold uppercase text-muted-foreground mb-2">Experience</div>
          {profile.experience?.map((e, i) => (
            <div key={i} className="mb-2">
              <div className="font-bold">{e.position} — {e.company}</div>
              <div className="text-sm text-muted-foreground">{e.startYear} — {e.endYear || 'Hozirgi kungacha'}</div>
              <div className="text-sm mt-1">{e.details}</div>
            </div>
          ))}
        </div>

        <div className="mb-4">
          <div className="text-xs font-bold uppercase text-muted-foreground mb-2">Education</div>
          {profile.education?.map((ed, i) => (
            <div key={i} className="mb-2">
              <div className="font-bold">{ed.institution} — {ed.degree}</div>
              <div className="text-sm text-muted-foreground">{ed.startYear} — {ed.endYear || ''}</div>
              <div className="text-sm mt-1">{ed.notes}</div>
            </div>
          ))}
        </div>

        <div>
          <div className="text-xs font-bold uppercase text-muted-foreground mb-2">Certificates</div>
          <div className="text-sm">
            {profile['certificates'] ? (profile['certificates'] as string[]).map((c, i) => <div key={i}>{c}</div>) : '-'}
          </div>
        </div>
      </div>
    </div>
  );
}
