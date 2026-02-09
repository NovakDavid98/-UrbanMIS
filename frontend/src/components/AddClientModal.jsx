import { useState } from 'react';
import { clientsAPI } from '../services/api';
import toast from 'react-hot-toast';
import AddressAutocomplete from './AddressAutocomplete';
import CityAutocomplete from './CityAutocomplete';
import LocationPicker from './LocationPicker';

function AddClientModal({ isOpen, onClose, onClientAdded }) {
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showMap, setShowMap] = useState(false);

  const [formData, setFormData] = useState({
    // Step 1: Basic Information
    firstName: '',
    lastName: '',
    nickname: '',
    gender: '',
    dateOfBirth: '',

    // Step 2: Contact Information
    czechCity: '',
    czechAddress: '',
    czechPhone: '',
    ukrainianPhone: '',
    email: '',
    notes: '',

    // Step 3: Immigration Details
    dateOfArrivalCzech: '',
    projectRegistrationDate: '',
    visaNumber: '',
    visaType: '',
    insuranceCompany: '',
    ukrainianRegion: '',
    latitude: null,
    longitude: null,
  });

  const steps = [
    {
      number: 1,
      title: 'Základní informace',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      )
    },
    {
      number: 2,
      title: 'Kontaktní údaje',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
        </svg>
      )
    },
    {
      number: 3,
      title: 'Imigrační údaje',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
        </svg>
      )
    },
    {
      number: 4,
      title: 'Kontrola',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      )
    },
  ];

  const handleChange = (field, value) => {
    // console.log(`📝 handleChange: ${field} = "${value}"`);
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const validateStep = (step) => {
    switch (step) {
      case 1:
        if (!formData.firstName.trim() || !formData.lastName.trim()) {
          toast.error('Jméno a příjmení jsou povinné');
          return false;
        }
        return true;
      case 2:
        if (formData.email && !formData.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
          toast.error('Neplatný formát emailu');
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
      const response = await clientsAPI.create(formData);
      toast.success('Klient byl úspěšně přidán!');
      onClientAdded(response.data.client);
      handleClose();
    } catch (error) {
      console.error('Error creating client:', error);
      toast.error(error.response?.data?.error || 'Nepodařilo se přidat klienta');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setFormData({
      firstName: '',
      lastName: '',
      nickname: '',
      gender: '',
      dateOfBirth: '',
      czechCity: '',
      czechAddress: '',
      czechPhone: '',
      ukrainianPhone: '',
      email: '',
      notes: '',
      dateOfArrivalCzech: '',
      projectRegistrationDate: '',
      visaNumber: '',
      visaType: '',
      insuranceCompany: '',
      ukrainianRegion: '',
      latitude: null,
      longitude: null,
    });
    setCurrentStep(1);
    setShowMap(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm transition-opacity"
        onClick={handleClose}
      />

      {/* Modal centered */}
      <div className="flex min-h-full items-center justify-center p-4">
        {/* Reduced width to max-w-4xl and adjusted padding */}
        <div className="relative bg-white rounded-xl shadow-xl w-full max-w-4xl transform transition-all">

          {/* Header - Flat, Clean, No Gradients */}
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-white rounded-t-xl">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Přidat nového klienta</h2>
              <p className="mt-1 text-sm text-gray-500">Vyplňte údaje o klientovi</p>
            </div>

            {/* Close Button */}
            <button
              onClick={handleClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Progress Steps - Custom SVGs, Flat Styles */}
          <div className="bg-gray-50 px-6 py-4 border-b border-gray-100">
            <div className="flex items-center justify-between max-w-3xl mx-auto">
              {steps.map((step, index) => {
                const isActive = currentStep === step.number;
                const isCompleted = currentStep > step.number;

                return (
                  <div key={step.number} className="flex items-center flex-1 last:flex-none">
                    <div className="flex flex-col items-center relative">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 border-2 ${isActive
                          ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                          : isCompleted
                            ? 'bg-green-600 border-green-600 text-white'
                            : 'bg-white border-gray-300 text-gray-400'
                          }`}
                      >
                        {isCompleted ? (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          step.icon
                        )}
                      </div>
                      <span
                        className={`absolute -bottom-6 w-32 text-center text-xs font-medium transition-colors ${isActive ? 'text-indigo-600' : isCompleted ? 'text-green-600' : 'text-gray-400'
                          }`}
                      >
                        {step.title}
                      </span>
                    </div>
                    {/* Connector Line */}
                    {index < steps.length - 1 && (
                      <div className={`flex-1 h-0.5 mx-4 ${isCompleted ? 'bg-green-600' : 'bg-gray-200'}`} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Form Content - Compact Grid Layouts */}
          <div className="px-6 py-6 mb-4">
            {/* Step 1: Basic Information */}
            {currentStep === 1 && (
              <div className="space-y-4 animate-fade-in">
                {/* 3-Column Grid for Names */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Jméno <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                      placeholder="např. Anna"
                      value={formData.firstName}
                      onChange={(e) => handleChange('firstName', e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Příjmení <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                      placeholder="např. Nováková"
                      value={formData.lastName}
                      onChange={(e) => handleChange('lastName', e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Přezdívka
                    </label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                      placeholder="např. Anka"
                      value={formData.nickname}
                      onChange={(e) => handleChange('nickname', e.target.value)}
                    />
                  </div>
                </div>

                {/* 3-Column Grid for Demographics */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Pohlaví
                    </label>
                    <select
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                      value={formData.gender}
                      onChange={(e) => handleChange('gender', e.target.value)}
                    >
                      <option value="">Vyberte...</option>
                      <option value="Žena">Žena</option>
                      <option value="Muž">Muž</option>
                      <option value="Nespecifikováno">Nespecifikováno</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Datum narození
                    </label>
                    <input
                      type="date"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      value={formData.dateOfBirth}
                      onChange={(e) => handleChange('dateOfBirth', e.target.value)}
                    />
                  </div>
                  {/* Empty column for spacing if needed, or maybe add 'Age' display if calculated */}
                </div>
              </div>
            )}

            {/* Step 2: Contact Information */}
            {currentStep === 2 && (
              <div className="space-y-4 animate-fade-in">
                {/* Address Row */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                  <div className="md:col-span-4">
                    <CityAutocomplete
                      value={formData.czechCity}
                      onChange={(value) => handleChange('czechCity', value)}
                      onSelect={(data) => handleChange('czechCity', data.city)}
                      label="Město"
                      placeholder="Hledat město..."
                    />
                  </div>
                  <div className="md:col-span-8">
                    <AddressAutocomplete
                      value={formData.czechAddress}
                      onChange={(value) => handleChange('czechAddress', value)}
                      onSelect={(data) => {
                        // Update both fields at once
                        setFormData(prev => ({
                          ...prev,
                          czechAddress: data.street,
                          czechCity: data.city || prev.czechCity,
                          latitude: data.lat ? parseFloat(data.lat) : prev.latitude,
                          longitude: data.lon ? parseFloat(data.lon) : prev.longitude
                        }));
                        if (data.lat && data.lon) {
                          // Optional: auto-show map or just show badge
                        }
                      }}
                      cityValue={formData.czechCity}
                      onCityChange={(city) => handleChange('czechCity', city)}
                      label="Ulice a číslo"
                      placeholder="Ulice..."
                    />
                  </div>
                </div>

                {/* Map Section - Simplified */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <button
                      type="button"
                      onClick={() => setShowMap(!showMap)}
                      className="text-sm font-medium text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        {showMap ? (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                        ) : (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        )}
                      </svg>
                      {showMap ? 'Skrýt mapu' : 'Zobrazit/Upřesnit na mapě'}
                    </button>
                    {formData.latitude && (
                      <span className="text-xs text-green-700 font-medium bg-green-50 px-2 py-1 rounded-full flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Souřadnice
                      </span>
                    )}
                  </div>
                  {showMap && (
                    <div className="h-64 w-full rounded-lg border border-gray-200 shadow-sm overflow-hidden mb-5">
                      <LocationPicker
                        className="w-full h-full"
                        latitude={formData.latitude}
                        longitude={formData.longitude}
                        onChange={async (lat, lon) => {
                          setFormData(prev => ({ ...prev, latitude: lat, longitude: lon }));
                          try {
                            const response = await fetch(`${import.meta.env.VITE_API_URL || '/api'}/geo/reverse?lat=${lat}&lon=${lon}`);
                            if (response.ok) {
                              const data = await response.json();
                              setFormData(prev => ({
                                ...prev,
                                latitude: lat,
                                longitude: lon,
                                czechCity: data.city || prev.czechCity,
                                czechAddress: data.street || prev.czechAddress
                              }));
                            }
                          } catch (error) {
                            console.error('Reverse geo error', error);
                          }
                        }}
                      />
                    </div>
                  )}
                </div>

                {/* Phones & Email Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">České tel.</label>
                    <input
                      type="tel"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      value={formData.czechPhone}
                      onChange={(e) => handleChange('czechPhone', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Ukrajinské tel.</label>
                    <input
                      type="tel"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      value={formData.ukrainianPhone}
                      onChange={(e) => handleChange('ukrainianPhone', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input
                      type="email"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      value={formData.email}
                      onChange={(e) => handleChange('email', e.target.value)}
                    />
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Poznámky</label>
                  <textarea
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    rows="2"
                    value={formData.notes}
                    onChange={(e) => handleChange('notes', e.target.value)}
                  />
                </div>
              </div>
            )}

            {/* Step 3: Immigration Details */}
            {currentStep === 3 && (
              <div className="space-y-4 animate-fade-in">
                {/* 3-Column Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Datum příjezdu</label>
                    <input type="date" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      value={formData.dateOfArrivalCzech} onChange={(e) => handleChange('dateOfArrivalCzech', e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Datum registrace</label>
                    <input type="date" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      value={formData.projectRegistrationDate} onChange={(e) => handleChange('projectRegistrationDate', e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Číslo víza</label>
                    <input type="text" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      value={formData.visaNumber} onChange={(e) => handleChange('visaNumber', e.target.value)} />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Typ víza</label>
                    <input type="text" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      value={formData.visaType} onChange={(e) => handleChange('visaType', e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Pojišťovna</label>
                    <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                      value={formData.insuranceCompany} onChange={(e) => handleChange('insuranceCompany', e.target.value)}>
                      <option value="">Vyberte...</option>
                      <option value="VZP">VZP</option>
                      <option value="OZP">OZP</option>
                      <option value="ČPZP">ČPZP</option>
                      <option value="ZPŠ">ZPŠ</option>
                      <option value="ZPMV">ZPMV</option>
                      <option value="RBP">RBP</option>
                      <option value="VoZP">VoZP</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">UA Region</label>
                    <input type="text" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      value={formData.ukrainianRegion} onChange={(e) => handleChange('ukrainianRegion', e.target.value)} />
                  </div>
                </div>
              </div>
            )}

            {/* Step 4: Review */}
            {currentStep === 4 && (
              <div className="space-y-4 animate-fade-in">
                <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-5">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Kontrola údajů
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 text-sm">
                    {/* Section 1 */}
                    <div>
                      <h4 className="font-medium text-gray-500 uppercase tracking-wider text-xs mb-2">Osobní údaje</h4>
                      <div className="space-y-1">
                        <p><span className="text-gray-500">Jméno:</span> <span className="font-medium text-gray-900">{formData.firstName} {formData.lastName}</span></p>
                        <p><span className="text-gray-500">Dat. nar.:</span> <span className="font-medium text-gray-900">{formData.dateOfBirth || '-'}</span></p>
                        <p><span className="text-gray-500">Pohlaví:</span> <span className="font-medium text-gray-900">{formData.gender || '-'}</span></p>
                      </div>
                    </div>

                    {/* Section 2 */}
                    <div>
                      <h4 className="font-medium text-gray-500 uppercase tracking-wider text-xs mb-2">Kontakt</h4>
                      <div className="space-y-1">
                        <p><span className="text-gray-500">Adresa:</span> <span className="font-medium text-gray-900">{formData.czechAddress}, {formData.czechCity}</span></p>
                        <p><span className="text-gray-500">Tel. ČR:</span> <span className="font-medium text-gray-900">{formData.czechPhone || '-'}</span></p>
                        <p><span className="text-gray-500">Email:</span> <span className="font-medium text-gray-900">{formData.email || '-'}</span></p>
                      </div>
                    </div>

                    {/* Section 3 - Immigration (if any data exists) */}
                    {(formData.dateOfArrivalCzech || formData.visaNumber || formData.insuranceCompany || formData.ukrainianRegion) && (
                      <div className="md:col-span-2 border-t border-indigo-100 pt-4 mt-2">
                        <h4 className="font-medium text-gray-500 uppercase tracking-wider text-xs mb-2">Imigrační údaje</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1">
                          <p><span className="text-gray-500">Příjezd:</span> <span className="font-medium text-gray-900">{formData.dateOfArrivalCzech ? new Date(formData.dateOfArrivalCzech).toLocaleDateString('cs-CZ') : '-'}</span></p>
                          <p><span className="text-gray-500">Víza:</span> <span className="font-medium text-gray-900">{formData.visaNumber} ({formData.visaType})</span></p>
                          <p><span className="text-gray-500">Pojišťovna:</span> <span className="font-medium text-gray-900">{formData.insuranceCompany}</span></p>
                          <p><span className="text-gray-500">Region UA:</span> <span className="font-medium text-gray-900">{formData.ukrainianRegion}</span></p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer Navigation - Flat & Clean */}
          <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-xl flex items-center justify-between">
            <button
              onClick={handleBack}
              disabled={currentStep === 1}
              className={`px-5 py-2.5 rounded-lg font-medium text-sm transition-colors border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 ${currentStep === 1 ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              Zpět
            </button>
            <div className="flex gap-3">
              <button
                onClick={handleClose}
                className="px-5 py-2.5 rounded-lg font-medium text-sm text-gray-600 hover:text-gray-900 transition-colors"
              >
                Zrušit
              </button>

              {currentStep < 4 ? (
                <button
                  onClick={handleNext}
                  className="px-6 py-2.5 rounded-lg font-medium text-sm bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-colors"
                >
                  Další
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="px-6 py-2.5 rounded-lg font-medium text-sm bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-colors disabled:opacity-75 flex items-center gap-2"
                >
                  {isSubmitting ? 'Ukládání...' : 'Vytvořit klienta'}
                </button>
              )}
            </div>
          </div>

        </div>
      </div>
    </div >
  );
}

export default AddClientModal;
