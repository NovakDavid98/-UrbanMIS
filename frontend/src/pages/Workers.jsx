import { useEffect, useState } from 'react';
import { workersAPI } from '../services/api';
import useAuthStore from '../store/authStore';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { cs } from 'date-fns/locale';
import { UsersIcon, UserGroupIcon, BriefcaseIcon, UserIcon } from '@heroicons/react/24/outline';
import AddWorkerModal from '../components/AddWorkerModal';
import EditWorkerModal from '../components/EditWorkerModal';

function Workers() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';

  const [workers, setWorkers] = useState([]);
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'table'

  const [filters, setFilters] = useState({
    search: '',
    role: 'all',
    status: 'all',
  });

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedWorker, setSelectedWorker] = useState(null);

  useEffect(() => {
    fetchWorkers();
    if (isAdmin) {
      fetchStats();
    }
  }, [filters, isAdmin]);

  const fetchWorkers = async () => {
    setIsLoading(true);
    try {
      const response = await workersAPI.getAll(filters);
      setWorkers(response.data.workers);
    } catch (error) {
      toast.error('Nepodařilo se načíst pracovníky');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await workersAPI.getStats();
      setStats(response.data.stats);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters({ ...filters, [key]: value });
  };

  const handleClearFilters = () => {
    setFilters({
      search: '',
      role: 'all',
      status: 'all',
    });
  };

  const handleWorkerAdded = (newWorker) => {
    fetchWorkers();
    fetchStats();
    setIsAddModalOpen(false);
    toast.success(`Pracovník ${newWorker.first_name} ${newWorker.last_name} byl přidán!`);
  };

  const handleWorkerUpdated = (updatedWorker) => {
    fetchWorkers();
    setIsEditModalOpen(false);
    setSelectedWorker(null);
    toast.success('Pracovník byl aktualizován!');
  };

  const handleEditClick = (worker) => {
    setSelectedWorker(worker);
    setIsEditModalOpen(true);
  };

  const handleDeleteClick = async (worker) => {
    if (!window.confirm(`Opravdu chcete smazat pracovníka ${worker.first_name} ${worker.last_name}?`)) {
      return;
    }

    try {
      await workersAPI.delete(worker.id);
      toast.success('Pracovník byl smazán');
      fetchWorkers();
      fetchStats();
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Nepodařilo se smazat pracovníka';
      toast.error(errorMessage);
    }
  };

  const getRoleBadgeClass = (role) => {
    switch (role) {
      case 'admin':
        return 'bg-gradient-to-r from-red-500 to-orange-500 text-white';
      case 'worker':
        return 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white';
      case 'viewer':
        return 'bg-gray-400 text-white';
      default:
        return 'bg-gray-400 text-white';
    }
  };

  const getRoleLabel = (role) => {
    switch (role) {
      case 'admin':
        return 'Administrátor';
      case 'worker':
        return 'Pracovník';
      case 'viewer':
        return 'Pozorovatel';
      default:
        return role;
    }
  };

  const getActiveFiltersCount = () => {
    let count = 0;
    if (filters.search) count++;
    if (filters.role !== 'all') count++;
    if (filters.status !== 'all') count++;
    return count;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center">
              <UsersIcon className="w-6 h-6 text-white" />
            </div>
            Pracovníci
          </h1>
          <p className="mt-1 text-gray-500 ml-14">
            {workers.length} {workers.length === 1 ? 'pracovník' : workers.length < 5 ? 'pracovníci' : 'pracovníků'} v týmu
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setViewMode(viewMode === 'grid' ? 'table' : 'grid')}
            className="btn btn-secondary p-2.5"
            title={viewMode === 'grid' ? 'Zobrazit jako tabulku' : 'Zobrazit jako mřížku'}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {viewMode === 'grid' ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              )}
            </svg>
          </button>
          {isAdmin && (
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="btn bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Nový pracovník
            </button>
          )}
        </div>
      </div>

      {/* Statistics Cards (Admin Only) */}
      {isAdmin && stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Celkem pracovníků</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{stats.total_workers}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
            </div>
            <div className="mt-3 flex items-center text-sm">
              <span className="text-green-600 font-medium">{stats.active_workers} aktivních</span>
            </div>
          </div>

          <div className="card p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Aktivní za měsíc</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{stats.active_last_month}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <div className="mt-3 text-sm text-gray-600">
              Přihlášení za posledních 30 dní
            </div>
          </div>

          <div className="card p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Průměrně klientů</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{stats.avg_clients_per_worker}</p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
            </div>
            <div className="mt-3 text-sm text-gray-600">
              Na pracovníka
            </div>
          </div>

          <div className="card p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Celkem výkonů</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{stats.total_services.toLocaleString()}</p>
              </div>
              <div className="w-12 h-12 bg-cyan-100 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
            </div>
            <div className="mt-3 text-sm text-gray-600">
              Zaznamenaných výkonů
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-3">
              <label className="label">Hledat</label>
              <input
                type="text"
                className="input"
                placeholder="Jméno, příjmení, email nebo uživatelské jméno..."
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
              />
            </div>

            <div>
              <label className="label">Role</label>
              <select
                className="input"
                value={filters.role}
                onChange={(e) => handleFilterChange('role', e.target.value)}
              >
                <option value="all">Všechny role</option>
                <option value="admin">Administrátor</option>
                <option value="worker">Pracovník</option>
                <option value="viewer">Pozorovatel</option>
              </select>
            </div>

            <div>
              <label className="label">Stav</label>
              <select
                className="input"
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
              >
                <option value="all">Všechny stavy</option>
                <option value="active">Aktivní</option>
                <option value="inactive">Neaktivní</option>
              </select>
            </div>

            <div className="flex items-end">
              {getActiveFiltersCount() > 0 && (
                <button
                  onClick={handleClearFilters}
                  className="btn btn-secondary w-full"
                >
                  Vyčistit filtry ({getActiveFiltersCount()})
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Workers List */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
            <p className="mt-4 text-gray-600">Načítání pracovníků...</p>
          </div>
        </div>
      ) : workers.length === 0 ? (
        <div className="text-center py-12 card">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
            />
          </svg>
          <h3 className="mt-2 text-lg font-medium text-gray-900">Žádní pracovníci</h3>
          <p className="mt-1 text-sm text-gray-500">Nenalezeni žádní pracovníci odpovídající zadaným kritériím.</p>
        </div>
      ) : (
        <>
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {workers.map((worker) => (
                <div
                  key={worker.id}
                  className="card p-5 flex flex-col items-center text-center hover:shadow-lg transition-shadow duration-200"
                >
                  {/* Avatar */}
                  <div className="w-20 h-20 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center text-2xl font-bold mb-3">
                    {worker.first_name?.[0]}{worker.last_name?.[0]}
                  </div>

                  {/* Name */}
                  <h3 className="text-lg font-semibold text-gray-900">
                    {worker.first_name} {worker.last_name}
                  </h3>
                  <p className="text-sm text-gray-500">@{worker.username}</p>

                  {/* Role Badge */}
                  <span className={`mt-3 px-3 py-1 rounded-full text-xs font-medium ${getRoleBadgeClass(worker.role)}`}>
                    {getRoleLabel(worker.role)}
                  </span>

                  {/* Status */}
                  <div className="mt-3">
                    {worker.is_active ? (
                      <span className="badge badge-success">Aktivní</span>
                    ) : (
                      <span className="badge badge-gray">Neaktivní</span>
                    )}
                  </div>

                  {/* Stats */}
                  <div className="mt-4 w-full space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Klientů:</span>
                      <span className="font-medium">{worker.created_clients_count || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Výkonů:</span>
                      <span className="font-medium">{worker.services_count || 0}</span>
                    </div>
                  </div>

                  {/* Contact */}
                  <div className="mt-4 w-full pt-4 border-t border-gray-200 space-y-1 text-xs text-gray-600">
                    <div className="flex items-center justify-center">
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      {worker.email}
                    </div>
                    {worker.phone && (
                      <div className="flex items-center justify-center">
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                        {worker.phone}
                      </div>
                    )}
                  </div>

                  {/* Actions (Admin Only) */}
                  {isAdmin && (
                    <div className="mt-4 flex space-x-2 w-full">
                      <button
                        onClick={() => handleEditClick(worker)}
                        className="flex-1 btn btn-secondary text-sm py-2"
                      >
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Upravit
                      </button>
                      <button
                        onClick={() => handleDeleteClick(worker)}
                        className="btn btn-secondary text-red-600 hover:bg-red-50 text-sm py-2 px-3"
                        title="Smazat"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  )}

                  {/* Last Login */}
                  {worker.last_login && (
                    <p className="mt-3 text-xs text-gray-500">
                      Naposledy: {format(new Date(worker.last_login), 'd. M. yyyy', { locale: cs })}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            /* Table View */
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Pracovník
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Role
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Kontakt
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Klienti / Výkony
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Stav
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Poslední přihlášení
                    </th>
                    {isAdmin && (
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Akce
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {workers.map((worker) => (
                    <tr key={worker.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center font-semibold mr-3">
                            {worker.first_name?.[0]}{worker.last_name?.[0]}
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {worker.first_name} {worker.last_name}
                            </div>
                            <div className="text-sm text-gray-500">@{worker.username}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getRoleBadgeClass(worker.role)}`}>
                          {getRoleLabel(worker.role)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{worker.email}</div>
                        {worker.phone && (
                          <div className="text-sm text-gray-500">{worker.phone}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {worker.created_clients_count || 0} klientů
                        </div>
                        <div className="text-sm text-gray-500">
                          {worker.services_count || 0} výkonů
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {worker.is_active ? (
                          <span className="badge badge-success">Aktivní</span>
                        ) : (
                          <span className="badge badge-gray">Neaktivní</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {worker.last_login
                          ? format(new Date(worker.last_login), 'd. M. yyyy HH:mm', { locale: cs })
                          : '—'}
                      </td>
                      {isAdmin && (
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                          <button
                            onClick={() => handleEditClick(worker)}
                            className="text-primary-600 hover:text-primary-900"
                          >
                            Upravit
                          </button>
                          <button
                            onClick={() => handleDeleteClick(worker)}
                            className="text-red-600 hover:text-red-900"
                          >
                            Smazat
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Modals */}
      <AddWorkerModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onWorkerAdded={handleWorkerAdded}
      />

      <EditWorkerModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedWorker(null);
        }}
        worker={selectedWorker}
        onWorkerUpdated={handleWorkerUpdated}
      />
    </div>
  );
}

export default Workers;
