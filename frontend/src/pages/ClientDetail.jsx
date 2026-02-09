import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { clientsAPI, servicesAPI } from '../services/api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { cs } from 'date-fns/locale';
import EditClientModal from '../components/EditClientModal';
import EditServiceModal from '../components/EditServiceModal';
import useAuthStore from '../store/authStore';

function ClientDetail() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('services');
  const [isEditClientModalOpen, setIsEditClientModalOpen] = useState(false);
  const [isEditServiceModalOpen, setIsEditServiceModalOpen] = useState(false);
  const [selectedService, setSelectedService] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchClientData();
  }, [id]);

  const fetchClientData = async () => {
    try {
      const response = await clientsAPI.getById(id);
      setData(response.data);
    } catch (error) {
      toast.error('Nepodařilo se načíst data klienta');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClientUpdated = (updatedClient) => {
    // Refresh client data to show updated information
    fetchClientData();
  };

  const handleEditService = (service) => {
    setSelectedService(service);
    setIsEditServiceModalOpen(true);
  };

  const handleServiceUpdated = () => {
    fetchClientData();
  };

  const handleDeleteService = async (serviceId) => {
    if (!confirm('Opravdu chcete smazat tento výkon?')) return;

    try {
      await servicesAPI.delete(serviceId);
      toast.success('Výkon byl smazán');
      fetchClientData();
    } catch (error) {
      toast.error('Nepodařilo se smazat výkon');
      console.error(error);
    }
  };

  const handleDeleteClient = async () => {
    const confirmed = window.confirm('Opravdu chcete smazat tohoto klienta? Tato akce je nevratná.');
    if (!confirmed) return;

    setIsDeleting(true);
    try {
      await clientsAPI.delete(id);
      toast.success('Klient byl smazán');
      navigate('/clients');
    } catch (error) {
      console.error('Delete client error:', error);
      if (error.response?.status === 403) {
        toast.error('Nemáte oprávnění smazat klienta');
      } else {
        toast.error('Nepodařilo se smazat klienta');
      }
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          <p className="mt-4 text-gray-600">Načítání...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-gray-900">Klient nenalezen</h2>
        <Link to="/clients" className="mt-4 inline-block text-primary-600 hover:text-primary-700">
          ← Zpět na seznam klientů
        </Link>
      </div>
    );
  }

  const { client } = data;

  // Merge services and visits into one unified list
  const allActivities = [
    // Map services to unified format
    ...(data.recentServices || []).map(service => ({
      id: `service-${service.id}`,
      type: 'service',
      date: service.service_date,
      title: service.subject,
      description: service.description,
      serviceType: service.service_type,
      location: service.location,
      duration: service.duration_minutes,
      workerName: service.worker_first_name && service.worker_last_name
        ? `${service.worker_first_name} ${service.worker_last_name}`
        : null,
      originalData: service
    })),
    // Map visits to unified format
    ...(data.visits || []).map(visit => ({
      id: `visit-${visit.id}`,
      type: 'visit',
      date: visit.visit_date,
      title: 'Návštěva', // Default title for visits
      description: visit.notes,
      visitReasons: visit.visit_reasons || [],
      timeSpent: visit.time_spent,
      workerName: visit.worker_first_name && visit.worker_last_name
        ? `${visit.worker_first_name} ${visit.worker_last_name}`
        : null,
      originalData: visit
    }))
  ].sort((a, b) => new Date(b.date) - new Date(a.date)); // Sort by date descending

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex text-sm text-gray-500">
        <Link to="/clients" className="hover:text-gray-700">Klienti</Link>
        <span className="mx-2">/</span>
        <span className="text-gray-900">{client.first_name} {client.last_name}</span>
      </nav>

      {/* Header with Actions */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-gray-900">
              {client.first_name} {client.last_name}
            </h1>
            <span className={`badge ${client.activity_status === 'active' ? 'badge-success' :
              client.activity_status === 'inactive' ? 'badge-warning' :
                'badge-gray'
              }`}>
              {client.activity_status === 'active' ? 'Aktivní' :
                client.activity_status === 'inactive' ? 'Neaktivní' :
                  'Archivováno'}
            </span>
          </div>
          {client.nickname && (
            <p className="text-lg text-gray-500 mt-1">"{client.nickname}"</p>
          )}
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => setIsEditClientModalOpen(true)}
            className="btn btn-secondary"
          >
            Upravit
          </button>
          {isAdmin && (
            <button
              onClick={handleDeleteClient}
              disabled={isDeleting}
              className="btn bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
            >
              {isDeleting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Mazání...
                </>
              ) : (
                'Smazat klienta'
              )}
            </button>
          )}
        </div>
      </div>

      {/* Personal Info Card */}
      <div className="card">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Osobní údaje</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <InfoItem label="Pohlaví" value={client.gender || '—'} />
          <InfoItem label="Věk" value={client.age ? `${client.age} let` : '—'} />
          <InfoItem
            label="Datum narození"
            value={client.date_of_birth ? format(new Date(client.date_of_birth), 'd. MMMM yyyy', { locale: cs }) : '—'}
          />
          <InfoItem label="České tel. číslo" value={client.czech_phone || '—'} />
          <InfoItem label="Ukrajinské tel. číslo" value={client.ukrainian_phone || '—'} />
          <InfoItem label="Email" value={client.email || '—'} />
          <InfoItem label="Město v ČR" value={client.czech_city || '—'} />
          <InfoItem label="Adresa" value={client.czech_address || client.home_address || '—'} className="md:col-span-2" />
          <InfoItem
            label="Datum příjezdu do ČR"
            value={client.date_of_arrival_czech ? format(new Date(client.date_of_arrival_czech), 'd. MMMM yyyy', { locale: cs }) : '—'}
          />
          <InfoItem
            label="Registrace do projektu"
            value={client.project_registration_date ? format(new Date(client.project_registration_date), 'd. MMMM yyyy', { locale: cs }) : '—'}
          />
          <InfoItem label="Číslo víza" value={client.visa_number || '—'} />
          <InfoItem label="Typ víza" value={client.visa_type || '—'} />
          <InfoItem label="Pojišťovna" value={client.insurance_company || '—'} />
          <InfoItem label="Oblast Ukrajiny" value={client.ukrainian_region || '—'} />
        </div>

        {/* Location Status Section */}
        <div className="mt-6 pt-6 border-t border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">📍 Status klienta</h3>
          <div className="flex flex-wrap gap-6">
            <div className="flex items-center space-x-3">
              <div className={`w-6 h-6 rounded border-2 flex items-center justify-center ${client.went_to_ukraine
                ? 'bg-blue-500 border-blue-500'
                : 'bg-gray-100 border-gray-300'
                }`}>
                {client.went_to_ukraine && (
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <span className={`font-medium ${client.went_to_ukraine ? 'text-blue-700' : 'text-gray-600'}`}>
                Odjel na Ukrajinu
              </span>
            </div>

            <div className="flex items-center space-x-3">
              <div className={`w-6 h-6 rounded border-2 flex items-center justify-center ${client.is_in_ostrava
                ? 'bg-green-500 border-green-500'
                : 'bg-gray-100 border-gray-300'
                }`}>
                {client.is_in_ostrava && (
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <span className={`font-medium ${client.is_in_ostrava ? 'text-green-700' : 'text-gray-600'}`}>
                Ostrava
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Portal Notes */}
      {client.notes && (
        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">📝 Poznámky z portálu</h2>
          <div className="prose max-w-none text-gray-700 whitespace-pre-wrap">
            {client.notes}
          </div>
        </div>
      )}

      {/* Key Workers */}
      {data.keyWorkers?.length > 0 && (
        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Klíčoví pracovníci</h2>
          <div className="flex flex-wrap gap-3">
            {data.keyWorkers.map((worker) => (
              <div
                key={worker.id}
                className="flex items-center space-x-3 bg-gray-50 rounded-lg px-4 py-3"
              >
                <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center text-primary-600 font-semibold">
                  {worker.first_name[0]}{worker.last_name[0]}
                </div>
                <div>
                  <p className="font-medium text-gray-900">
                    {worker.first_name} {worker.last_name}
                  </p>
                  {worker.is_primary && (
                    <span className="badge badge-primary text-xs">Hlavní</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tags */}
      {data.tags?.length > 0 && (
        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Značky</h2>
          <div className="flex flex-wrap gap-2">
            {data.tags.map((tag) => (
              <span
                key={tag.id}
                className="badge"
                style={{ backgroundColor: tag.color + '20', color: tag.color }}
              >
                {tag.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="card p-0">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6" aria-label="Tabs">
            {[
              { id: 'services', label: `Výkony & Návštěvy (${allActivities.length})` },
              { id: 'contracts', label: `Smlouvy (${data.contracts?.length || 0})` },
              { id: 'plans', label: `Individuální plány (${data.individualPlans?.length || 0})` },
              { id: 'notes', label: `Poznámky (${data.notes?.length || 0})` },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === tab.id
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {/* Services & Visits Tab */}
          {activeTab === 'services' && (
            <div className="space-y-4">
              {allActivities.length > 0 ? (
                allActivities.map((activity) => (
                  <div
                    key={activity.id}
                    className={`border-l-4 pl-4 py-2 ${activity.type === 'service'
                      ? 'border-primary-400'
                      : 'border-green-400'
                      }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        {/* Header with type badge */}
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium text-gray-900">{activity.title}</h3>
                          {activity.type === 'visit' && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                              📋 Žurnál návštěv
                            </span>
                          )}
                          {activity.type === 'service' && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                              ⚡ Výkon
                            </span>
                          )}
                        </div>

                        {/* Date and metadata */}
                        <div className="mt-1 flex items-center flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500">
                          <span className="font-medium">{format(new Date(activity.date), 'd. MMMM yyyy', { locale: cs })}</span>

                          {/* Service-specific metadata */}
                          {activity.type === 'service' && (
                            <>
                              {activity.serviceType && (
                                <>
                                  <span>•</span>
                                  <span>{activity.serviceType}</span>
                                </>
                              )}
                              {activity.location && (
                                <>
                                  <span>•</span>
                                  <span>📍 {activity.location}</span>
                                </>
                              )}
                              {activity.duration && (
                                <>
                                  <span>•</span>
                                  <span>⏱️ {activity.duration} min</span>
                                </>
                              )}
                            </>
                          )}

                          {/* Visit-specific metadata */}
                          {activity.type === 'visit' && (
                            <>
                              {activity.timeSpent && (
                                <>
                                  <span>•</span>
                                  <span>⏱️ {activity.timeSpent}</span>
                                </>
                              )}
                            </>
                          )}
                        </div>

                        {/* Visit reasons (for visits) */}
                        {activity.type === 'visit' && activity.visitReasons && activity.visitReasons.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {activity.visitReasons.map((reason, idx) => (
                              <span
                                key={idx}
                                className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200"
                              >
                                {reason}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Description */}
                        {activity.description && (
                          <p className="mt-2 text-gray-700 whitespace-pre-wrap">{activity.description}</p>
                        )}

                        {/* Worker info */}
                        {activity.workerName && (
                          <p className="mt-2 text-sm text-gray-500">
                            👤 Pracovník: {activity.workerName}
                          </p>
                        )}
                      </div>

                      {/* Action buttons - only for services */}
                      {activity.type === 'service' && (
                        <div className="flex items-center space-x-2 ml-4">
                          <button
                            onClick={() => handleEditService(activity.originalData)}
                            className="text-gray-400 hover:text-blue-600 transition-colors"
                            title="Upravit výkon"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDeleteService(activity.originalData.id)}
                            className="text-gray-400 hover:text-red-600 transition-colors"
                            title="Smazat výkon"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-center text-gray-500 py-8">Žádné výkony ani návštěvy</p>
              )}
            </div>
          )}

          {/* Contracts Tab */}
          {activeTab === 'contracts' && (
            <div className="space-y-4">
              {data.contracts?.length > 0 ? (
                data.contracts.map((contract) => (
                  <div key={contract.id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900">{contract.title}</h3>
                        <div className="mt-1 text-sm text-gray-500">
                          {format(new Date(contract.start_date), 'd. MMMM yyyy', { locale: cs })}
                          {contract.end_date && ` — ${format(new Date(contract.end_date), 'd. MMMM yyyy', { locale: cs })}`}
                        </div>
                        {contract.description && (
                          <p className="mt-2 text-gray-700">{contract.description}</p>
                        )}
                      </div>
                      <span className={`badge ${contract.is_active ? 'badge-success' : 'badge-gray'}`}>
                        {contract.is_active ? 'Aktivní' : 'Neaktivní'}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-center text-gray-500 py-8">Žádné smlouvy</p>
              )}
            </div>
          )}

          {/* Individual Plans Tab */}
          {activeTab === 'plans' && (
            <div className="space-y-4">
              {data.individualPlans?.length > 0 ? (
                data.individualPlans.map((plan) => (
                  <div key={plan.id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900">{plan.title}</h3>
                        <p className="text-sm text-gray-500 mt-1">{plan.service_type}</p>
                      </div>
                      <span className={`badge ${plan.is_active ? 'badge-success' : 'badge-gray'}`}>
                        {plan.is_active ? 'Aktivní' : 'Ukončeno'}
                      </span>
                    </div>
                    {plan.description && (
                      <p className="text-gray-700 mb-3">{plan.description}</p>
                    )}
                    <div className="mb-3">
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-gray-600">Naplněno</span>
                        <span className="font-medium text-primary-600">{plan.completion_percentage}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-primary-600 h-2 rounded-full transition-all"
                          style={{ width: `${plan.completion_percentage}%` }}
                        ></div>
                      </div>
                    </div>
                    {plan.revisions?.length > 0 && (
                      <div className="mt-4 pt-4 border-t">
                        <h4 className="text-sm font-medium text-gray-900 mb-2">Revize</h4>
                        <div className="space-y-2">
                          {plan.revisions.map((revision) => (
                            <div key={revision.id} className="text-sm text-gray-600">
                              <span className="font-medium">{format(new Date(revision.revision_date), 'd. M. yyyy')}</span>
                              {revision.description && ` — ${revision.description}`}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-center text-gray-500 py-8">Žádné individuální plány</p>
              )}
            </div>
          )}

          {/* Notes Tab */}
          {activeTab === 'notes' && (
            <div className="space-y-4">
              {data.notes?.length > 0 ? (
                data.notes.map((note) => (
                  <div key={note.id} className="bg-gray-50 rounded-lg p-4 border-l-4 border-primary-500">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold text-gray-900">{note.title}</h3>
                      {note.is_important && (
                        <span className="badge badge-error">Důležité</span>
                      )}
                    </div>
                    <p className="text-gray-700 whitespace-pre-wrap">{note.content}</p>
                    <div className="mt-3 text-sm text-gray-500">
                      {format(new Date(note.created_at), 'd. MMMM yyyy HH:mm', { locale: cs })}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-center py-8">Zatím žádné poznámky</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Edit Client Modal */}
      <EditClientModal
        isOpen={isEditClientModalOpen}
        onClose={() => setIsEditClientModalOpen(false)}
        client={client}
        onClientUpdated={handleClientUpdated}
      />

      {/* Edit Service Modal */}
      <EditServiceModal
        isOpen={isEditServiceModalOpen}
        onClose={() => setIsEditServiceModalOpen(false)}
        service={selectedService}
        clientName={`${client.first_name} ${client.last_name}`}
        onServiceUpdated={handleServiceUpdated}
      />
    </div>
  );
}

function InfoItem({ label, value, className = '' }) {
  return (
    <div className={className}>
      <dt className="text-sm font-medium text-gray-500">{label}</dt>
      <dd className="mt-1 text-sm text-gray-900">{value}</dd>
    </div>
  );
}

export default ClientDetail;



