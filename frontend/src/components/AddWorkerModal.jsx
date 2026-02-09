import { useState } from 'react';
import toast from 'react-hot-toast';
import { workersAPI } from '../services/api';

function AddWorkerModal({ isOpen, onClose, onWorkerAdded }) {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    username: '',
    password: '',
    role: 'worker',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (field, value) => {
    setFormData({ ...formData, [field]: value });
  };

  const handleNext = () => {
    // Validation for each step
    if (currentStep === 1) {
      if (!formData.first_name || !formData.last_name || !formData.email) {
        toast.error('Vyplňte všechna povinná pole');
        return;
      }
      // Email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        toast.error('Zadejte platnou emailovou adresu');
        return;
      }
    } else if (currentStep === 2) {
      if (!formData.username || !formData.password) {
        toast.error('Vyplňte uživatelské jméno a heslo');
        return;
      }
      if (formData.password.length < 6) {
        toast.error('Heslo musí obsahovat alespoň 6 znaků');
        return;
      }
    }
    setCurrentStep(currentStep + 1);
  };

  const handleBack = () => {
    setCurrentStep(currentStep - 1);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const response = await workersAPI.create(formData);
      toast.success('Pracovník úspěšně přidán!');
      onWorkerAdded(response.data.worker);
      handleClose();
    } catch (error) {
      console.error('Error creating worker:', error);
      const errorMessage = error.response?.data?.error || 'Nepodařilo se přidat pracovníka';
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
      password: '',
      role: 'worker',
    });
    setCurrentStep(1);
    onClose();
  };

  if (!isOpen) return null;

  const totalSteps = 3;
  const progress = (currentStep / totalSteps) * 100;

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
              <h2 className="text-2xl font-bold text-gray-900">
                Přidat nového pracovníka
              </h2>
              <button
                onClick={handleClose}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Progress bar */}
            <div className="mt-4">
              <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
                <span>Krok {currentStep} z {totalSteps}</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-gradient-to-r from-blue-500 to-cyan-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="px-6 py-6">
            {/* Step 1: Basic Information */}
            {currentStep === 1 && (
              <div className="space-y-6 animate-fade-in">
                <div className="text-center mb-6">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-3">
                    <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900">Základní informace</h3>
                  <p className="text-gray-600 mt-1">Zadejte jméno a kontaktní údaje</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="label">Jméno *</label>
                    <input
                      type="text"
                      className="input"
                      value={formData.first_name}
                      onChange={(e) => handleChange('first_name', e.target.value)}
                      placeholder="Jan"
                    />
                  </div>

                  <div>
                    <label className="label">Příjmení *</label>
                    <input
                      type="text"
                      className="input"
                      value={formData.last_name}
                      onChange={(e) => handleChange('last_name', e.target.value)}
                      placeholder="Novák"
                    />
                  </div>

                  <div>
                    <label className="label">Email *</label>
                    <input
                      type="email"
                      className="input"
                      value={formData.email}
                      onChange={(e) => handleChange('email', e.target.value)}
                      placeholder="jan.novak@cehupo.cz"
                    />
                  </div>

                  <div>
                    <label className="label">Telefon</label>
                    <input
                      type="tel"
                      className="input"
                      value={formData.phone}
                      onChange={(e) => handleChange('phone', e.target.value)}
                      placeholder="+420 123 456 789"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Account Details */}
            {currentStep === 2 && (
              <div className="space-y-6 animate-fade-in">
                <div className="text-center mb-6">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-3">
                    <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900">Přihlašovací údaje</h3>
                  <p className="text-gray-600 mt-1">Nastavte uživatelské jméno, heslo a roli</p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="label">Uživatelské jméno *</label>
                    <input
                      type="text"
                      className="input"
                      value={formData.username}
                      onChange={(e) => handleChange('username', e.target.value)}
                      placeholder="jnovak"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Uživatelské jméno bude použito pro přihlášení
                    </p>
                  </div>

                  <div>
                    <label className="label">Heslo *</label>
                    <input
                      type="password"
                      className="input"
                      value={formData.password}
                      onChange={(e) => handleChange('password', e.target.value)}
                      placeholder="Min. 6 znaků"
                    />
                    <div className="mt-2">
                      <div className="flex items-center space-x-2 text-xs">
                        <div className={`h-1 flex-1 rounded-full ${
                          formData.password.length === 0 ? 'bg-gray-200' :
                          formData.password.length < 6 ? 'bg-red-400' :
                          formData.password.length < 10 ? 'bg-yellow-400' :
                          'bg-green-400'
                        }`} />
                        <span className={`${
                          formData.password.length === 0 ? 'text-gray-500' :
                          formData.password.length < 6 ? 'text-red-600' :
                          formData.password.length < 10 ? 'text-yellow-600' :
                          'text-green-600'
                        }`}>
                          {formData.password.length === 0 ? 'Zadejte heslo' :
                           formData.password.length < 6 ? 'Slabé' :
                           formData.password.length < 10 ? 'Dobré' :
                           'Silné'}
                        </span>
                      </div>
                    </div>
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
                    <div className="mt-2 space-y-1">
                      <p className="text-xs text-gray-600">
                        {formData.role === 'admin' && '🔴 Admin: Plný přístup ke všemu, včetně správy uživatelů'}
                        {formData.role === 'worker' && '🔵 Pracovník: Může spravovat klienty a přidávat výkony'}
                        {formData.role === 'viewer' && '⚪ Pozorovatel: Může pouze prohlížet data'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Review */}
            {currentStep === 3 && (
              <div className="space-y-6 animate-fade-in">
                <div className="text-center mb-6">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-3">
                    <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900">Zkontrolujte údaje</h3>
                  <p className="text-gray-600 mt-1">Před vytvořením účtu si zkontrolujte všechny údaje</p>
                </div>

                <div className="bg-gray-50 rounded-xl p-6 space-y-4">
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-2">Osobní údaje</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Celé jméno:</span>
                        <span className="font-medium">{formData.first_name} {formData.last_name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Email:</span>
                        <span className="font-medium">{formData.email}</span>
                      </div>
                      {formData.phone && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Telefon:</span>
                          <span className="font-medium">{formData.phone}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="border-t border-gray-200 pt-4">
                    <h4 className="text-sm font-medium text-gray-500 mb-2">Přihlašovací údaje</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Uživatelské jméno:</span>
                        <span className="font-medium">{formData.username}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Role:</span>
                        <span className={`badge ${
                          formData.role === 'admin' ? 'badge-error' :
                          formData.role === 'worker' ? 'badge-primary' :
                          'badge-gray'
                        }`}>
                          {formData.role === 'admin' ? 'Administrátor' :
                           formData.role === 'worker' ? 'Pracovník' :
                           'Pozorovatel'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start">
                    <svg className="w-5 h-5 text-blue-600 mt-0.5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="flex-1">
                      <h4 className="text-sm font-medium text-blue-900">Informace</h4>
                      <p className="text-sm text-blue-700 mt-1">
                        Po vytvoření účtu obdrží pracovník přihlašovací údaje. 
                        Heslo je možné změnit v nastavení profilu.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 rounded-b-2xl">
            <div className="flex justify-between">
              <button
                onClick={currentStep === 1 ? handleClose : handleBack}
                className="btn btn-secondary"
                disabled={isSubmitting}
              >
                {currentStep === 1 ? 'Zrušit' : 'Zpět'}
              </button>

              {currentStep < totalSteps ? (
                <button
                  onClick={handleNext}
                  className="btn btn-primary"
                >
                  Další
                  <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="btn btn-primary"
                >
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2" />
                      Vytváření...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Vytvořit účet
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AddWorkerModal;






















