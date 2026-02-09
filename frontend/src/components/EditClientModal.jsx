import { useState, useEffect } from 'react';
import { clientsAPI } from '../services/api';
import toast from 'react-hot-toast';
import AddressAutocomplete from './AddressAutocomplete';
import CityAutocomplete from './CityAutocomplete';

function EditClientModal({ isOpen, onClose, client, onClientUpdated }) {
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    nickname: '',
    gender: '',
    dateOfBirth: '',
    homeAddress: '',
    czechCity: '',
    czechAddress: '',
    czechPhone: '',
    ukrainianPhone: '',
    email: '',
    dateOfArrivalCzech: '',
    projectRegistrationDate: '',
    visaNumber: '',
    visaType: '',
    insuranceCompany: '',
    ukrainianRegion: '',
    activityStatus: 'active',
    wentToUkraine: false,
    isInOstrava: false,
  });

  // Helper function to format date for input field
  const formatDateForInput = (dateString) => {
    if (!dateString) return '';
    // Extract just the date part (YYYY-MM-DD) from timestamp
    return dateString.split('T')[0];
  };

  // Load client data when modal opens
  useEffect(() => {
    if (isOpen && client) {
      setFormData({
        firstName: client.first_name || '',
        lastName: client.last_name || '',
        nickname: client.nickname || '',
        gender: client.gender || '',
        dateOfBirth: formatDateForInput(client.date_of_birth),
        homeAddress: client.home_address || '',
        czechCity: client.czech_city || '',
        czechAddress: client.czech_address || '',
        czechPhone: client.czech_phone || '',
        ukrainianPhone: client.ukrainian_phone || '',
        email: client.email || '',
        dateOfArrivalCzech: formatDateForInput(client.date_of_arrival_czech),
        projectRegistrationDate: formatDateForInput(client.project_registration_date),
        visaNumber: client.visa_number || '',
        visaType: client.visa_type || '',
        insuranceCompany: client.insurance_company || '',
        ukrainianRegion: client.ukrainian_region || '',
        activityStatus: client.activity_status || 'active',
        notes: client.notes || '',
        wentToUkraine: client.went_to_ukraine || false,
        isInOstrava: client.is_in_ostrava || false,
      });
    }
  }, [isOpen, client]);

  const steps = [
    { number: 1, title: 'Základní informace', icon: '👤' },
    { number: 2, title: 'Kontaktní údaje', icon: '📞' },
    { number: 3, title: 'Imigrační údaje', icon: '🛂' },
    { number: 4, title: 'Kontrola', icon: '✓' },
  ];

  const handleChange = (field, value) => {
    setFormData({ ...formData, [field]: value });
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
      const response = await clientsAPI.update(client.id, formData);
      toast.success('Klient byl úspěšně aktualizován!');
      onClientUpdated(response.data.client);
      handleClose();
    } catch (error) {
      console.error('Error updating client:', error);
      toast.error(error.response?.data?.error || 'Nepodařilo se aktualizovat klienta');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setCurrentStep(1);
    onClose();
  };

  if (!isOpen || !client) return null;

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
                <h2 className="text-3xl font-bold text-gray-900">Upravit klienta</h2>
                <p className="mt-1 text-gray-600">{client.first_name} {client.last_name}</p>
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
                      className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl transition-all ${currentStep >= step.number
                        ? 'bg-blue-600 text-white shadow-lg scale-110'
                        : 'bg-gray-200 text-gray-400'
                        }`}
                    >
                      {step.icon}
                    </div>
                    <span className={`mt-2 text-xs font-medium ${currentStep >= step.number ? 'text-blue-600' : 'text-gray-400'
                      }`}>
                      {step.title}
                    </span>
                  </div>
                  {index < steps.length - 1 && (
                    <div className={`h-1 flex-1 mx-2 rounded transition-all ${currentStep > step.number ? 'bg-blue-600' : 'bg-gray-200'
                      }`} />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="px-8 py-6">
            {/* Step 1: Basic Information */}
            {currentStep === 1 && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Jméno <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.firstName}
                      onChange={(e) => handleChange('firstName', e.target.value)}
                      className="input"
                      placeholder="Jméno"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Příjmení <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.lastName}
                      onChange={(e) => handleChange('lastName', e.target.value)}
                      className="input"
                      placeholder="Příjmení"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Přezdívka
                    </label>
                    <input
                      type="text"
                      value={formData.nickname}
                      onChange={(e) => handleChange('nickname', e.target.value)}
                      className="input"
                      placeholder="Přezdívka (nepovinné)"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Pohlaví
                    </label>
                    <select
                      value={formData.gender}
                      onChange={(e) => handleChange('gender', e.target.value)}
                      className="input"
                    >
                      <option value="">Vyberte pohlaví</option>
                      <option value="Muž">Muž</option>
                      <option value="Žena">Žena</option>
                      <option value="Nespecifikováno">Nespecifikováno</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Datum narození
                    </label>
                    <input
                      type="date"
                      value={formData.dateOfBirth}
                      onChange={(e) => handleChange('dateOfBirth', e.target.value)}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Status
                    </label>
                    <select
                      value={formData.activityStatus}
                      onChange={(e) => handleChange('activityStatus', e.target.value)}
                      className="input"
                    >
                      <option value="active">Aktivní</option>
                      <option value="inactive">Neaktivní</option>
                      <option value="archived">Archivováno</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Contact Information */}
            {currentStep === 2 && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <CityAutocomplete
                      value={formData.czechCity}
                      onChange={(value) => handleChange('czechCity', value)}
                      onSelect={(data) => {
                        handleChange('czechCity', data.city);
                      }}
                      label="Město v ČR"
                      placeholder="Začněte psát město..."
                    />
                  </div>
                  <div>
                    <AddressAutocomplete
                      value={formData.czechAddress}
                      onChange={(value) => handleChange('czechAddress', value)}
                      onSelect={(data) => {
                        handleChange('czechAddress', data.street);
                        if (data.city) handleChange('czechCity', data.city);
                      }}
                      cityValue={formData.czechCity}
                      onCityChange={(city) => handleChange('czechCity', city)}
                      label="Ulice a číslo"
                      placeholder="Začněte psát adresu..."
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      České telefonní číslo
                    </label>
                    <input
                      type="tel"
                      value={formData.czechPhone}
                      onChange={(e) => handleChange('czechPhone', e.target.value)}
                      className="input"
                      placeholder="+420 XXX XXX XXX"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Ukrajinské telefonní číslo
                    </label>
                    <input
                      type="tel"
                      value={formData.ukrainianPhone}
                      onChange={(e) => handleChange('ukrainianPhone', e.target.value)}
                      className="input"
                      placeholder="+380 XX XXX XXXX"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleChange('email', e.target.value)}
                    className="input"
                    placeholder="email@example.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Poznámky
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => handleChange('notes', e.target.value)}
                    className="input"
                    rows="3"
                    placeholder="Poznámky z portálu nebo jiné informace..."
                  />
                </div>
              </div>
            )}

            {/* Step 3: Immigration Details */}
            {currentStep === 3 && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Datum příjezdu do ČR
                    </label>
                    <input
                      type="date"
                      value={formData.dateOfArrivalCzech}
                      onChange={(e) => handleChange('dateOfArrivalCzech', e.target.value)}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Datum registrace v projektu
                    </label>
                    <input
                      type="date"
                      value={formData.projectRegistrationDate}
                      onChange={(e) => handleChange('projectRegistrationDate', e.target.value)}
                      className="input"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Číslo víza
                    </label>
                    <input
                      type="text"
                      value={formData.visaNumber}
                      onChange={(e) => handleChange('visaNumber', e.target.value)}
                      className="input"
                      placeholder="Číslo víza"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Typ víza
                    </label>
                    <input
                      type="text"
                      value={formData.visaType}
                      onChange={(e) => handleChange('visaType', e.target.value)}
                      className="input"
                      placeholder="Typ víza"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Pojišťovna
                    </label>
                    <input
                      type="text"
                      value={formData.insuranceCompany}
                      onChange={(e) => handleChange('insuranceCompany', e.target.value)}
                      className="input"
                      placeholder="Název pojišťovny"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Ukrajinský region
                    </label>
                    <input
                      type="text"
                      value={formData.ukrainianRegion}
                      onChange={(e) => handleChange('ukrainianRegion', e.target.value)}
                      className="input"
                      placeholder="Region původu"
                    />
                  </div>
                </div>

                {/* Location Status Checkboxes */}
                <div className="border-t pt-6 mt-6">
                  <h4 className="text-sm font-semibold text-gray-900 mb-4">📍 Status klienta</h4>
                  <div className="space-y-4">
                    <label className="flex items-center space-x-3 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={formData.wentToUkraine}
                        onChange={(e) => handleChange('wentToUkraine', e.target.checked)}
                        className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                      />
                      <span className="text-sm font-medium text-gray-700 group-hover:text-blue-600">
                        Odjel na Ukrajinu
                      </span>
                    </label>

                    <label className="flex items-center space-x-3 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={formData.isInOstrava}
                        onChange={(e) => handleChange('isInOstrava', e.target.checked)}
                        className="w-5 h-5 text-green-600 border-gray-300 rounded focus:ring-2 focus:ring-green-500"
                      />
                      <span className="text-sm font-medium text-gray-700 group-hover:text-green-600">
                        Ostrava
                      </span>
                    </label>
                  </div>
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
                      <h4 className="font-medium text-gray-700 mb-2">Základní informace</h4>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div><span className="text-gray-600">Jméno:</span> <span className="font-medium">{formData.firstName}</span></div>
                        <div><span className="text-gray-600">Příjmení:</span> <span className="font-medium">{formData.lastName}</span></div>
                        {formData.nickname && <div><span className="text-gray-600">Přezdívka:</span> <span className="font-medium">{formData.nickname}</span></div>}
                        {formData.gender && <div><span className="text-gray-600">Pohlaví:</span> <span className="font-medium">{formData.gender}</span></div>}
                        {formData.dateOfBirth && <div><span className="text-gray-600">Datum narození:</span> <span className="font-medium">{formData.dateOfBirth}</span></div>}
                        <div><span className="text-gray-600">Status:</span> <span className="font-medium">{formData.activityStatus === 'active' ? 'Aktivní' : formData.activityStatus === 'inactive' ? 'Neaktivní' : 'Archivováno'}</span></div>
                      </div>
                    </div>

                    {(formData.homeAddress || formData.czechPhone || formData.ukrainianPhone || formData.email) && (
                      <div>
                        <h4 className="font-medium text-gray-700 mb-2">Kontaktní údaje</h4>
                        <div className="grid grid-cols-1 gap-2 text-sm">
                          {formData.homeAddress && <div><span className="text-gray-600">Adresa:</span> <span className="font-medium">{formData.homeAddress}</span></div>}
                          {formData.czechPhone && <div><span className="text-gray-600">České tel.:</span> <span className="font-medium">{formData.czechPhone}</span></div>}
                          {formData.ukrainianPhone && <div><span className="text-gray-600">Ukrajinské tel.:</span> <span className="font-medium">{formData.ukrainianPhone}</span></div>}
                          {formData.email && <div><span className="text-gray-600">Email:</span> <span className="font-medium">{formData.email}</span></div>}
                        </div>
                      </div>
                    )}

                    {(formData.dateOfArrivalCzech || formData.visaNumber || formData.insuranceCompany || formData.ukrainianRegion) && (
                      <div>
                        <h4 className="font-medium text-gray-700 mb-2">Imigrační údaje</h4>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          {formData.dateOfArrivalCzech && <div><span className="text-gray-600">Příjezd do ČR:</span> <span className="font-medium">{formData.dateOfArrivalCzech}</span></div>}
                          {formData.projectRegistrationDate && <div><span className="text-gray-600">Registrace:</span> <span className="font-medium">{formData.projectRegistrationDate}</span></div>}
                          {formData.visaNumber && <div><span className="text-gray-600">Číslo víza:</span> <span className="font-medium">{formData.visaNumber}</span></div>}
                          {formData.visaType && <div><span className="text-gray-600">Typ víza:</span> <span className="font-medium">{formData.visaType}</span></div>}
                          {formData.insuranceCompany && <div><span className="text-gray-600">Pojišťovna:</span> <span className="font-medium">{formData.insuranceCompany}</span></div>}
                          {formData.ukrainianRegion && <div><span className="text-gray-600">Region:</span> <span className="font-medium">{formData.ukrainianRegion}</span></div>}
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

export default EditClientModal;
