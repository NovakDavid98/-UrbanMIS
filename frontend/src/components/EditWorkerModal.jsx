import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { workersAPI } from '../services/api';

function EditWorkerModal({ isOpen, onClose, worker, onWorkerUpdated }) {
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    username: '',
    role: 'worker',
    is_active: true,
    password: '', // Optional - only if changing password
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (worker) {
      setFormData({
        first_name: worker.first_name || '',
        last_name: worker.last_name || '',
        email: worker.email || '',
        phone: worker.phone || '',
        username: worker.username || '',
        role: worker.role || 'worker',
        is_active: worker.is_active !== undefined ? worker.is_active : true,
        password: '',
      });
    }
  }, [worker]);

  const handleChange = (field, value) => {
    setFormData({ ...formData, [field]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    if (!formData.first_name || !formData.last_name || !formData.email || !formData.username) {
      toast.error('Vyplňte všechna povinná pole');
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      toast.error('Zadejte platnou emailovou adresu');
      return;
    }

    // Password validation if provided
    if (formData.password && formData.password.length < 6) {
      toast.error('Heslo musí obsahovat alespoň 6 znaků');
      return;
    }

    setIsSubmitting(true);
    try {
      // Remove password from data if it's empty
      const updateData = { ...formData };
      if (!updateData.password) {
        delete updateData.password;
      }

      const response = await workersAPI.update(worker.id, updateData);
      toast.success('Pracovník úspěšně aktualizován!');
      onWorkerUpdated(response.data.worker);
      handleClose();
    } catch (error) {
      console.error('Error updating worker:', error);
      const errorMessage = error.response?.data?.error || 'Nepodařilo se aktualizovat pracovníka';
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setFormData({
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      username: '',
      role: 'worker',
      is_active: true,
      password: '',
    });
    onClose();
  };

  if (!isOpen || !worker) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl transform transition-all">
          {/* Header */}
          <div className="border-b border-gray-200 px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  Upravit pracovníka
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  {worker.first_name} {worker.last_name}
                </p>
              </div>
              <button
                onClick={handleClose}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Content */}
          <form onSubmit={handleSubmit} className="px-6 py-6">
            <div className="space-y-6">
              {/* Personal Information */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Osobní údaje</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="label">Jméno *</label>
                    <input
                      type="text"
                      className="input"
                      value={formData.first_name}
                      onChange={(e) => handleChange('first_name', e.target.value)}
                      required
                    />
                  </div>

                  <div>
                    <label className="label">Příjmení *</label>
                    <input
                      type="text"
                      className="input"
                      value={formData.last_name}
                      onChange={(e) => handleChange('last_name', e.target.value)}
                      required
                    />
                  </div>

                  <div>
                    <label className="label">Email *</label>
                    <input
                      type="email"
                      className="input"
                      value={formData.email}
                      onChange={(e) => handleChange('email', e.target.value)}
                      required
                    />
                  </div>

                  <div>
                    <label className="label">Telefon</label>
                    <input
                      type="tel"
                      className="input"
                      value={formData.phone}
                      onChange={(e) => handleChange('phone', e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Account Settings */}
              <div className="border-t border-gray-200 pt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Nastavení účtu</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="label">Uživatelské jméno *</label>
                    <input
                      type="text"
                      className="input"
                      value={formData.username}
                      onChange={(e) => handleChange('username', e.target.value)}
                      required
                    />
                  </div>

                  <div>
                    <label className="label">Role *</label>
                    <select
                      className="input"
                      value={formData.role}
                      onChange={(e) => handleChange('role', e.target.value)}
                    >
                      <option value="worker">Pracovník (Worker)</option>
                      <option value="admin">Administrátor (Admin)</option>
                      <option value="viewer">Pozorovatel (Viewer)</option>
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <label className="label">Nové heslo (nechte prázdné pro zachování současného)</label>
                    <input
                      type="password"
                      className="input"
                      value={formData.password}
                      onChange={(e) => handleChange('password', e.target.value)}
                      placeholder="Min. 6 znaků"
                    />
                    {formData.password && (
                      <div className="mt-2">
                        <div className="flex items-center space-x-2 text-xs">
                          <div className={`h-1 flex-1 rounded-full ${
                            formData.password.length < 6 ? 'bg-red-400' :
                            formData.password.length < 10 ? 'bg-yellow-400' :
                            'bg-green-400'
                          }`} />
                          <span className={`${
                            formData.password.length < 6 ? 'text-red-600' :
                            formData.password.length < 10 ? 'text-yellow-600' :
                            'text-green-600'
                          }`}>
                            {formData.password.length < 6 ? 'Slabé' :
                             formData.password.length < 10 ? 'Dobré' :
                             'Silné'}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="md:col-span-2">
                    <label className="flex items-center space-x-3 cursor-pointer">
                      <input
                        type="checkbox"
                        className="w-5 h-5 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                        checked={formData.is_active}
                        onChange={(e) => handleChange('is_active', e.target.checked)}
                      />
                      <span className="text-sm font-medium text-gray-700">
                        Účet je aktivní
                      </span>
                    </label>
                    <p className="text-xs text-gray-500 mt-1 ml-8">
                      Neaktivní účty se nemohou přihlásit do systému
                    </p>
                  </div>
                </div>
              </div>

              {/* Warning about role */}
              {formData.role === 'admin' && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <div className="flex items-start">
                    <svg className="w-5 h-5 text-orange-600 mt-0.5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <div className="flex-1">
                      <h4 className="text-sm font-medium text-orange-900">Upozornění</h4>
                      <p className="text-sm text-orange-700 mt-1">
                        Role administrátora poskytuje plný přístup ke všem funkcím včetně správy uživatelů.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="mt-8 flex justify-end space-x-3">
              <button
                type="button"
                onClick={handleClose}
                className="btn btn-secondary"
                disabled={isSubmitting}
              >
                Zrušit
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="btn btn-primary"
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2" />
                    Ukládání...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Uložit změny
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default EditWorkerModal;






















