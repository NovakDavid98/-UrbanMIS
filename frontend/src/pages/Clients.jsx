import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { clientsAPI } from '../services/api';
import { aiSearch } from '../services/ragAPI';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import MonthPicker from '../components/MonthPicker';
import AddClientModal from '../components/AddClientModal';
import SmartSearchBar from '../components/SmartSearchBar';
import ResultLimitModal from '../components/ResultLimitModal';
import DeleteConfirmationModal from '../components/DeleteConfirmationModal';
import useAuthStore from '../store/authStore';
import {
  XMarkIcon,
  UserCircleIcon,
  PencilIcon,
  ClipboardDocumentIcon,
  TrashIcon,
  EyeIcon,
  EyeSlashIcon,
  ArrowPathIcon,
  AdjustmentsHorizontalIcon,
  FunnelIcon,
  PhoneIcon,
  MapPinIcon
} from '@heroicons/react/24/outline';
import ContextMenu, { ContextMenuItem, ContextMenuDivider, ContextMenuHeader } from '../components/ContextMenu';
import ColumnConfigPanel from '../components/ColumnConfigPanel';
import AddressCorrectionModal from '../components/AddressCorrectionModal';
import useTableConfig, { CLIENTS_COLUMNS } from '../hooks/useTableConfig';

function Clients() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';

  const [clients, setClients] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [filterOptions, setFilterOptions] = useState(null);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'table'
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, pages: 0 });
  const [sortOrder, setSortOrder] = useState('ASC'); // ASC = A-Z (normal), DESC = Z-A (reversed)
  const [filters, setFilters] = useState({
    search: '',
    activityStatus: 'all',
    gender: 'all',
    insurance: 'all',
    ukrainianRegion: 'all',
    visaType: 'all',
    ageMin: '',
    ageMax: '',
    addressSearch: '',
    registrationMonth: '',
  });
  const [useAISearch, setUseAISearch] = useState(false);
  const [aiSearchResults, setAISearchResults] = useState(null);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [pendingQuery, setPendingQuery] = useState(null);

  // Context Menu & Table Config
  const {
    visibleColumns,
    toggleColumn,
    reorderColumns,
    resetToDefault,
    isColumnVisible,
    getAllColumns
  } = useTableConfig('clients', CLIENTS_COLUMNS);

  const [isConfigPanelOpen, setIsConfigPanelOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const [menuContext, setMenuContext] = useState(null);
  const [isAddressCorrectionOpen, setIsAddressCorrectionOpen] = useState(false);
  const [addressCorrectionClient, setAddressCorrectionClient] = useState(null);

  // Multi-select for bulk delete
  const [selectedClients, setSelectedClients] = useState([]);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleContextMenu = (e, type, data) => {
    e.preventDefault();
    setMenuContext({ type, data });
    setMenuPosition({ x: e.clientX, y: e.clientY });
    setIsMenuOpen(true);
  };

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Zkopírováno do schránky');
      setIsMenuOpen(false);
    } catch (err) {
      toast.error('Nepodařilo se zkopírovat');
    }
  };

  const handleQuickFilter = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPagination(prev => ({ ...prev, page: 1 }));
    setIsMenuOpen(false);
    toast.success(`Filtr nastaven: ${value}`);
  };

  useEffect(() => {
    fetchFilterOptions();
  }, []);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchClients();
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [pagination.page, filters, sortOrder]);

  const fetchFilterOptions = async () => {
    try {
      const response = await clientsAPI.getFilterOptions();
      setFilterOptions(response.data);
    } catch (error) {
      console.error('Failed to fetch filter options:', error);
    }
  };

  const fetchClients = async () => {
    setIsLoading(true);
    try {
      const response = await clientsAPI.getAll({
        page: pagination.page,
        limit: pagination.limit,
        sortOrder,
        ...filters,
      });
      setClients(response.data.clients);
      setPagination(response.data.pagination);
    } catch (error) {
      toast.error('Nepodařilo se načíst klienty');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters({ ...filters, [key]: value });
    setPagination({ ...pagination, page: 1 });
  };

  const handleAISearch = async (query) => {
    try {
      setIsLoading(true);

      // First, do a quick check with limit 101 to see if there are more results
      const checkResponse = await aiSearch.searchClients(query, 101);

      if (checkResponse.results.length > 100) {
        // More than 100 results - ask user what they want
        setIsLoading(false);
        setPendingQuery(query);
        setShowLimitModal(true);
        return;
      }

      // 100 or fewer results - just show them
      // Use at least 1 to avoid validation error, or actual length if > 0
      const limit = checkResponse.results.length > 0 ? checkResponse.results.length : 100;
      performAISearch(query, limit);
    } catch (error) {
      console.error('AI search error:', error);
      toast.error('Chytré vyhledávání není dostupné');
      setIsLoading(false);
    }
  };

  const performAISearch = async (query, limit) => {
    try {
      setIsLoading(true);
      setUseAISearch(true);
      const response = await aiSearch.searchClients(query, limit);
      setAISearchResults(response);

      // Convert AI results to clients format
      const aiClients = response.results.map(result => ({
        id: result.payload.id,
        first_name: result.payload.first_name,
        last_name: result.payload.last_name,
        nickname: result.payload.nickname,
        gender: result.payload.gender,
        age: result.payload.age,
        czech_city: result.payload.city,
        czech_address: result.payload.address,
        ukrainian_region: result.payload.ukrainian_region,
        activity_status: result.payload.activity_status,
        _aiScore: result.score
      }));

      setClients(aiClients);
      setPagination({ ...pagination, total: aiClients.length, pages: 1 });
      toast.success(`Nalezeno ${aiClients.length} klientů`);
    } catch (error) {
      console.error('AI search error:', error);
      toast.error('Chytré vyhledávání není dostupné');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLimitConfirm = (limit) => {
    setShowLimitModal(false);
    if (pendingQuery) {
      performAISearch(pendingQuery, limit);
      setPendingQuery(null);
    }
  };

  const clearAISearch = () => {
    setUseAISearch(false);
    setAISearchResults(null);
    fetchClients();
  };

  const clearAllFilters = () => {
    setFilters({
      search: '',
      activityStatus: 'all',
      gender: 'all',
      insurance: 'all',
      ukrainianRegion: 'all',
      visaType: 'all',
      ageMin: '',
      ageMax: '',
      addressSearch: '',
      registrationMonth: '',
    });
    setPagination({ ...pagination, page: 1 });
  };

  const getActiveFiltersCount = () => {
    let count = 0;
    if (filters.search) count++;
    if (filters.activityStatus !== 'all') count++;
    if (filters.gender !== 'all') count++;
    if (filters.insurance !== 'all') count++;
    if (filters.ukrainianRegion !== 'all') count++;
    if (filters.visaType !== 'all') count++;
    if (filters.ageMin) count++;
    if (filters.ageMax) count++;
    if (filters.addressSearch) count++;
    if (filters.registrationMonth) count++;
    return count;
  };

  const handleClientAdded = (newClient) => {
    // Refresh the client list
    fetchClients();
  };

  const handleExportToExcel = async () => {
    setIsExporting(true);
    try {
      const response = await clientsAPI.exportToExcel(filters);

      // Create download link for Excel file
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      link.download = `klienti_export_${timestamp}.xlsx`;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success(`Export dokončen! Staženo ${pagination.total > 10000 ? '10 000' : pagination.total} klientů`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Export se nezdařil. Zkuste to prosím znovu.');
    } finally {
      setIsExporting(false);
    }
  };

  // Multi-select handlers
  const handleSelectClient = (clientId) => {
    setSelectedClients(prev =>
      prev.includes(clientId)
        ? prev.filter(id => id !== clientId)
        : [...prev, clientId]
    );
  };

  const handleSelectAll = () => {
    if (selectedClients.length === clients.length) {
      setSelectedClients([]);
    } else {
      setSelectedClients(clients.map(c => c.id));
    }
  };

  const handleBulkDelete = async () => {
    setIsDeleting(true);
    try {
      await clientsAPI.bulkDelete(selectedClients);
      toast.success(`Smazáno ${selectedClients.length} klientů`);
      setSelectedClients([]);
      setIsDeleteModalOpen(false);
      fetchClients();
    } catch (error) {
      console.error('Bulk delete error:', error);
      toast.error('Nepodařilo se smazat klienty');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Klienti</h1>
          <p className="mt-1 text-gray-600">
            Celkem <span className="font-semibold text-blue-600">{pagination.total}</span> klientů v databázi
          </p>
        </div>
        <div className="flex items-center gap-3">
          <MonthPicker
            selectedDate={filters.registrationMonth ? new Date(filters.registrationMonth + '-01') : null}
            onChange={(date) => handleFilterChange('registrationMonth', date ? format(date, 'yyyy-MM') : '')}
            placeholder="Registrace"
            className="w-44"
          />
          {/* Sort Order Toggle */}
          <button
            onClick={() => setSortOrder(sortOrder === 'ASC' ? 'DESC' : 'ASC')}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all shadow-sm ${sortOrder === 'DESC'
              ? 'bg-indigo-50 border-indigo-300 text-indigo-700 ring-1 ring-indigo-400'
              : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            title={sortOrder === 'ASC' ? 'Klikněte pro obrácené pořadí (Z-A)' : 'Klikněte pro normální pořadí (A-Z)'}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {sortOrder === 'ASC' ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4" />
              )}
            </svg>
            <span className="text-sm font-medium">Řazení: {sortOrder === 'ASC' ? 'A-Z ↑' : 'Z-A ↓'}</span>
          </button>


          {/* View Mode Toggle */}
          <div className="hidden sm:flex items-center bg-white rounded-lg border border-gray-200 p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${viewMode === 'grid'
                ? 'bg-indigo-600 text-white'
                : 'text-gray-600 hover:bg-gray-100'
                }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${viewMode === 'table'
                ? 'bg-indigo-600 text-white'
                : 'text-gray-600 hover:bg-gray-100'
                }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
            </button>
          </div>
          <button
            onClick={handleExportToExcel}
            disabled={isLoading || isExporting || clients.length === 0}
            className="btn btn-secondary shadow-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Exportovat aktuální výsledky do Excelu"
          >
            {isExporting ? (
              <>
                <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin"></div>
                <span>Exportuji...</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>Export do Excelu</span>
              </>
            )}
          </button>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="btn bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Nový klient
          </button>
          {/* Delete Selected Button */}
          {selectedClients.length > 0 && isAdmin && (
            <button
              onClick={() => setIsDeleteModalOpen(true)}
              className="btn bg-red-600 text-white hover:bg-red-700 shadow-lg flex items-center gap-2"
            >
              <TrashIcon className="w-5 h-5" />
              Smazat vybrané ({selectedClients.length})
            </button>
          )}
        </div>
      </div>

      {/* Smart Search Active Banner */}
      {useAISearch && aiSearchResults && (
        <div className="bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-lg">🔍</span>
              <span className="font-semibold text-purple-900">Chytré vyhledávání aktivní</span>
              <span className="text-sm text-purple-700">
                ({aiSearchResults.count} výsledků)
              </span>
            </div>
            <button
              onClick={clearAISearch}
              className="px-4 py-2 bg-white text-purple-700 border border-purple-300 rounded-lg hover:bg-purple-50 transition-colors flex items-center gap-2"
            >
              <XMarkIcon className="w-4 h-4" />
              Zrušit chytré vyhledávání
            </button>
          </div>
          {aiSearchResults.understanding && (
            <p className="text-sm text-purple-700">
              Pochopeno: <span className="font-medium">{aiSearchResults.understanding.intent}</span>
            </p>
          )}
        </div>
      )}

      {/* Unified Smart Search Bar */}
      <SmartSearchBar
        onAISearch={handleAISearch}
        onFilterSearch={(newFilters) => {
          setFilters({ ...filters, ...newFilters });
          setPagination({ ...pagination, page: 1 });
        }}
        filterOptions={filterOptions}
        currentFilters={filters}
        placeholder="Hledat klienty... (Zkuste: 'zobraz ženy z Teplic od 20 do 30 s VZP')"
        aiExamples={[
          "zobraz ženy z Teplic od 20 do 30",
          "muži starší 40 let s VZP",
          "lidé z Ústí nad Labem s OZP",
          "ženy z Kyjeva",
          "aktivní klienti s vízem MULT"
        ]}
        showAdvancedFilters={showAdvancedFilters}
        onToggleAdvancedFilters={setShowAdvancedFilters}
        type="clients"
      />

      {/* Old Filters Section - REMOVED */}
      <div className="hidden">
        {/* Advanced Filters */}
        {showAdvancedFilters && (
          <div className="pt-4 border-t border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Věk
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    placeholder="Od"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    value={filters.ageMin}
                    onChange={(e) => handleFilterChange('ageMin', e.target.value)}
                    min="0"
                    max="120"
                  />
                  <span className="text-gray-400">-</span>
                  <input
                    type="number"
                    placeholder="Do"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    value={filters.ageMax}
                    onChange={(e) => handleFilterChange('ageMax', e.target.value)}
                    min="0"
                    max="120"
                  />
                </div>
              </div>

              {/* Address Search Filter */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  🏠 Adresa / Město
                </label>
                <div className="relative">
                  <svg
                    className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                  <input
                    type="text"
                    placeholder="Hledat podle města nebo adresy..."
                    className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    value={filters.addressSearch}
                    onChange={(e) => handleFilterChange('addressSearch', e.target.value)}
                  />
                  {filters.addressSearch && (
                    <button
                      onClick={() => handleFilterChange('addressSearch', '')}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Prohledává město v ČR, českou adresu i domácí adresu
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
      {/* END OF REMOVED SECTION */}

      {/* Clients Display */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64 bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-indigo-600 border-t-transparent"></div>
            <p className="mt-4 text-gray-600 font-medium">Načítání klientů...</p>
          </div>
        </div>
      ) : clients.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl shadow-sm border border-gray-200">
          <svg
            className="mx-auto h-16 w-16 text-gray-300"
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
          <h3 className="mt-4 text-lg font-medium text-gray-900">Žádní klienti</h3>
          <p className="mt-2 text-sm text-gray-500">Nenalezeni žádní klienti odpovídající zadaným kritériím.</p>
          {getActiveFiltersCount() > 0 && (
            <button
              onClick={clearAllFilters}
              className="mt-4 btn btn-secondary"
            >
              Vymazat filtry
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Grid View */}
          {viewMode === 'grid' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {clients.map((client) => (
                <Link
                  key={client.id}
                  to={`/clients/${client.id}`}
                  className="bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-lg hover:border-indigo-300 transition-all duration-200 overflow-hidden group"
                >
                  <div className="p-6">
                    {/* Header with Avatar */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center font-bold text-lg">
                          {client.last_name?.[0]}{client.first_name?.[0]}
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">
                            {client.last_name} {client.first_name}
                          </h3>
                          {client.nickname && (
                            <p className="text-sm text-gray-500">"{client.nickname}"</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Info */}
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center text-gray-600">
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        {client.gender || 'N/A'} • {client.age ? `${client.age} let` : 'N/A'}
                      </div>

                      <div className="flex items-center text-gray-600">
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span className="font-semibold text-indigo-600">{client.service_count || 0}</span>
                        <span className="ml-1">výkonů</span>
                      </div>

                      {client.insurance_company && (
                        <div className="flex items-center text-gray-600">
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                          </svg>
                          {client.insurance_company}
                        </div>
                      )}
                    </div>

                    {/* Footer */}
                    <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${client.activity_status === 'active'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                          }`}
                      >
                        {client.activity_status === 'active' ? 'Aktivní' : 'Neaktivní'}
                      </span>
                      <svg
                        className="w-5 h-5 text-gray-400 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {/* Table View */}
          {viewMode === 'table' && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr
                      onContextMenu={(e) => handleContextMenu(e, 'header', {})}
                      className="cursor-context-menu"
                    >
                      {/* Select All Checkbox */}
                      {isAdmin && (
                        <th scope="col" className="px-4 py-3 w-10">
                          <input
                            type="checkbox"
                            checked={selectedClients.length === clients.length && clients.length > 0}
                            onChange={handleSelectAll}
                            className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 cursor-pointer"
                          />
                        </th>
                      )}
                      {visibleColumns().map((col) => (
                        <th
                          key={col.key}
                          scope="col"
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider group hover:bg-gray-100 transition-colors"
                        >
                          <div className="flex items-center gap-1">
                            {col.label}
                          </div>
                        </th>
                      ))}
                      <th className="relative px-6 py-3">
                        <span className="sr-only">Akce</span>
                        <button
                          onClick={() => setIsConfigPanelOpen(true)}
                          className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-200 transition-colors"
                          title="Nastavení sloupců"
                        >
                          <AdjustmentsHorizontalIcon className="w-4 h-4" />
                        </button>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {clients.map((client) => (
                      <tr
                        key={client.id}
                        className={`hover:bg-gray-50 transition-colors cursor-context-menu ${selectedClients.includes(client.id) ? 'bg-indigo-50' : ''}`}
                        onContextMenu={(e) => handleContextMenu(e, 'row', client)}
                      >
                        {/* Row Checkbox */}
                        {isAdmin && (
                          <td className="px-4 py-4 w-10">
                            <input
                              type="checkbox"
                              checked={selectedClients.includes(client.id)}
                              onChange={() => handleSelectClient(client.id)}
                              onClick={(e) => e.stopPropagation()}
                              className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 cursor-pointer"
                            />
                          </td>
                        )}
                        {visibleColumns().map((col) => {
                          switch (col.key) {
                            case 'name':
                              return (
                                <td key={col.key} className="px-6 py-4 whitespace-nowrap">
                                  <div className="flex items-center">
                                    <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center font-semibold text-sm">
                                      {client.last_name?.[0]}{client.first_name?.[0]}
                                    </div>
                                    <div className="ml-4">
                                      <div className="text-sm font-medium text-gray-900">
                                        {client.last_name} {client.first_name}
                                      </div>
                                      {client.nickname && (
                                        <div className="text-sm text-gray-500">"{client.nickname}"</div>
                                      )}
                                    </div>
                                  </div>
                                </td>
                              );
                            case 'ageGender':
                              return (
                                <td key={col.key} className="px-6 py-4 whitespace-nowrap">
                                  <div className="text-sm text-gray-900">
                                    {client.age ? `${client.age} let` : '—'}
                                  </div>
                                  <div className="text-sm text-gray-500">{client.gender || '—'}</div>
                                </td>
                              );
                            case 'city':
                              return (
                                <td key={col.key} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                  {client.czech_city || '—'}
                                </td>
                              );
                            case 'address':
                              return (
                                <td key={col.key} className="px-6 py-4 text-sm text-gray-600">
                                  <div className="max-w-xs truncate">
                                    {client.czech_address || '—'}
                                  </div>
                                </td>
                              );
                            case 'insurance':
                              return (
                                <td key={col.key} className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                  {client.insurance_company || '—'}
                                </td>
                              );
                            case 'services':
                              return (
                                <td key={col.key} className="px-6 py-4 whitespace-nowrap">
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                    {client.service_count || 0} výkonů
                                  </span>
                                </td>
                              );
                            case 'status':
                              return (
                                <td key={col.key} className="px-6 py-4 whitespace-nowrap">
                                  <span
                                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${client.activity_status === 'active'
                                      ? 'bg-green-100 text-green-800'
                                      : 'bg-gray-100 text-gray-800'
                                      }`}
                                  >
                                    {client.activity_status === 'active' ? 'Aktivní' : 'Neaktivní'}
                                  </span>
                                </td>
                              );
                            case 'phone':
                              return (
                                <td key={col.key} className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                  {client.phone ? (
                                    <div className="flex items-center gap-1">
                                      <PhoneIcon className="w-3 h-3 text-gray-400" />
                                      {client.phone}
                                    </div>
                                  ) : '—'}
                                </td>
                              );
                            case 'ukrainianRegion':
                              return (
                                <td key={col.key} className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                  {client.ukrainian_region || '—'}
                                </td>
                              );
                            default:
                              return <td key={col.key}></td>;
                          }
                        })}

                        {/* Actions Column - Always Last */}
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <Link
                            to={`/clients/${client.id}`}
                            className="text-blue-600 hover:text-blue-900 inline-flex items-center gap-1"
                          >
                            Zobrazit
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <p className="text-sm text-gray-700">
            Zobrazeno <span className="font-semibold">{(pagination.page - 1) * pagination.limit + 1}</span> -{' '}
            <span className="font-semibold">{Math.min(pagination.page * pagination.limit, pagination.total)}</span> z{' '}
            <span className="font-semibold">{pagination.total}</span> klientů
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPagination({ ...pagination, page: 1 })}
              disabled={pagination.page === 1}
              className="px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              ««
            </button>
            <button
              onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
              disabled={pagination.page === 1}
              className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              ← Předchozí
            </button>
            <span className="px-4 py-2 text-sm font-medium text-gray-900">
              {pagination.page} / {pagination.pages}
            </span>
            <button
              onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
              disabled={pagination.page === pagination.pages}
              className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Další →
            </button>
            <button
              onClick={() => setPagination({ ...pagination, page: pagination.pages })}
              disabled={pagination.page === pagination.pages}
              className="px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              »»
            </button>
          </div>
        </div>
      )}

      {/* Add Client Modal */}
      <AddClientModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onClientAdded={handleClientAdded}
      />

      <ResultLimitModal
        isOpen={showLimitModal}
        onClose={() => {
          setShowLimitModal(false);
          setPendingQuery(null);
        }}
        onConfirm={handleLimitConfirm}
        estimatedCount={101}
      />

      {/* Context Menu */}
      <ContextMenu
        isOpen={isMenuOpen}
        position={menuPosition}
        onClose={() => setIsMenuOpen(false)}
      >
        {menuContext?.type === 'row' && (
          <>
            <ContextMenuHeader>Akce s klientem</ContextMenuHeader>
            <ContextMenuItem
              icon={UserCircleIcon}
              onClick={() => {
                // Navigate to client profile
                window.location.href = `/clients/${menuContext.data.id}`;
              }}
            >
              Zobrazit profil
            </ContextMenuItem>
            <ContextMenuItem
              icon={MapPinIcon}
              onClick={() => {
                setAddressCorrectionClient(menuContext.data);
                setIsAddressCorrectionOpen(true);
                setIsMenuOpen(false);
              }}
            >
              Opravit adresu
            </ContextMenuItem>

            <ContextMenuItem
              icon={ClipboardDocumentIcon}
              submenu={
                <>
                  <ContextMenuItem onClick={() => copyToClipboard(`${menuContext.data.last_name} ${menuContext.data.first_name}`)}>
                    Jméno
                  </ContextMenuItem>
                  <ContextMenuItem onClick={() => copyToClipboard(menuContext.data.phone || '')} disabled={!menuContext.data.phone}>
                    Telefon
                  </ContextMenuItem>
                  <ContextMenuItem onClick={() => copyToClipboard(menuContext.data.czech_address || '')} disabled={!menuContext.data.czech_address}>
                    Adresa
                  </ContextMenuItem>
                  <ContextMenuItem onClick={() => copyToClipboard(Object.values(menuContext.data).join('\t'))}>
                    Pro Excel (tabulátor)
                  </ContextMenuItem>
                </>
              }
            >
              Kopírovat
            </ContextMenuItem>

            <ContextMenuDivider />

            <ContextMenuHeader>Filtrovat</ContextMenuHeader>
            <ContextMenuItem
              icon={FunnelIcon}
              onClick={() => handleQuickFilter('addressSearch', menuContext.data.czech_city)}
              disabled={!menuContext.data.czech_city}
            >
              Pouze město {menuContext.data.czech_city || '(neznámé)'}
            </ContextMenuItem>
            <ContextMenuItem
              icon={FunnelIcon}
              onClick={() => handleQuickFilter('insurance', menuContext.data.insurance_company)}
              disabled={!menuContext.data.insurance_company}
            >
              Pouze pojišťovna {menuContext.data.insurance_company || '(neznámá)'}
            </ContextMenuItem>
            <ContextMenuItem
              icon={FunnelIcon}
              onClick={() => handleQuickFilter('activityStatus', menuContext.data.activity_status)}
            >
              Pouze status {menuContext.data.activity_status === 'active' ? 'Aktivní' : 'Neaktivní'}
            </ContextMenuItem>
          </>
        )}

        {menuContext?.type === 'header' && (
          <>
            <ContextMenuHeader>Nastavení tabulky</ContextMenuHeader>
            <ContextMenuItem
              icon={AdjustmentsHorizontalIcon}
              onClick={() => {
                setIsConfigPanelOpen(true);
                setIsMenuOpen(false);
              }}
            >
              Upravit sloupce...
            </ContextMenuItem>
            <ContextMenuItem
              icon={ArrowPathIcon}
              onClick={() => {
                resetToDefault();
                setIsMenuOpen(false);
                toast.success('Sloupce obnoveny');
              }}
            >
              Obnovit výchozí
            </ContextMenuItem>
          </>
        )}
      </ContextMenu>

      {/* Column Config Panel */}
      <ColumnConfigPanel
        isOpen={isConfigPanelOpen}
        onClose={() => setIsConfigPanelOpen(false)}
        columns={getAllColumns()}
        onToggleColumn={toggleColumn}
        onReorderColumns={reorderColumns}
        onReset={resetToDefault}
      />

      {/* Address Correction Modal */}
      <AddressCorrectionModal
        isOpen={isAddressCorrectionOpen}
        onClose={() => {
          setIsAddressCorrectionOpen(false);
          setAddressCorrectionClient(null);
        }}
        client={addressCorrectionClient}
        onAddressUpdated={(updatedClient) => {
          setClients(prev => prev.map(c =>
            c.id === updatedClient.id ? { ...c, ...updatedClient } : c
          ));
        }}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleBulkDelete}
        count={selectedClients.length}
        isDeleting={isDeleting}
      />
    </div>
  );
}

export default Clients;
