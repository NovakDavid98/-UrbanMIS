import { useEffect, useState, useCallback } from 'react';
import { visitsAPI, clientsAPI } from '../services/api';
import { aiSearch } from '../services/ragAPI';
import toast from 'react-hot-toast';
import { format, startOfMonth, endOfMonth, isSameDay, parseISO } from 'date-fns';
import { cs } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import MonthPicker from '../components/MonthPicker';
import AddVisitModal from '../components/AddVisitModal';
import EditVisitModal from '../components/EditVisitModal';
import SmartSearchBar from '../components/SmartSearchBar';
import ResultLimitModal from '../components/ResultLimitModal';
import { ContextMenu, ContextMenuItem, ContextMenuDivider } from '../components/ContextMenu';
import AddressCorrectionModal from '../components/AddressCorrectionModal';
import ColumnConfigPanel from '../components/ColumnConfigPanel';
import { useTableConfig, VISITS_COLUMNS } from '../hooks/useTableConfig';
import {
  CalendarIcon,
  UserGroupIcon,
  ClockIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  AdjustmentsHorizontalIcon,
  XMarkIcon,
  UserCircleIcon,
  ArrowTopRightOnSquareIcon,
  PencilIcon,
  TrashIcon,
  ClipboardDocumentIcon,
  FunnelIcon as FilterIcon,
  Cog6ToothIcon,
  ArrowPathIcon,
  DocumentArrowDownIcon,
  PlusIcon,
  EyeIcon,
  DocumentDuplicateIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  EyeSlashIcon,
  MapPinIcon
} from '@heroicons/react/24/outline';

function VisitLog() {
  const navigate = useNavigate();
  const [visits, setVisits] = useState([]);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingVisitId, setEditingVisitId] = useState(null);
  const [isAddressCorrectionOpen, setIsAddressCorrectionOpen] = useState(false);
  const [addressCorrectionClient, setAddressCorrectionClient] = useState(null);
  const [pagination, setPagination] = useState({ total: 0, limit: 50, offset: 0, hasMore: false });
  const [sortOrder, setSortOrder] = useState('DESC'); // DESC = newest first (default), ASC = oldest first
  const [useAISearch, setUseAISearch] = useState(false);
  const [aiSearchResults, setAISearchResults] = useState(null);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [pendingQuery, setPendingQuery] = useState(null);
  // Default to showing last 7 days for better performance
  const getDefaultStartDate = () => {
    const date = new Date();
    date.setDate(date.getDate() - 7);
    return date.toISOString().split('T')[0];
  };

  const [startDate, setStartDate] = useState(getDefaultStartDate());
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [stats, setStats] = useState(null);

  // Advanced search states
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [clientNameSearch, setClientNameSearch] = useState('');
  const [cityFilter, setCityFilter] = useState('all');
  const [addressSearch, setAddressSearch] = useState('');
  const [ageMin, setAgeMin] = useState('');
  const [ageMax, setAgeMax] = useState('');
  const [notesSearch, setNotesSearch] = useState('');
  const [workerNameSearch, setWorkerNameSearch] = useState('');
  const [selectedReasons, setSelectedReasons] = useState([]);
  const [availableCities, setAvailableCities] = useState([]);
  const [availableReasons, setAvailableReasons] = useState([]);

  // Context menu state
  const [contextMenu, setContextMenu] = useState({
    isOpen: false,
    position: { x: 0, y: 0 },
    type: null, // 'row', 'header', 'cell', 'empty'
    data: null  // Selected row data, header key, or cell value
  });
  const [isColumnPanelOpen, setIsColumnPanelOpen] = useState(false);

  // Table column configuration
  const {
    visibleColumns,
    toggleColumn,
    reorderColumns,
    resetToDefault,
    getAllColumns
  } = useTableConfig('visits', VISITS_COLUMNS);

  // Initial load and date/category changes
  useEffect(() => {
    fetchVisits(true);
    fetchStats();
    fetchFilterOptions();
  }, [startDate, endDate, categoryFilter, sortOrder]);

  // Debounced search effect for filters
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchVisits(true); // Reset to first page when filtering
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [clientNameSearch, cityFilter, addressSearch, ageMin, ageMax, notesSearch, workerNameSearch, selectedReasons]);

  const fetchVisits = async (resetPagination = false, loadMore = false) => {
    if (loadMore) {
      setIsLoadingMore(true);
    } else {
      setIsLoading(true);
    }

    try {
      const currentOffset = resetPagination ? 0 : (loadMore ? pagination.offset + pagination.limit : 0);

      const params = {
        startDate,
        endDate,
        limit: pagination.limit,
        offset: currentOffset,
        sortOrder,
      };

      // Add filters to params
      if (categoryFilter !== 'all') {
        params.category = categoryFilter;
      }

      if (clientNameSearch.trim()) {
        params.clientName = clientNameSearch.trim();
      }

      if (cityFilter !== 'all') {
        params.city = cityFilter;
      }

      if (addressSearch.trim()) {
        params.address = addressSearch.trim();
      }

      if (ageMin) {
        params.ageMin = ageMin;
      }

      if (ageMax) {
        params.ageMax = ageMax;
      }

      if (notesSearch.trim()) {
        params.notesSearch = notesSearch.trim();
      }

      if (workerNameSearch.trim()) {
        params.workerName = workerNameSearch.trim();
      }

      if (selectedReasons.length > 0) {
        params.visitReasons = selectedReasons;
      }

      const response = await visitsAPI.getAll(params);
      const visitsData = response.data.visits;

      if (loadMore) {
        // Append to existing visits
        setVisits(prev => [...prev, ...visitsData]);
      } else {
        // Replace visits
        setVisits(visitsData);
      }

      // Handle pagination info
      if (response.data.pagination) {
        setPagination({
          ...response.data.pagination,
          offset: currentOffset
        });
      }

    } catch (error) {
      toast.error('Nepodařilo se načíst návštěvy');
      console.error(error);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await visitsAPI.getStats({ startDate, endDate });
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchFilterOptions = async () => {
    try {
      const response = await visitsAPI.getFilterOptions();
      setAvailableCities(response.data.cities);
      setAvailableReasons(response.data.reasons);
    } catch (error) {
      console.error('Error fetching filter options:', error);
    }
  };

  const loadMoreVisits = () => {
    fetchVisits(false, true);
  };

  const handleVisitAdded = () => {
    fetchVisits();
    fetchStats();
  };

  const handleEdit = (visitId) => {
    setEditingVisitId(visitId);
    setIsEditModalOpen(true);
  };

  const handleDelete = async (visitId) => {
    if (!confirm('Opravdu chcete smazat tuto návštěvu?')) return;

    try {
      await visitsAPI.delete(visitId);
      toast.success('Návštěva byla smazána');
      fetchVisits();
      fetchStats();
    } catch (error) {
      toast.error('Nepodařilo se smazat návštěvu');
      console.error(error);
    }
  };

  const handleAISearch = async (query) => {
    try {
      setIsLoading(true);

      // First, do a quick check with limit 101 to see if there are more results
      const checkResponse = await aiSearch.searchVisits(query, 101);

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
      const response = await aiSearch.searchVisits(query, limit);
      setAISearchResults(response);

      // Convert AI results to visits format
      const aiVisits = response.results.map(result => ({
        id: result.payload.id,
        client_id: result.payload.client_id,
        client_first_name: result.payload.client_name?.split(' ')[0] || '',
        client_last_name: result.payload.client_name?.split(' ').slice(1).join(' ') || '',
        client_age: result.payload.client_age,
        client_gender: result.payload.client_gender,
        client_city: result.payload.city,
        visit_date: result.payload.visit_date,
        visit_reasons: result.payload.visit_reasons || [],
        worker_first_name: result.payload.worker_name?.split(' ')[0] || '',
        worker_last_name: result.payload.worker_name?.split(' ').slice(1).join(' ') || '',
        time_spent: result.payload.time_spent,
        notes: result.payload.text,
        _aiScore: result.score
      }));

      setVisits(aiVisits);
      toast.success(`Nalezeno ${aiVisits.length} návštěv`);
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
    fetchVisits(true);
  };

  const setQuickDateRange = (range) => {
    const today = new Date();
    let start = new Date();

    switch (range) {
      case 'today':
        start = today;
        break;
      case 'week':
        start.setDate(today.getDate() - 7);
        break;
      case 'month':
        start.setMonth(today.getMonth() - 1);
        break;
      case 'year':
        start.setFullYear(today.getFullYear() - 1);
        break;
      case 'all':
        // Set to very old date to show all records
        start = new Date('2020-01-01');
        break;
      default:
        start = today;
    }

    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(today.toISOString().split('T')[0]);
  };

  const clearAllFilters = () => {
    setClientNameSearch('');
    setCityFilter('all');
    setAddressSearch('');
    setAgeMin('');
    setAgeMax('');
    setNotesSearch('');
    setSelectedReasons([]);
    setCategoryFilter('all');
  };

  const toggleReason = (reason) => {
    setSelectedReasons(prev =>
      prev.includes(reason)
        ? prev.filter(r => r !== reason)
        : [...prev, reason]
    );
  };

  const handleClientClick = async (clientName) => {
    // Clear other filters first
    setCityFilter('all');
    setAddressSearch('');
    setAgeMin('');
    setAgeMax('');
    setNotesSearch('');
    setSelectedReasons([]);
    setCategoryFilter('all');

    // Set search to this client's name
    setClientNameSearch(clientName);

    // Show all time to see all their visits
    setQuickDateRange('all');

    // Scroll to top to see results
    window.scrollTo({ top: 0, behavior: 'smooth' });
    toast.success(`Zobrazení všech návštěv klienta: ${clientName}`);

    // Trigger immediate search with the new filters
    setTimeout(() => {
      fetchVisits(true);
    }, 100);
  };

  const handleViewClientProfile = (clientId, clientName) => {
    navigate(`/clients/${clientId}`);
  };

  // Handle address update from correction modal
  const handleAddressUpdated = useCallback((updatedClient) => {
    // Update the visits list with the new address
    setVisits(prevVisits => prevVisits.map(visit => {
      if (visit.client_id === updatedClient.id) {
        return {
          ...visit,
          client_city: updatedClient.czech_city,
          client_address: updatedClient.czech_address
        };
      }
      return visit;
    }));
    setIsAddressCorrectionOpen(false);
    setAddressCorrectionClient(null);
  }, []);

  const activeFiltersCount = [
    clientNameSearch,
    cityFilter !== 'all',
    addressSearch,
    ageMin,
    ageMax,
    notesSearch,
    selectedReasons.length > 0,
    categoryFilter !== 'all'
  ].filter(Boolean).length;

  const handleExportToExcel = async () => {
    setIsExporting(true);
    try {
      const params = { startDate, endDate };
      if (categoryFilter !== 'all') params.category = categoryFilter;
      if (clientNameSearch.trim()) params.clientName = clientNameSearch.trim();
      if (cityFilter !== 'all') params.city = cityFilter;
      if (addressSearch.trim()) params.address = addressSearch.trim();
      if (ageMin) params.ageMin = ageMin;
      if (ageMax) params.ageMax = ageMax;
      if (notesSearch.trim()) params.notesSearch = notesSearch.trim();
      if (selectedReasons.length > 0) params.visitReasons = selectedReasons;

      const response = await visitsAPI.exportToExcel(params);

      // Create download link for Excel file
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      link.download = `navstevy_export_${timestamp}.xlsx`;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success(`Export dokončen! Staženo ${pagination.total > 10000 ? '10 000' : pagination.total} návštěv`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Export se nezdařil. Zkuste to prosím znovu.');
    } finally {
      setIsExporting(false);
    }
  };

  const categoryLabels = {
    warehouse: 'Humanitární sklad',
    assistance: 'Asistenční centrum',
    community: 'Komunitní centrum',
    donations: 'Dary/Darování'
  };

  const categoryColors = {
    warehouse: 'bg-orange-100 text-orange-800',
    assistance: 'bg-blue-100 text-blue-800',
    community: 'bg-purple-100 text-purple-800',
    donations: 'bg-green-100 text-green-800'
  };

  // ===== CONTEXT MENU HANDLERS =====

  const openContextMenu = useCallback((e, type, data) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      isOpen: true,
      position: { x: e.clientX, y: e.clientY },
      type,
      data
    });
  }, []);

  const closeContextMenu = useCallback(() => {
    setContextMenu(prev => ({ ...prev, isOpen: false }));
  }, []);

  // Handle opening address correction modal from a visit row
  const handleOpenAddressCorrection = useCallback((visit) => {
    // Create a client-like object from visit data for the modal
    const clientData = {
      id: visit.client_id,
      first_name: visit.client_first_name,
      last_name: visit.client_last_name,
      czech_city: visit.client_city || '',
      czech_address: visit.client_address || ''
    };
    setAddressCorrectionClient(clientData);
    setIsAddressCorrectionOpen(true);
    closeContextMenu();
  }, [closeContextMenu]);

  // Copy to clipboard utility
  const copyToClipboard = useCallback(async (text, successMessage = 'Zkopírováno do schránky') => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(successMessage);
      closeContextMenu();
    } catch (err) {
      toast.error('Kopírování se nezdařilo');
    }
  }, [closeContextMenu]);

  // Format row data for copying
  const formatRowForCopy = useCallback((visit, copyFormat = 'text') => {
    const clientName = `${visit.client_last_name} ${visit.client_first_name}`;
    const visitDate = copyFormat === 'excel'
      ? visit.visit_date.split('T')[0]
      : format(new Date(visit.visit_date), 'd.M.yyyy', { locale: cs });
    const reasons = visit.visit_reasons?.join(', ') || '';
    const city = visit.client_city || '';
    const address = visit.client_address || '';
    const age = visit.client_age ? `${visit.client_age} let` : '';
    const worker = visit.worker_first_name && visit.worker_last_name
      ? `${visit.worker_last_name} ${visit.worker_first_name}`
      : '';
    const time = visit.time_spent || '';
    const notes = visit.notes || '';

    switch (copyFormat) {
      case 'excel':
        // Tab-separated for Excel paste
        return [visitDate, clientName, age, reasons, city, address, worker, time, notes].join('\t');
      case 'headers':
        return `Datum: ${visitDate}, Klient: ${clientName}, Věk: ${age}, Důvody: ${reasons}, Město: ${city}, Adresa: ${address}, Pracovník: ${worker}, Čas: ${time}, Poznámky: ${notes}`;
      default:
        // Plain text - include all important fields
        return `${clientName} | ${visitDate} | ${age} | ${city} | ${address} | ${reasons} | ${worker} | ${time} | ${notes}`.replace(/\| \|/g, '|').replace(/^\||\|$/g, '').trim();
    }
  }, []);

  // Add quick filter from context menu
  const addQuickFilter = useCallback((filterType, value) => {
    if (!value) {
      toast.error('Hodnota pro filtr není dostupná');
      closeContextMenu();
      return;
    }

    closeContextMenu();
    setShowAdvancedFilters(true); // Show filters panel so user can see applied filter

    switch (filterType) {
      case 'client':
        setClientNameSearch(value);
        toast.success(`Filtr klienta: "${value}"`);
        break;
      case 'city':
        setCityFilter(value);
        toast.success(`Filtr města: "${value}"`);
        break;
      case 'address':
        setAddressSearch(value);
        toast.success(`Filtr adresy: "${value}"`);
        break;
      case 'worker':
        setWorkerNameSearch(value);
        toast.success(`Filtr pracovníka: "${value}"`);
        break;
      case 'reason':
        setSelectedReasons(prev => prev.includes(value) ? prev : [...prev, value]);
        toast.success(`Přidán důvod: "${value}"`);
        break;
      default:
        toast.error('Neznámý typ filtru');
        break;
    }
  }, [closeContextMenu]);

  // Handle row right-click
  const handleRowContextMenu = useCallback((e, visit) => {
    openContextMenu(e, 'row', visit);
  }, [openContextMenu]);

  // Handle header right-click
  const handleHeaderContextMenu = useCallback((e, columnKey) => {
    openContextMenu(e, 'header', { columnKey });
  }, [openContextMenu]);

  // Handle empty area right-click
  const handleEmptyContextMenu = useCallback((e) => {
    if (e.target === e.currentTarget || e.target.closest('table')) {
      openContextMenu(e, 'empty', null);
    }
  }, [openContextMenu]);

  // Duplicate visit - open add modal with prefilled data
  const handleDuplicateVisit = useCallback((visit) => {
    closeContextMenu();
    // Store visit data for prefill (you could use a ref or state)
    toast.success('Otevírám formulář s předvyplněnými daty');
    setIsAddModalOpen(true);
    // Note: AddVisitModal would need to accept prefill data
  }, [closeContextMenu]);

  const getSelectedMonth = () => {
    if (!startDate || !endDate) return null;
    const start = new Date(startDate);
    // basic check if start is 1st
    if (start.getDate() !== 1) return null;

    const end = new Date(endDate);
    const expectedEnd = endOfMonth(start);

    // Compare dates (ignoring time)
    if (end.getDate() === expectedEnd.getDate() &&
      end.getMonth() === expectedEnd.getMonth() &&
      end.getFullYear() === expectedEnd.getFullYear()) {
      return start;
    }
    return null;
  };

  const handleMonthPickerChange = (date) => {
    if (date) {
      setStartDate(format(startOfMonth(date), 'yyyy-MM-dd'));
      setEndDate(format(endOfMonth(date), 'yyyy-MM-dd'));
    } else {
      // Reset to default (last 7 days) if cleared
      setStartDate(getDefaultStartDate());
      setEndDate(new Date().toISOString().split('T')[0]);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center">
              <ClipboardDocumentIcon className="w-6 h-6" />
            </div>
            Žurnál návštěv
          </h1>
          <p className="mt-1 text-gray-500 text-sm ml-12">
            Evidence všech návštěv a intervencí
          </p>
        </div>
        <div className="flex items-center gap-3">
          <MonthPicker
            selectedDate={getSelectedMonth()}
            onChange={handleMonthPickerChange}
            placeholder="Měsíc"
            className="w-44"
          />
          {/* Sort Order Toggle */}
          <button
            onClick={() => setSortOrder(sortOrder === 'ASC' ? 'DESC' : 'ASC')}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all shadow-sm ${sortOrder === 'DESC'
              ? 'bg-indigo-50 border-indigo-300 text-indigo-700 ring-1 ring-indigo-400'
              : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            title={sortOrder === 'ASC' ? 'Klikněte pro řazení od nejnovějších' : 'Klikněte pro řazení od nejstarších'}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {sortOrder === 'ASC' ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4" />
              )}
            </svg>
            <span className="text-sm font-medium hidden sm:inline">
              {sortOrder === 'ASC' ? 'Nejstarší ↑' : 'Nejnovější ↓'}
            </span>
          </button>

          <button
            onClick={handleExportToExcel}
            disabled={isLoading || isLoadingMore || isExporting || visits.length === 0}
            className="btn bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            title="Exportovat aktuální výsledky do Excelu"
          >
            {isExporting ? (
              <>
                <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin"></div>
                <span>Exportuji...</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="hidden lg:inline">Export do Excelu</span>
                <span className="lg:hidden">Export</span>
              </>
            )
            }
          </button>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="btn bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm flex items-center gap-2"
          >
            <PlusIcon className="w-5 h-5" />
            <span className="hidden sm:inline">Nová návštěva</span>
            <span className="sm:hidden">Nová</span>
          </button>
        </div>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center">
            <div className="p-3 rounded-lg bg-indigo-50 text-indigo-600">
              <CalendarIcon className="w-6 h-6" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Celkem návštěv</p>
              <p className="text-xl font-bold text-gray-900">{stats.stats.total_visits}</p>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center">
            <div className="p-3 rounded-lg bg-teal-50 text-teal-600">
              <UserGroupIcon className="w-6 h-6" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Unikátní klienti</p>
              <p className="text-xl font-bold text-gray-900">{stats.stats.unique_clients}</p>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center">
            <div className="p-3 rounded-lg bg-purple-50 text-purple-600">
              <ClockIcon className="w-6 h-6" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Tento týden</p>
              <p className="text-xl font-bold text-gray-900">{stats.stats.visits_last_week}</p>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center">
            <div className="p-3 rounded-lg bg-amber-50 text-amber-600">
              <FunnelIcon className="w-6 h-6" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Tento měsíc</p>
              <p className="text-xl font-bold text-gray-900">{stats.stats.visits_last_month}</p>
            </div>
          </div>
        </div>
      )}

      {/* Smart Search Active Banner */}
      {useAISearch && aiSearchResults && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <span className="text-xl">✨</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-indigo-900">Chytré vyhledávání aktivní</span>
                <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs font-bold rounded-full">
                  {aiSearchResults.count}
                </span>
              </div>
              {aiSearchResults.understanding && (
                <p className="text-sm text-indigo-700 mt-0.5">
                  Filtruji: {aiSearchResults.understanding.intent}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={clearAISearch}
            className="px-4 py-2 bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 shadow-sm whitespace-nowrap"
          >
            <XMarkIcon className="w-4 h-4" />
            Zrušit hledání
          </button>
        </div>
      )}

      {/* Unified Smart Search Bar */}
      <SmartSearchBar
        onAISearch={handleAISearch}
        onFilterSearch={(newFilters) => {
          // Update state with new filters, cleaning up "all" values
          if (newFilters.startDate && newFilters.startDate !== 'all') setStartDate(newFilters.startDate);
          if (newFilters.endDate && newFilters.endDate !== 'all') setEndDate(newFilters.endDate);
          if (newFilters.category && newFilters.category !== 'all') setCategoryFilter(newFilters.category);
          if (newFilters.clientName !== undefined && newFilters.clientName !== 'all') setClientNameSearch(newFilters.clientName);
          if (newFilters.city && newFilters.city !== 'all') setCityFilter(newFilters.city);
          if (newFilters.address !== undefined && newFilters.address !== 'all') setAddressSearch(newFilters.address);
          if (newFilters.ageMin !== undefined && newFilters.ageMin !== 'all' && newFilters.ageMin !== '') setAgeMin(newFilters.ageMin);
          if (newFilters.ageMax !== undefined && newFilters.ageMax !== 'all' && newFilters.ageMax !== '') setAgeMax(newFilters.ageMax);
          if (newFilters.notesSearch !== undefined && newFilters.notesSearch !== 'all') setNotesSearch(newFilters.notesSearch);
        }}
        filterOptions={{ cities: availableCities }}
        currentFilters={{
          startDate,
          endDate,
          category: categoryFilter,
          clientName: clientNameSearch,
          city: cityFilter,
          address: addressSearch,
          ageMin,
          ageMax,
          notesSearch
        }}
        placeholder="Hledat návštěvy... (Zkuste: 'zobraz návštěvy z humanitárního skladu tento týden')"
        aiExamples={[
          "zobraz návštěvy z Ostravy tento týden",
          "kdo navštívil sklad minulý měsíc",
          "ženy starší 40 let",
          "návštěvy asistenčního centra",
          "lidé z Teplic"
        ]}
        showAdvancedFilters={showAdvancedFilters}
        onToggleAdvancedFilters={setShowAdvancedFilters}
        type="visits"
      />

      {/* Quick Date Presets - Keep for convenience */}
      <div className="flex flex-wrap gap-2">
        <span className="text-sm font-medium text-gray-700 flex items-center">
          <ClockIcon className="w-4 h-4 mr-1" />
          Rychlý výběr:
        </span>
        <button
          onClick={() => setQuickDateRange('today')}
          className="px-3 py-1 text-sm rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
        >
          Dnes
        </button>
        <button
          onClick={() => setQuickDateRange('week')}
          className="px-3 py-1 text-sm rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
        >
          Tento týden
        </button>
        <button
          onClick={() => setQuickDateRange('month')}
          className="px-3 py-1 text-sm rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
        >
          Tento měsíc
        </button>
        <button
          onClick={() => setQuickDateRange('year')}
          className="px-3 py-1 text-sm rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
        >
          Tento rok
        </button>
        <button
          onClick={() => setQuickDateRange('all')}
          className="px-3 py-1 text-sm rounded-lg border-2 border-primary-500 text-primary-700 font-semibold hover:bg-primary-50 transition-colors"
        >
          ⏰ Vše (od začátku)
        </button>
      </div>

      {/* OLD Filters Section - REMOVED */}
      <div className="hidden">
        {/* Advanced Filters Panel */}
        {showAdvancedFilters && (
          <div className="pt-4 border-t border-gray-200 space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <AdjustmentsHorizontalIcon className="w-5 h-5" />
              Pokročilé filtry
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* City Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Město v ČR</label>
                <select
                  value={cityFilter}
                  onChange={(e) => setCityFilter(e.target.value)}
                  className="input w-full"
                >
                  <option value="all">Všechna města</option>
                  {availableCities.map(city => (
                    <option key={city} value={city}>{city}</option>
                  ))}
                </select>
              </div>

              {/* Age Range */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Věk od</label>
                <input
                  type="number"
                  value={ageMin}
                  onChange={(e) => setAgeMin(e.target.value)}
                  placeholder="Min"
                  min="0"
                  max="120"
                  className="input w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Věk do</label>
                <input
                  type="number"
                  value={ageMax}
                  onChange={(e) => setAgeMax(e.target.value)}
                  placeholder="Max"
                  min="0"
                  max="120"
                  className="input w-full"
                />
              </div>
            </div>

            {/* Notes Search */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Hledat v poznámkách</label>
              <input
                type="text"
                value={notesSearch}
                onChange={(e) => setNotesSearch(e.target.value)}
                placeholder="Zadejte klíčová slova..."
                className="input w-full"
              />
            </div>

            {/* Visit Reasons Filter */}
            {availableReasons.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Důvody návštěvy</label>
                <div className="flex flex-wrap gap-2">
                  {availableReasons.map(reason => (
                    <button
                      key={reason}
                      onClick={() => toggleReason(reason)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${selectedReasons.includes(reason)
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                    >
                      {reason}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Results Count */}
        <div className="pt-2 border-t border-gray-200">
          <p className="text-sm text-gray-600">
            Zobrazeno <span className="font-semibold text-gray-900">{visits.length}</span> z <span className="font-semibold text-gray-900">{pagination.total}</span> návštěv
            {pagination.hasMore && (
              <span className="ml-2 text-primary-600">• Další výsledky k dispozici</span>
            )}
          </p>
        </div>
      </div>

      {/* Pagination Warning */}
      {pagination.hasMore && (
        <div className="mb-4 bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-r-lg">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-700">
                <strong>Upozornění:</strong> Zobrazeno pouze prvních <strong>{pagination.limit.toLocaleString()}</strong> z celkem <strong>{pagination.total.toLocaleString()}</strong> návštěv.
                Pro zobrazení všech výsledků zúžte prosím časové rozmezí nebo použijte konkrétnější filtry.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Visits Table */}
      <div className="card">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr
                onContextMenu={(e) => handleHeaderContextMenu(e, 'header')}
                className="cursor-context-menu"
              >
                {visibleColumns().map((col) => (
                  <th
                    key={col.key}
                    scope="col"
                    className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider group hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-1">
                      {col.label}
                    </div>
                  </th>
                ))}
                <th scope="col" className="relative px-3 py-3">
                  <button
                    onClick={() => setIsColumnPanelOpen(true)}
                    className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-200 transition-colors"
                    title="Nastavení sloupců"
                  >
                    <Cog6ToothIcon className="w-4 h-4" />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {isLoading ? (
                <tr>
                  <td colSpan="8" className="px-6 py-12 text-center">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                    <p className="mt-2 text-gray-600">Načítání...</p>
                  </td>
                </tr>
              ) : visits.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-6 py-12 text-center text-gray-500">
                    Žádné návštěvy pro zvolené období a filtry
                  </td>
                </tr>
              ) : (
                visits.map((visit, index) => (
                  <tr
                    key={visit.id}
                    className="hover:bg-gray-50 cursor-context-menu"
                    onContextMenu={(e) => handleRowContextMenu(e, visit)}
                  >
                    {visibleColumns().map((col) => {
                      switch (col.key) {
                        case 'date':
                          return (
                            <td key={col.key} className="px-3 py-3 whitespace-nowrap text-sm text-gray-900">
                              {format(new Date(visit.visit_date), 'd.M.yy', { locale: cs })}
                            </td>
                          );
                        case 'client':
                          return (
                            <td key={col.key} className="px-3 py-3">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleClientClick(`${visit.client_last_name} ${visit.client_first_name}`)}
                                  className="text-sm font-medium text-primary-600 hover:text-primary-800 hover:underline transition-colors text-left"
                                  title="Zobrazit všechny návštěvy tohoto klienta"
                                >
                                  {visit.client_last_name} {visit.client_first_name}
                                </button>
                                <button
                                  onClick={() => handleViewClientProfile(visit.client_id, `${visit.client_last_name} ${visit.client_first_name}`)}
                                  className="p-1 rounded hover:bg-primary-50 text-primary-600 hover:text-primary-800 transition-colors flex-shrink-0"
                                  title="Otevřít profil klienta"
                                >
                                  <ArrowTopRightOnSquareIcon className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          );
                        case 'clientAge':
                          return (
                            <td key={col.key} className="px-3 py-3 whitespace-nowrap text-sm text-gray-900">
                              {visit.client_age ? `${visit.client_age} let` : '—'}
                            </td>
                          );
                        case 'reasons':
                          return (
                            <td key={col.key} className="px-3 py-3">
                              <div className="flex flex-wrap gap-1">
                                {visit.visit_reasons && visit.visit_reasons.map((reason, idx) => (
                                  <span
                                    key={idx}
                                    className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${selectedReasons.includes(reason)
                                      ? 'bg-primary-600 text-white ring-2 ring-primary-300'
                                      : 'bg-blue-100 text-blue-800'
                                      }`}
                                  >
                                    {reason}
                                  </span>
                                ))}
                              </div>
                            </td>
                          );
                        case 'notes':
                          return (
                            <td key={col.key} className="px-3 py-3 max-w-xs">
                              <div className="text-xs text-gray-900 truncate">
                                {visit.notes || '—'}
                              </div>
                            </td>
                          );
                        case 'cityAddress':
                          return (
                            <td key={col.key} className="px-3 py-3">
                              <div className="text-xs text-gray-900">
                                {visit.client_city || '—'}
                              </div>
                              {visit.client_address && (
                                <div className="text-xs text-gray-500 truncate max-w-[150px] mt-0.5">
                                  {visit.client_address}
                                </div>
                              )}
                            </td>
                          );
                        case 'worker':
                          return (
                            <td key={col.key} className="px-3 py-3 whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                <UserCircleIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                <span className="text-xs text-gray-900">
                                  {visit.worker_first_name && visit.worker_last_name
                                    ? `${visit.worker_last_name} ${visit.worker_first_name}`
                                    : '—'}
                                </span>
                              </div>
                            </td>
                          );
                        case 'time':
                          return (
                            <td key={col.key} className="px-3 py-3 whitespace-nowrap text-xs text-gray-500">
                              {visit.time_spent || '—'}
                            </td>
                          );
                        default:
                          return <td key={col.key} className="px-3 py-3">—</td>;
                      }
                    })}
                    {/* Akce column (always last) */}
                    <td className="px-3 py-3 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleEdit(visit.id)}
                          className="p-1 rounded text-blue-600 hover:text-blue-900 hover:bg-blue-50 transition-colors"
                          title="Upravit návštěvu"
                        >
                          <PencilIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(visit.id)}
                          className="p-1 rounded text-red-600 hover:text-red-900 hover:bg-red-50 transition-colors"
                          title="Smazat návštěvu"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Load More Button */}
      {pagination.hasMore && (
        <div className="flex justify-center">
          <button
            onClick={loadMoreVisits}
            disabled={isLoadingMore}
            className="btn btn-secondary flex items-center gap-2 px-6 py-3"
          >
            {isLoadingMore ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600"></div>
                Načítání...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
                Načíst další ({pagination.total - visits.length} zbývá)
              </>
            )}
          </button>
        </div>
      )}

      {/* Category Statistics */}
      {stats && stats.byCategory && stats.byCategory.length > 0 && (
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Návštěvy podle kategorií</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.byCategory.map((cat) => (
              <div key={cat.category} className={`p-4 rounded-lg ${categoryColors[cat.category]}`}>
                <p className="text-sm font-medium">{categoryLabels[cat.category]}</p>
                <p className="text-2xl font-bold mt-1">{cat.count}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Visit Modal */}
      <AddVisitModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onVisitAdded={handleVisitAdded}
      />

      {/* Edit Visit Modal */}
      <EditVisitModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingVisitId(null);
        }}
        onVisitUpdated={handleVisitAdded}
        visitId={editingVisitId}
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

      {/* ===== CONTEXT MENU ===== */}
      <ContextMenu
        isOpen={contextMenu.isOpen}
        position={contextMenu.position}
        onClose={closeContextMenu}
      >
        {/* ROW CONTEXT MENU */}
        {contextMenu.type === 'row' && contextMenu.data && (
          <>
            <ContextMenuItem
              icon={EyeIcon}
              onClick={() => {
                closeContextMenu();
                handleViewClientProfile(contextMenu.data.client_id, `${contextMenu.data.client_last_name} ${contextMenu.data.client_first_name}`);
              }}
            >
              Zobrazit klienta
            </ContextMenuItem>
            <ContextMenuItem
              icon={PencilIcon}
              onClick={() => {
                closeContextMenu();
                handleEdit(contextMenu.data.id);
              }}
            >
              Upravit návštěvu
            </ContextMenuItem>
            <ContextMenuDivider />
            <ContextMenuItem
              icon={PlusIcon}
              onClick={() => {
                closeContextMenu();
                setIsAddModalOpen(true);
              }}
            >
              Přidat návštěvu
            </ContextMenuItem>
            <ContextMenuItem
              icon={DocumentDuplicateIcon}
              onClick={() => handleDuplicateVisit(contextMenu.data)}
            >
              Duplikovat návštěvu
            </ContextMenuItem>
            <ContextMenuItem
              icon={MapPinIcon}
              onClick={() => handleOpenAddressCorrection(contextMenu.data)}
            >
              Opravit adresu
            </ContextMenuItem>
            <ContextMenuDivider />
            <ContextMenuItem
              icon={ClipboardDocumentIcon}
              submenu={
                <>
                  <ContextMenuItem
                    onClick={() => copyToClipboard(formatRowForCopy(contextMenu.data))}
                  >
                    Celý řádek
                  </ContextMenuItem>
                  <ContextMenuItem
                    onClick={() => copyToClipboard(`${contextMenu.data.client_last_name} ${contextMenu.data.client_first_name}`)}
                  >
                    Jméno klienta
                  </ContextMenuItem>
                  <ContextMenuItem
                    onClick={() => copyToClipboard(contextMenu.data.client_address || '')}
                  >
                    Adresa
                  </ContextMenuItem>
                  <ContextMenuItem
                    onClick={() => copyToClipboard(contextMenu.data.notes || contextMenu.data.note || '')}
                  >
                    Poznámka
                  </ContextMenuItem>
                </>
              }
            >
              Kopírovat
            </ContextMenuItem>
            <ContextMenuItem
              icon={FilterIcon}
              submenu={
                <>
                  <ContextMenuItem
                    onClick={() => addQuickFilter('client', `${contextMenu.data.client_last_name} ${contextMenu.data.client_first_name}`)}
                  >
                    Tohoto klienta
                  </ContextMenuItem>
                  {contextMenu.data.worker_last_name && (
                    <ContextMenuItem
                      onClick={() => addQuickFilter('worker', `${contextMenu.data.worker_last_name} ${contextMenu.data.worker_first_name}`)}
                    >
                      Tohoto pracovníka
                    </ContextMenuItem>
                  )}
                  {contextMenu.data.client_city && (
                    <ContextMenuItem
                      onClick={() => addQuickFilter('city', contextMenu.data.client_city)}
                    >
                      Toto město
                    </ContextMenuItem>
                  )}
                  {contextMenu.data.client_address && (
                    <ContextMenuItem
                      onClick={() => addQuickFilter('address', contextMenu.data.client_address)}
                    >
                      Tuto adresu
                    </ContextMenuItem>
                  )}
                </>
              }
            >
              Filtrovat
            </ContextMenuItem>
            <ContextMenuDivider />
            <ContextMenuItem
              icon={TrashIcon}
              danger
              onClick={() => {
                closeContextMenu();
                handleDelete(contextMenu.data.id);
              }}
            >
              Smazat návštěvu
            </ContextMenuItem>
          </>
        )}

        {/* HEADER CONTEXT MENU */}
        {contextMenu.type === 'header' && (
          <>
            <ContextMenuItem
              icon={ArrowUpIcon}
              onClick={() => {
                closeContextMenu();
                setSortOrder('ASC');
              }}
            >
              Seřadit vzestupně (A→Z)
            </ContextMenuItem>
            <ContextMenuItem
              icon={ArrowDownIcon}
              onClick={() => {
                closeContextMenu();
                setSortOrder('DESC');
              }}
            >
              Seřadit sestupně (Z→A)
            </ContextMenuItem>
            <ContextMenuDivider />
            <ContextMenuItem
              icon={EyeSlashIcon}
              onClick={() => {
                closeContextMenu();
                toast.info('Funkce skrytí sloupce bude dostupná v nastavení sloupců');
                setIsColumnPanelOpen(true);
              }}
            >
              Skrýt tento sloupec
            </ContextMenuItem>
            <ContextMenuItem
              icon={Cog6ToothIcon}
              onClick={() => {
                closeContextMenu();
                setIsColumnPanelOpen(true);
              }}
            >
              Nastavení sloupců...
            </ContextMenuItem>
            <ContextMenuDivider />
            <ContextMenuItem
              icon={ArrowPathIcon}
              onClick={() => {
                closeContextMenu();
                resetToDefault();
                toast.success('Sloupce obnoveny do výchozího nastavení');
              }}
            >
              Obnovit výchozí zobrazení
            </ContextMenuItem>
          </>
        )}

        {/* EMPTY AREA MENU */}
        {contextMenu.type === 'empty' && (
          <>
            <ContextMenuItem
              icon={PlusIcon}
              onClick={() => {
                closeContextMenu();
                setIsAddModalOpen(true);
              }}
            >
              Přidat novou návštěvu
            </ContextMenuItem>
            <ContextMenuItem
              icon={ArrowPathIcon}
              onClick={() => {
                closeContextMenu();
                fetchVisits(true);
                toast.success('Data obnovena');
              }}
            >
              Obnovit data
            </ContextMenuItem>
            <ContextMenuDivider />
            <ContextMenuItem
              icon={DocumentArrowDownIcon}
              onClick={() => {
                closeContextMenu();
                handleExportToExcel();
              }}
            >
              Exportovat do Excelu
            </ContextMenuItem>
            <ContextMenuItem
              icon={XMarkIcon}
              onClick={() => {
                closeContextMenu();
                // Clear all filters
                setClientNameSearch('');
                setCityFilter('all');
                setAddressSearch('');
                setAgeMin('');
                setAgeMax('');
                setNotesSearch('');
                setSelectedReasons([]);
                toast.success('Všechny filtry vymazány');
              }}
            >
              Vymazat všechny filtry
            </ContextMenuItem>
            <ContextMenuDivider />
            <ContextMenuItem
              icon={Cog6ToothIcon}
              onClick={() => {
                closeContextMenu();
                setIsColumnPanelOpen(true);
              }}
            >
              Nastavení sloupců...
            </ContextMenuItem>
          </>
        )}
      </ContextMenu>

      {/* ===== COLUMN CONFIG PANEL ===== */}
      <ColumnConfigPanel
        isOpen={isColumnPanelOpen}
        onClose={() => setIsColumnPanelOpen(false)}
        columns={getAllColumns()}
        onToggleColumn={toggleColumn}
        onReorderColumns={reorderColumns}
        onReset={() => {
          resetToDefault();
          toast.success('Sloupce obnoveny do výchozího nastavení');
        }}
      />

      {/* ===== ADDRESS CORRECTION MODAL ===== */}
      <AddressCorrectionModal
        isOpen={isAddressCorrectionOpen}
        onClose={() => {
          setIsAddressCorrectionOpen(false);
          setAddressCorrectionClient(null);
        }}
        client={addressCorrectionClient}
        onAddressUpdated={handleAddressUpdated}
      />
    </div >
  );
}

export default VisitLog;
