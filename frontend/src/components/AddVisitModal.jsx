import { useState, useEffect } from 'react';
import { visitsAPI, clientsAPI } from '../services/api';
import toast from 'react-hot-toast';

function AddVisitModal({ isOpen, onClose, onVisitAdded }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [clients, setClients] = useState([]);
  const [visitReasons, setVisitReasons] = useState({ grouped: {} });
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoadingClients, setIsLoadingClients] = useState(false);

  const [formData, setFormData] = useState({
    clientId: '',
    visitDate: new Date().toISOString().split('T')[0],
    timeSpent: '',
    notes: '',
    visitReasonIds: []
  });

  useEffect(() => {
    if (isOpen) {
      fetchVisitReasons();
    }
  }, [isOpen]);

  // Debounced search - fetch clients as user types
  useEffect(() => {
    if (!isOpen) return;

    const timer = setTimeout(() => {
      fetchClients(searchTerm);
    }, 300); // Wait 300ms after user stops typing

    return () => clearTimeout(timer);
  }, [searchTerm, isOpen]);

  const fetchClients = async (search = '') => {
    setIsLoadingClients(true);
    try {
      const params = { limit: 50 }; // Load 50 at a time for better performance
      if (search.trim()) {
        params.search = search.trim();
      }
      const response = await clientsAPI.getAll(params);
      setClients(response.data.clients);
    } catch (error) {
      console.error('Error fetching clients:', error);
      toast.error('Nepodařilo se načíst klienty');
    } finally {
      setIsLoadingClients(false);
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

    if (!formData.clientId) {
      toast.error('Vyberte prosím klienta');
      return;
    }

    if (formData.visitReasonIds.length === 0) {
      toast.error('Vyberte alespoň jeden důvod návštěvy');
      return;
    }

    setIsSubmitting(true);
    try {
      await visitsAPI.create(formData);
      toast.success('Návštěva byla úspěšně přidána!');
      onVisitAdded();
      handleClose();
    } catch (error) {
      console.error('Error creating visit:', error);
      toast.error(error.response?.data?.error || 'Nepodařilo se přidat návštěvu');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setFormData({
      clientId: '',
      visitDate: new Date().toISOString().split('T')[0],
      timeSpent: '',
      notes: '',
      visitReasonIds: []
    });
    setSearchTerm('');
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

      {/* Modal - Match AddClientModal style */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-xl shadow-xl w-full max-w-4xl transform transition-all flex flex-col max-h-[90vh]">
          {/* Header - Flat & Clean */}
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-white rounded-t-xl shrink-0">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Nová návštěva</h2>
              <p className="mt-1 text-sm text-gray-500">Zaznamenejte návštěvu klienta</p>
            </div>
            <button
              onClick={handleClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content - Scrollable area */}
          <div className="overflow-y-auto p-6 space-y-5">
            <form id="add-visit-form" onSubmit={handleSubmit} className="space-y-5">
              {/* Client Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Klient <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Začněte psát jméno nebo číslo víza klienta..."
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      if (formData.clientId) {
                        setFormData(prev => ({ ...prev, clientId: '' })); // Clear selection on edit
                      }
                    }}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors pr-10 ${formData.clientId ? 'border-green-500 bg-green-50 text-green-900 font-medium' : 'border-gray-300'
                      }`}
                    autoFocus
                  />
                  {isLoadingClients ? (
                    <div className="absolute right-3 top-2.5">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-600"></div>
                    </div>
                  ) : formData.clientId ? (
                    <div className="absolute right-3 top-2.5 text-green-600">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  ) : null}

                  {/* Results Dropdown */}
                  {!formData.clientId && clients.length > 0 && searchTerm.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {clients.map((client) => (
                        <div
                          key={client.id}
                          onClick={() => {
                            setFormData(prev => ({ ...prev, clientId: client.id }));
                            setSearchTerm(`${client.last_name} ${client.first_name}`);
                            setClients([]); // Hide list
                          }}
                          className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-0 flex justify-between items-center group"
                        >
                          <div>
                            <div className="font-medium text-gray-900 group-hover:text-indigo-600">
                              {client.last_name} {client.first_name}
                            </div>
                            {client.visa_number && (
                              <div className="text-xs text-gray-500">
                                Vízum: {client.visa_number}
                              </div>
                            )}
                          </div>
                          <div className="text-gray-400 group-hover:text-indigo-600">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* No Results State */}
                  {!formData.clientId && searchTerm.length > 0 && clients.length === 0 && !isLoadingClients && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-center text-gray-500 text-sm">
                      Žádný klient nenalezen
                    </div>
                  )}
                </div>
              </div>

              {/* Date and Time */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Datum návštěvy <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.visitDate}
                    onChange={(e) => handleChange('visitDate', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Potřebený čas (HH:MM)
                  </label>
                  <input
                    type="time"
                    value={formData.timeSpent}
                    onChange={(e) => handleChange('timeSpent', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="např. 01:30"
                  />
                </div>
              </div>

              {/* Visit Reasons */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Důvody návštěvy <span className="text-red-500">*</span>
                  {formData.visitReasonIds.length > 0 && (
                    <span className="ml-2 text-xs font-normal text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                      Vybráno: {formData.visitReasonIds.length}
                    </span>
                  )}
                </label>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.keys(visitReasons.grouped).map((category) => {
                    const categoryInfo = categoryLabels[category];
                    const reasons = visitReasons.grouped[category];

                    if (!reasons || reasons.length === 0) return null;

                    return (
                      <div key={category} className="border border-gray-200 rounded-lg p-3 hover:border-indigo-200 transition-colors">
                        <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2 text-sm">
                          <span className="text-lg">{categoryInfo.icon}</span>
                          {categoryInfo.title}
                        </h4>
                        <div className="space-y-1">
                          {reasons.map((reason) => (
                            <label
                              key={reason.id}
                              className="flex items-center p-1.5 rounded cursor-pointer hover:bg-gray-50 transition-colors -mx-1.5"
                            >
                              <input
                                type="checkbox"
                                checked={formData.visitReasonIds.includes(reason.id)}
                                onChange={() => handleReasonToggle(reason.id)}
                                className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                              />
                              <span className="ml-2 text-sm text-gray-700">{reason.name_cs}</span>
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
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Poznámka
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => handleChange('notes', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  rows="3"
                  placeholder="Volitelná poznámka k návštěvě..."
                />
              </div>
            </form>
          </div>

          {/* Footer - Sticky Bottom */}
          <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-xl flex items-center justify-between shrink-0">
            <button
              onClick={handleClose}
              className="px-5 py-2.5 rounded-lg font-medium text-sm transition-colors border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              disabled={isSubmitting}
            >
              Zrušit
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || !formData.clientId || formData.visitReasonIds.length === 0}
              className="px-6 py-2.5 rounded-lg font-medium text-sm bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-colors disabled:opacity-75 flex items-center gap-2"
            >
              {isSubmitting ? 'Ukládání...' : 'Přidat návštěvu'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AddVisitModal;
