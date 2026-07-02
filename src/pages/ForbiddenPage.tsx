import { useNavigate } from 'react-router-dom';
import { ShieldAlert, ArrowLeft, Home } from 'lucide-react';
import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';

export default function ForbiddenPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-red-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-2xl w-full text-center"
      >
        <div className="mb-8">
          <div className="inline-flex items-center justify-center w-24 h-24 bg-red-100 rounded-full mb-6">
            <ShieldAlert className="w-12 h-12 text-red-600" />
          </div>
          <h1 className="text-6xl font-black text-gray-900 mb-4">403</h1>
          <h2 className="text-2xl font-bold text-gray-700 mb-2">
            {t('errors.no_permission')}
          </h2>
          <p className="text-gray-500 max-w-md mx-auto">
            Sizda ushbu sahifaga kirish huquqi yo'q. Agar bu xato deb hisoblasangiz, administrator bilan bog'laning.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center justify-center px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            {t('common.back')}
          </button>
          <button
            onClick={() => navigate('/')}
            className="inline-flex items-center justify-center px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors"
          >
            <Home className="w-5 h-5 mr-2" />
            {t('errors.back_home')}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
