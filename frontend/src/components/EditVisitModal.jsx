import { useState, useEffect } from 'react';
import { visitsAPI } from '../services/api';
import toast from 'react-hot-toast';

function EditVisitModal({ isOpen, onClose, onVisitUpdated, visitId }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [visitReasons, setVisitReasons] = useState({ grouped: {} });
  const [clientName, setClientName] = useState('');
  
  const [formData, setFormData] = useState({
    visitDate: '',
    timeSpent: '',
    notes: '',
    visitReasonIds: []
  });

  useEffect(() => {
    if (isOpen && visitId) {
      fetchVisitData();
      fetchVisitReasons();
    }
  }, [isOpen, visitId]);

  const fetchVisitData = async () => {
    setIsLoading(true);
    try {
      const response = await visitsAPI.getById(visitId);
      const visit = response.data.visit;
      
      setClientName(`${visit.client_first_name} ${visit.client_last_name}`);
      setFormData({
        visitDate: visit.visit_date ? visit.visit_date.split('T')[0] : '',
        timeSpent: visit.time_spent || '',
        notes: visit.notes || '',
        visitReasonIds: visit.reason_ids || []
      });
    } catch (error) {
      console.error('Error fetching visit:', error);
      toast.error('Nepodařilo se načíst návštěvu');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchVisitReasons = async () => {
    try {
      const response = await visitsAPI.getReasons();
      setVisitReasons(response.data);
    } catch (error) {
      console.error('Error fetching visit reasons:', error);
    }
  };

  const handleChange = (field, value) => {
    setFormData({ ...formData, [field]: value });
  };

  const handleReasonToggle = (reasonId) => {
    const currentIds = formData.visitReasonIds;
    if (currentIds.includes(reasonId)) {
      // Remove reason
      setFormData({
        ...formData,
        visitReasonIds: currentIds.filter(id => id !== reasonId)
      });
    } else {
      // Add reason
      setFormData({
        ...formData,
        visitReasonIds: [...currentIds, reasonId]
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (formData.visitReasonIds.length === 0) {
      toast.error('Vyberte alespoň jeden důvod návštěvy');
      return;
    }
    
    setIsSubmitting(true);
    try {
      await visitsAPI.update(visitId, formData);
      toast.success('Návštěva byla úspěšně upravena!');
      onVisitUpdated();
      handleClose();
    } catch (error) {
      console.error('Error updating visit:', error);
      toast.error(error.response?.data?.error || 'Nepodařilo se upravit návštěvu');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setFormData({
      visitDate: '',
      timeSpent: '',
      notes: '',
      visitReasonIds: []
    });
    setClientName('');
    onClose();
  };

  if (!isOpen) return null;

  const categoryLabels = {
    warehouse: {
      title: 'Humanitární sklad',
      icon: '📦',
      color: 'border-orange-300 bg-orange-50'
    },
    assistance: {
      title: 'Asistenční centrum',
      icon: '🤝',
      color: 'border-blue-300 bg-blue-50'
    },
    community: {
      title: 'Komunitní centrum',
      icon: '👥',
      color: 'border-purple-300 bg-purple-50'
    },
    donations: {
      title: 'Přinesli (Dary)',
      icon: '🎁',
      color: 'border-green-300 bg-green-50'
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl transform transition-all max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 bg-white px-8 pt-8 pb-6 border-b border-gray-200 z-10">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-bold text-gray-900">Upravit návštěvu</h2>
                <p className="mt-1 text-gray-600">
                  Klient: <span className="font-semibold text-gray-900">{clientName}</span>
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
          </div>

          {/* Content */}
          {isLoading ? (
            <div className="px-8 py-12 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
              <p className="mt-2 text-gray-600">Načítání...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="px-8 py-6 space-y-6">
              {/* Client Name (Read-only) */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <span className="text-sm font-medium text-blue-900">
                    Upravujete návštěvu klienta: <span className="font-bold">{clientName}</span>
                  </span>
                </div>
                <p className="text-xs text-blue-700 mt-1 ml-7">
                  Klienta nelze změnit. Pro přiřazení návštěvy jinému klientovi vytvořte novou návštěvu.
                </p>
              </div>

              {/* Date and Time */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Datum návštěvy <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.visitDate}
                    onChange={(e) => handleChange('visitDate', e.target.value)}
                    className="input"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Potřebený čas (HH:MM)
                  </label>
                  <input
                    type="time"
                    value={formData.timeSpent}
                    onChange={(e) => handleChange('timeSpent', e.target.value)}
                    className="input"
                    placeholder="např. 01:30"
                  />
                </div>
              </div>

              {/* Visit Reasons - Multi-select with Categories */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Důvody návštěvy <span className="text-red-500">*</span>
                </label>
                <p className="text-xs text-gray-500 mb-4">
                  Vybráno: {formData.visitReasonIds.length} důvodů
                </p>
                
                <div className="space-y-4">
                  {Object.keys(visitReasons.grouped).map((category) => {
                    const categoryInfo = categoryLabels[category];
                    const reasons = visitReasons.grouped[category];
                    
                    if (!reasons || reasons.length === 0) return null;
                    
                    return (
                      <div key={category} className={`border-2 rounded-lg p-4 ${categoryInfo.color}`}>
                        <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                          <span className="text-2xl">{categoryInfo.icon}</span>
                          {categoryInfo.title}
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {reasons.map((reason) => (
                            <label
                              key={reason.id}
                              className="flex items-center p-2 rounded cursor-pointer hover:bg-white/50 transition-colors"
                            >
                              <input
                                type="checkbox"
                                checked={formData.visitReasonIds.includes(reason.id)}
                                onChange={() => handleReasonToggle(reason.id)}
                                className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                              />
                              <span className="ml-2 text-sm text-gray-900">{reason.name_cs}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Poznámka
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => handleChange('notes', e.target.value)}
                  className="input"
                  rows="4"
                  placeholder="Volitelná poznámka k návštěvě..."
                />
              </div>
            </form>
          )}

          {/* Footer */}
          <div className="sticky bottom-0 bg-gray-50 px-8 py-6 rounded-b-2xl flex items-center justify-between border-t border-gray-200">
            <button
              onClick={handleClose}
              className="btn btn-secondary"
              disabled={isSubmitting || isLoading}
            >
              Zrušit
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || isLoading || formData.visitReasonIds.length === 0}
              className="btn btn-primary"
            >
              {isSubmitting ? 'Ukládání...' : 'Uložit změny'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default EditVisitModal;

