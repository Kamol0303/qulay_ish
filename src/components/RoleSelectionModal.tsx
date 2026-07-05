import { debugLogger } from '../lib/debugLogger';
import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Briefcase, Building2, Loader } from 'lucide-react';
import { authService } from '../lib/authService';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';

interface RoleSelectionModalProps {
  onComplete: () => void;
}

export default function RoleSelectionModal({ onComplete }: RoleSelectionModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { user, refreshProfile } = useAuth();
  const navigate = useNavigate();

  const handleRoleSelect = async (role: 'worker' | 'employer') => {
    if (!user) {
      setError('Foydalanuvchi topilmadi. Qayta kirish kerak.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const savedName = window.localStorage.getItem('qulayish_name_for_signin');
      await authService.createProfileWithRole(user, role, savedName || undefined);
      window.localStorage.removeItem('qulayish_name_for_signin');

      // Force-read the freshly written profile into context before navigating.
      // This prevents the race where onComplete() fires before the profile
      // snapshot propagates, causing AuthPage to see user+noProfile and loop.
      await refreshProfile();

      // Signal parent that role selection is done (hides the modal)
      onComplete();

      // Navigate directly — profile is now in context so no redirect loop
      const dest = role === 'worker' ? '/worker/dashboard' : '/employer/dashboard';
      navigate(dest, { replace: true });
    } catch (err) {
      debugLogger.error('Role selection error:', err);
      setError("Xatolik yuz berdi. Qayta urinib ko'ring.");
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[9999] p-4"
      onClick={(e) => e.stopPropagation()}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full p-8"
      >
        <div className="text-center mb-8">
          <h2 className="text-3xl font-black text-gray-900 mb-3">
            Hisob turini tanlang
          </h2>
          <p className="text-gray-600">
            Platformadan to'liq foydalanish uchun hisob turini belgilang
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => handleRoleSelect('worker')}
            disabled={loading}
            className="group relative bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-200 rounded-2xl p-8 hover:border-blue-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-20 h-20 bg-blue-500 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <Briefcase className="w-10 h-10 text-white" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Ishchi</h3>
                <p className="text-sm text-gray-600">
                  Ish qidirish, ariza topshirish, shartnomalar
                </p>
              </div>
            </div>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => handleRoleSelect('employer')}
            disabled={loading}
            className="group relative bg-gradient-to-br from-green-50 to-green-100 border-2 border-green-200 rounded-2xl p-8 hover:border-green-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-20 h-20 bg-green-500 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <Building2 className="w-10 h-10 text-white" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Ish beruvchi</h3>
                <p className="text-sm text-gray-600">
                  Ish e'lon qilish, ishchilar topish, boshqarish
                </p>
              </div>
            </div>
          </motion.button>
        </div>

        {loading && (
          <div className="flex items-center justify-center gap-3 text-blue-500 py-4">
            <Loader className="w-5 h-5 animate-spin" />
            <span className="font-medium">Profil yaratilmoqda...</span>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm text-center">
            {error}
          </div>
        )}
      </motion.div>
    </div>
  );
}
