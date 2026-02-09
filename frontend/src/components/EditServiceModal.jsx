import { useState, useEffect } from 'react';
import { servicesAPI } from '../services/api';
import toast from 'react-hot-toast';

function EditServiceModal({ isOpen, onClose, service, clientName, onServiceUpdated }) {
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    subject: '',
    serviceDate: '',
    durationMinutes: '',
    serviceType: '',
    location: '',
    topic: '',
    description: '',
  });

  // Load service data when modal opens
  useEffect(() => {
    if (isOpen && service) {
      setFormData({
        subject: service.subject || '',
        serviceDate: service.service_date || '',
        durationMinutes: service.duration_minutes || '',
        serviceType: service.service_type || '',
        location: service.location || '',
        topic: service.topic || '',
        description: service.description || '',
      });
    }
  }, [isOpen, service]);

  const steps = [
    { number: 1, title: 'Základní údaje', icon: '📋' },
    { number: 2, title: 'Kategorie', icon: '🏷️' },
    { number: 3, title: 'Popis výkonu', icon: '✍️' },
    { number: 4, title: 'Kontrola', icon: '✓' },
  ];

  const serviceTypes = [
    'Konzultace',
    'Doprovod',
    'Úvodní schůzka',
    'Psychologická konzultace',
    'Humanitární pomoc',
    'Interkulturní práce',
    'Jednání s institucí',
    'Informační servis',
    'Situační intervence',
    'Tlumočení',
    'Humanitární dávka',
  ];

  const locations = [
    'Asistenční centrum',
    'Terénní práce',
    'Klub',
    'Streetwork',
    'Ostatní',
  ];

  const topics = [
    'Zdravotnictví',
    'Bydlení',
    'Doklady/víza',
    'Dávka HUD',
    'Úřad',
    'Osobní, intimní',
    'Ostatní',
    'Vrstevnická skupina',
    'Psychologická pomoc',
    'Rodina',
  ];

  const handleChange = (field, value) => {
    setFormData({ ...formData, [field]: value });
  };

  const validateStep = (step) => {
    switch (step) {
      case 1:
        if (!formData.subject.trim()) {
          toast.error('Předmět výkonu je povinný');
          return false;
        }
        if (!formData.serviceDate) {
          toast.error('Datum výkonu je povinné');
          return false;
        }
        return true;
      case 2:
        if (!formData.serviceType) {
          toast.error('Typ služby je povinný');
          return false;
        }
        return true;
      case 3:
        return true;
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    setCurrentStep(currentStep - 1);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const payload = {
        subject: formData.subject,
        serviceType: formData.serviceType,
        serviceDate: formData.serviceDate,
        durationMinutes: formData.durationMinutes ? parseInt(formData.durationMinutes) : null,
        location: formData.location || null,
        topic: formData.topic || null,
        description: formData.description || null,
      };

      const response = await servicesAPI.update(service.id, payload);
      toast.success('Výkon byl úspěšně aktualizován!');
      onServiceUpdated(response.data.service);
      handleClose();
    } catch (error) {
      console.error('Error updating service:', error);
      toast.error(error.response?.data?.error || 'Nepodařilo se aktualizovat výkon');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setCurrentStep(1);
    onClose();
  };

  if (!isOpen || !service) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl transform transition-all">
          {/* Header */}
          <div className="px-8 pt-8 pb-6 border-b border-gray-200">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-3xl font-bold text-gray-900">Upravit výkon</h2>
                <p className="mt-1 text-gray-600">{clientName}</p>
              </div>
              <button
                onClick={handleClose}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Progress Steps */}
            <div className="flex items-center justify-between">
              {steps.map((step, index) => (
                <div key={step.number} className="flex items-center flex-1">
                  <div className="flex flex-col items-center flex-1">
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl transition-all ${
                        currentStep >= step.number
                          ? 'bg-blue-600 text-white shadow-lg scale-110'
                          : 'bg-gray-200 text-gray-400'
                      }`}
                    >
                      {step.icon}
                    </div>
                    <span className={`mt-2 text-xs font-medium ${
                      currentStep >= step.number ? 'text-blue-600' : 'text-gray-400'
                    }`}>
                      {step.title}
                    </span>
                  </div>
                  {index < steps.length - 1 && (
                    <div className={`h-1 flex-1 mx-2 rounded transition-all ${
                      currentStep > step.number ? 'bg-blue-600' : 'bg-gray-200'
                    }`} />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="px-8 py-6">
            {/* Step 1: Basic Details */}
            {currentStep === 1 && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Předmět výkonu <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.subject}
                    onChange={(e) => handleChange('subject', e.target.value)}
                    className="input"
                    placeholder="Stručný popis výkonu"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Datum výkonu <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={formData.serviceDate}
                      onChange={(e) => handleChange('serviceDate', e.target.value)}
                      className="input"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Délka trvání (minuty)
                    </label>
                    <input
                      type="number"
                      value={formData.durationMinutes}
                      onChange={(e) => handleChange('durationMinutes', e.target.value)}
                      className="input"
                      placeholder="např. 60"
                      min="0"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Category */}
            {currentStep === 2 && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Typ služby <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.serviceType}
                    onChange={(e) => handleChange('serviceType', e.target.value)}
                    className="input"
                    required
                  >
                    <option value="">Vyberte typ služby</option>
                    {serviceTypes.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Místo poskytnutí
                    </label>
                    <select
                      value={formData.location}
                      onChange={(e) => handleChange('location', e.target.value)}
                      className="input"
                    >
                      <option value="">Vyberte místo</option>
                      {locations.map((loc) => (
                        <option key={loc} value={loc}>
                          {loc}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Téma
                    </label>
                    <select
                      value={formData.topic}
                      onChange={(e) => handleChange('topic', e.target.value)}
                      className="input"
                    >
                      <option value="">Vyberte téma</option>
                      {topics.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Description */}
            {currentStep === 3 && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Podrobný popis výkonu
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => handleChange('description', e.target.value)}
                    className="input"
                    rows="10"
                    placeholder="Popište průběh a obsah výkonu, výsledky, další kroky..."
                  />
                  <p className="mt-2 text-sm text-gray-500">
                    Tento popis je nepovinný, ale doporučujeme jej vyplnit pro lepší dokumentaci.
                  </p>
                </div>
              </div>
            )}

            {/* Step 4: Review */}
            {currentStep === 4 && (
              <div className="space-y-6">
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-blue-900 mb-4">Zkontrolujte údaje před uložením</h3>
                  
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-medium text-gray-700 mb-2">Základní údaje</h4>
                      <div className="space-y-2 text-sm">
                        <div><span className="text-gray-600">Předmět:</span> <span className="font-medium">{formData.subject}</span></div>
                        <div><span className="text-gray-600">Datum:</span> <span className="font-medium">{formData.serviceDate}</span></div>
                        {formData.durationMinutes && <div><span className="text-gray-600">Délka:</span> <span className="font-medium">{formData.durationMinutes} minut</span></div>}
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium text-gray-700 mb-2">Kategorie</h4>
                      <div className="space-y-2 text-sm">
                        <div><span className="text-gray-600">Typ služby:</span> <span className="font-medium">{formData.serviceType}</span></div>
                        {formData.location && <div><span className="text-gray-600">Místo:</span> <span className="font-medium">{formData.location}</span></div>}
                        {formData.topic && <div><span className="text-gray-600">Téma:</span> <span className="font-medium">{formData.topic}</span></div>}
                      </div>
                    </div>

                    {formData.description && (
                      <div>
                        <h4 className="font-medium text-gray-700 mb-2">Popis</h4>
                        <div className="text-sm text-gray-700 bg-white p-3 rounded border border-gray-200 whitespace-pre-wrap">
                          {formData.description}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-8 py-6 bg-gray-50 rounded-b-2xl flex items-center justify-between">
            <button
              onClick={currentStep === 1 ? handleClose : handleBack}
              className="btn btn-secondary"
              disabled={isSubmitting}
            >
              {currentStep === 1 ? 'Zrušit' : 'Zpět'}
            </button>

            {currentStep < 4 ? (
              <button
                onClick={handleNext}
                className="btn btn-primary"
              >
                Další
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="btn btn-primary"
              >
                {isSubmitting ? 'Ukládání...' : 'Uložit změny'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default EditServiceModal;
