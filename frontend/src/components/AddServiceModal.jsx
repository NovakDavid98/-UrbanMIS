import { useState } from 'react';
import { servicesAPI } from '../services/api';
import toast from 'react-hot-toast';

function AddServiceModal({ isOpen, onClose, clientId, clientName, onServiceAdded }) {
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    // Step 1: Basic Details
    subject: '',
    serviceDate: new Date().toISOString().split('T')[0], // Today's date
    durationMinutes: '',
    
    // Step 2: Category
    serviceType: '',
    location: '',
    topic: '',
    
    // Step 3: Description
    description: '',
  });

  const steps = [
    { number: 1, title: 'Základní údaje', icon: '📋' },
    { number: 2, title: 'Kategorie', icon: '🏷️' },
    { number: 3, title: 'Popis výkonu', icon: '✍️' },
    { number: 4, title: 'Kontrola', icon: '✓' },
  ];

  // Options based on database
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
        // Description is optional
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
        clientId: clientId,
        subject: formData.subject,
        serviceType: formData.serviceType,
        serviceDate: formData.serviceDate,
        durationMinutes: formData.durationMinutes ? parseInt(formData.durationMinutes) : null,
        location: formData.location || null,
        topic: formData.topic || null,
        description: formData.description || null,
      };

      const response = await servicesAPI.create(payload);
      toast.success('Výkon byl úspěšně přidán!');
      onServiceAdded(response.data.service);
      handleClose();
    } catch (error) {
      console.error('Error creating service:', error);
      toast.error(error.response?.data?.error || 'Nepodařilo se přidat výkon');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setFormData({
      subject: '',
      serviceDate: new Date().toISOString().split('T')[0],
      durationMinutes: '',
      serviceType: '',
      location: '',
      topic: '',
      description: '',
    });
    setCurrentStep(1);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl transform transition-all">
          {/* Header */}
          <div className="px-8 pt-8 pb-6 border-b border-gray-200">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-3xl font-bold text-gray-900">Přidat nový výkon</h2>
                <p className="mt-1 text-gray-600">
                  Pro klienta: <span className="font-semibold text-blue-600">{clientName}</span>
                </p>
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
                          ? 'bg-gradient-to-br from-blue-600 to-cyan-600 text-white shadow-lg scale-110'
                          : 'bg-gray-200 text-gray-400'
                      }`}
                    >
                      {step.icon}
                    </div>
                    <span
                      className={`mt-2 text-xs font-medium transition-colors ${
                        currentStep >= step.number ? 'text-blue-600' : 'text-gray-400'
                      }`}
                    >
                      {step.title}
                    </span>
                  </div>
                  {index < steps.length - 1 && (
                    <div
                      className={`h-1 flex-1 mx-2 rounded transition-all ${
                        currentStep > step.number ? 'bg-gradient-to-r from-blue-600 to-cyan-600' : 'bg-gray-200'
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Form Content */}
          <div className="px-8 py-6">
            {/* Step 1: Basic Details */}
            {currentStep === 1 && (
              <div className="space-y-6 animate-fade-in">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Předmět výkonu <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    placeholder="např. Konzultace ohledně bydlení"
                    value={formData.subject}
                    onChange={(e) => handleChange('subject', e.target.value)}
                    required
                  />
                  <p className="mt-1 text-sm text-gray-500">Stručný název výkonu</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Datum výkonu <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      value={formData.serviceDate}
                      onChange={(e) => handleChange('serviceDate', e.target.value)}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Délka trvání (minuty)
                    </label>
                    <input
                      type="number"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      placeholder="např. 60"
                      value={formData.durationMinutes}
                      onChange={(e) => handleChange('durationMinutes', e.target.value)}
                      min="0"
                      step="15"
                    />
                    <p className="mt-1 text-sm text-gray-500">Zadejte délku v minutách (volitelné)</p>
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex">
                    <svg className="w-5 h-5 text-blue-600 mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="text-sm text-blue-800">
                      <p className="font-medium">Tip</p>
                      <p>Vyplňte základní informace o výkonu. Kategorie a podrobný popis přidáte v dalších krocích.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Category */}
            {currentStep === 2 && (
              <div className="space-y-6 animate-fade-in">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Typ služby <span className="text-red-500">*</span>
                  </label>
                  <select
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white transition-all"
                    value={formData.serviceType}
                    onChange={(e) => handleChange('serviceType', e.target.value)}
                    required
                  >
                    <option value="">Vyberte typ služby</option>
                    {serviceTypes.map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Místo konání
                    </label>
                    <select
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white transition-all"
                      value={formData.location}
                      onChange={(e) => handleChange('location', e.target.value)}
                    >
                      <option value="">Vyberte místo</option>
                      {locations.map((loc) => (
                        <option key={loc} value={loc}>{loc}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Téma
                    </label>
                    <select
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white transition-all"
                      value={formData.topic}
                      onChange={(e) => handleChange('topic', e.target.value)}
                    >
                      <option value="">Vyberte téma</option>
                      {topics.map((topic) => (
                        <option key={topic} value={topic}>{topic}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-gray-900 mb-3">Rychlé kombinace:</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                    <button
                      type="button"
                      onClick={() => {
                        handleChange('serviceType', 'Konzultace');
                        handleChange('location', 'Asistenční centrum');
                        handleChange('topic', 'Bydlení');
                      }}
                      className="px-3 py-2 bg-white border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-all text-left"
                    >
                      🏠 Konzultace - Bydlení
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        handleChange('serviceType', 'Doprovod');
                        handleChange('location', 'Terénní práce');
                        handleChange('topic', 'Zdravotnictví');
                      }}
                      className="px-3 py-2 bg-white border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-all text-left"
                    >
                      🏥 Doprovod - Zdravotnictví
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        handleChange('serviceType', 'Psychologická konzultace');
                        handleChange('location', 'Asistenční centrum');
                        handleChange('topic', 'Psychologická pomoc');
                      }}
                      className="px-3 py-2 bg-white border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-all text-left"
                    >
                      🧠 Psychologická pomoc
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        handleChange('serviceType', 'Jednání s institucí');
                        handleChange('location', 'Terénní práce');
                        handleChange('topic', 'Úřad');
                      }}
                      className="px-3 py-2 bg-white border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-all text-left"
                    >
                      🏛️ Úřad - Jednání
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Description */}
            {currentStep === 3 && (
              <div className="space-y-6 animate-fade-in">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Podrobný popis výkonu
                  </label>
                  <textarea
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    rows="12"
                    placeholder="Popište detailně průběh výkonu, poskytnutou pomoc, výsledky a další relevantní informace...

Příklad:
S klientem byla realizována konzultace zaměřená na hledání vhodného bydlení. Byly probrány možnosti nájmu bytů v okolí, vysvětleny podmínky a pravidla nájemních smluv. Klientovi byla poskytnuta asistence při vyplňování žádosti o kauci. Společně jsme prošli nabídky na realitních portálech a vybrali 3 vhodné varianty k návštěvě."
                    value={formData.description}
                    onChange={(e) => handleChange('description', e.target.value)}
                  />
                  <p className="mt-2 text-sm text-gray-500">
                    Čím podrobnější popis, tím lepší přehled o poskytnuté pomoci
                  </p>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <div className="flex">
                    <svg className="w-5 h-5 text-amber-600 mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <div className="text-sm text-amber-800">
                      <p className="font-medium">Důležité</p>
                      <p>Popis je volitelný, ale doporučený. Pomůže vám i vašim kolegům lépe pochopit historii práce s klientem.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 4: Review */}
            {currentStep === 4 && (
              <div className="space-y-6 animate-fade-in">
                <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-6 border border-blue-200">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <svg className="w-6 h-6 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Zkontrolujte zadané údaje o výkonu
                  </h3>

                  {/* Client Info */}
                  <div className="mb-6 bg-white rounded-lg p-4 border border-blue-100">
                    <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center">
                      <span className="text-2xl mr-2">👤</span>
                      Klient
                    </h4>
                    <p className="font-medium text-gray-900">{clientName}</p>
                  </div>

                  {/* Basic Details */}
                  <div className="mb-6">
                    <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                      <span className="text-2xl mr-2">📋</span>
                      Základní údaje
                    </h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Předmět:</span>
                        <p className="font-medium text-gray-900">{formData.subject}</p>
                      </div>
                      <div>
                        <span className="text-gray-600">Datum:</span>
                        <p className="font-medium text-gray-900">
                          {new Date(formData.serviceDate).toLocaleDateString('cs-CZ')}
                        </p>
                      </div>
                      {formData.durationMinutes && (
                        <div>
                          <span className="text-gray-600">Délka trvání:</span>
                          <p className="font-medium text-gray-900">{formData.durationMinutes} minut</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Category */}
                  <div className="mb-6">
                    <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                      <span className="text-2xl mr-2">🏷️</span>
                      Kategorie
                    </h4>
                    <div className="grid grid-cols-1 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Typ služby:</span>
                        <p className="font-medium text-gray-900">{formData.serviceType}</p>
                      </div>
                      {formData.location && (
                        <div>
                          <span className="text-gray-600">Místo konání:</span>
                          <p className="font-medium text-gray-900">{formData.location}</p>
                        </div>
                      )}
                      {formData.topic && (
                        <div>
                          <span className="text-gray-600">Téma:</span>
                          <p className="font-medium text-gray-900">{formData.topic}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Description */}
                  {formData.description && (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                        <span className="text-2xl mr-2">✍️</span>
                        Popis výkonu
                      </h4>
                      <div className="bg-white rounded-lg p-4 border border-gray-200">
                        <p className="text-sm text-gray-900 whitespace-pre-wrap">{formData.description}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer with Navigation */}
          <div className="px-8 py-6 bg-gray-50 border-t border-gray-200 rounded-b-2xl">
            <div className="flex items-center justify-between">
              <button
                onClick={handleBack}
                disabled={currentStep === 1}
                className="px-6 py-3 rounded-lg font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Zpět
              </button>

              <div className="flex gap-3">
                <button
                  onClick={handleClose}
                  className="px-6 py-3 rounded-lg font-medium text-gray-700 hover:bg-gray-200 transition-all"
                >
                  Zrušit
                </button>

                {currentStep < 4 ? (
                  <button
                    onClick={handleNext}
                    className="px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-lg font-medium hover:shadow-lg transition-all flex items-center gap-2"
                  >
                    Další
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                ) : (
                  <button
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className="px-8 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg font-medium hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Ukládání...
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Přidat výkon
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AddServiceModal;
























