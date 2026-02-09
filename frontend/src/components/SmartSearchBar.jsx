import { useState, useEffect } from 'react';
import {
  MagnifyingGlassIcon,
  AdjustmentsHorizontalIcon,
  SparklesIcon,
  XMarkIcon,
  ChevronDownIcon,
  ChevronUpIcon
} from '@heroicons/react/24/outline';
import AIDisabledModal from './AIDisabledModal';

/**
 * SmartSearchBar - Unified search component with auto-detection
 * Supports both AI natural language search and advanced filter-based search
 */
function SmartSearchBar({
  onAISearch,
  onFilterSearch,
  filterOptions = {},
  currentFilters = {},
  placeholder = "Hledat...",
  aiExamples = [],
  showAdvancedFilters: externalShowAdvanced,
  onToggleAdvancedFilters,
  type = 'clients' // 'clients' or 'visits'
}) {
  const [query, setQuery] = useState('');
  const [isAIMode, setIsAIMode] = useState(false); // Simple toggle: AI or normal search
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(externalShowAdvanced || false);
  const [localFilters, setLocalFilters] = useState(currentFilters);
  const [showAIDisabledModal, setShowAIDisabledModal] = useState(false);

  // Check if this is demo instance
  const isDemo = window.location.hostname === 'demo.centralnimozek.duckdns.org';

  useEffect(() => {
    if (externalShowAdvanced !== undefined) {
      setShowAdvancedFilters(externalShowAdvanced);
    }
  }, [externalShowAdvanced]);

  useEffect(() => {
    setLocalFilters(currentFilters);
  }, [currentFilters]);

  const handleQueryChange = (e) => {
    setQuery(e.target.value);
  };

  const toggleAIMode = () => {
    // If demo instance, show modal instead of enabling AI
    if (isDemo) {
      setShowAIDisabledModal(true);
      return;
    }
    setIsAIMode(!isAIMode);
  };

  const handleSearch = (e) => {
    e?.preventDefault();

    if (showAdvancedFilters) {
      // Use advanced filters
      if (onFilterSearch) {
        onFilterSearch(localFilters);
      }
    } else if (query.trim()) {
      // Use AI or normal search based on toggle
      if (isAIMode && onAISearch) {
        onAISearch(query);
      } else if (onFilterSearch) {
        // Simple text search through filters
        onFilterSearch({ ...currentFilters, search: query });
      }
    }
  };

  const toggleAdvancedFilters = () => {
    const newState = !showAdvancedFilters;
    setShowAdvancedFilters(newState);
    if (onToggleAdvancedFilters) {
      onToggleAdvancedFilters(newState);
    }
  };

  const handleFilterChange = (key, value) => {
    const newFilters = { ...localFilters, [key]: value };
    setLocalFilters(newFilters);
  };

  const applyFilters = () => {
    if (onFilterSearch) {
      onFilterSearch(localFilters);
    }
  };

  const clearFilters = () => {
    // Define appropriate empty values for different field types
    const numericFields = ['ageMin', 'ageMax'];
    const textFields = ['search', 'clientName', 'addressSearch', 'notesSearch', 'address'];
    const dateFields = ['startDate', 'endDate'];

    const clearedFilters = Object.keys(localFilters).reduce((acc, key) => {
      if (textFields.includes(key)) {
        acc[key] = '';
      } else if (numericFields.includes(key)) {
        acc[key] = '';
      } else if (dateFields.includes(key) && type === 'visits') {
        // For visits, set to today's date
        acc[key] = key === 'startDate' ? new Date(new Date().setDate(new Date().getDate() - 7)).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
      } else {
        acc[key] = 'all';
      }
      return acc;
    }, {});

    setLocalFilters(clearedFilters);
    if (onFilterSearch) {
      onFilterSearch(clearedFilters);
    }
  };

  const getModeBadge = () => {
    if (showAdvancedFilters) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
          <AdjustmentsHorizontalIcon className="w-3 h-3" />
          Filtry aktivní
        </span>
      );
    }

    if (isAIMode && query.trim()) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-purple-100 text-purple-800 rounded-full">
          <SparklesIcon className="w-3 h-3" />
          Chytré hledání
        </span>
      );
    }

    if (query.trim()) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-gray-100 text-gray-600 rounded-full">
          <MagnifyingGlassIcon className="w-3 h-3" />
          Textové hledání
        </span>
      );
    }

    return null;
  };

  return (
    <div className="space-y-3">
      {/* AI Disabled Modal */}
      <AIDisabledModal
        isOpen={showAIDisabledModal}
        onClose={() => setShowAIDisabledModal(false)}
      />

      {/* Main Search Bar */}
      <div className="relative">
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              {isAIMode && !showAdvancedFilters ? (
                <SparklesIcon className="h-5 w-5 text-purple-400 animate-pulse" />
              ) : (
                <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
              )}
            </div>
            <input
              type="text"
              value={query}
              onChange={handleQueryChange}
              placeholder={placeholder}
              className={`block w-full pl-10 pr-32 py-3 border rounded-lg shadow-sm focus:ring-2 focus:ring-offset-0 transition-all ${isAIMode && !showAdvancedFilters
                ? 'border-purple-300 focus:border-purple-500 focus:ring-purple-500'
                : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
                }`}
              disabled={showAdvancedFilters}
            />
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center gap-2">
              {getModeBadge()}
            </div>
          </div>

          {/* AI Toggle Button */}
          {!showAdvancedFilters && (
            <button
              type="button"
              onClick={toggleAIMode}
              className={`inline-flex items-center gap-2 px-4 py-3 border rounded-lg font-medium transition-all ${isDemo
                  ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed opacity-75'
                  : isAIMode
                    ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white border-purple-600 hover:from-purple-700 hover:to-pink-700 shadow-lg'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              title={isDemo ? "Chytré vyhledávání není dostupné v demo verzi" : (isAIMode ? "Chytré vyhledávání zapnuto" : "Chytré vyhledávání vypnuto")}
            >
              <SparklesIcon className={`h-5 w-5 ${isDemo ? 'text-gray-400' : (isAIMode ? 'text-white' : 'text-gray-400')}`} />
              <span className="hidden md:inline">Chytré</span>
              {/* Toggle switch */}
              <div className={`w-10 h-5 rounded-full transition-colors ${isDemo ? 'bg-gray-200' : (isAIMode ? 'bg-white/30' : 'bg-gray-200')} relative`}>
                <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full ${isDemo ? 'bg-gray-300' : 'bg-white'} shadow-md transition-transform duration-200 ${isAIMode && !isDemo ? 'translate-x-5' : 'translate-x-0'}`}></div>
              </div>
            </button>
          )}

          <button
            type="button"
            onClick={toggleAdvancedFilters}
            className={`inline-flex items-center gap-2 px-4 py-3 border rounded-lg font-medium transition-all ${showAdvancedFilters
              ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700'
              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
          >
            <AdjustmentsHorizontalIcon className="h-5 w-5" />
            <span className="hidden sm:inline">Pokročilé filtry</span>
            {showAdvancedFilters ? <ChevronUpIcon className="h-4 w-4" /> : <ChevronDownIcon className="h-4 w-4" />}
          </button>

          {!showAdvancedFilters && query && (
            <button
              type="submit"
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-lg font-medium hover:from-blue-700 hover:to-cyan-700 transition-all shadow-lg hover:shadow-xl"
            >
              Hledat
            </button>
          )}
        </form>
      </div>

      {/* AI Examples (shown when AI mode is enabled) */}
      {!showAdvancedFilters && isAIMode && aiExamples.length > 0 && (
        <div className="flex items-center gap-2 text-sm text-gray-600 flex-wrap bg-purple-50 border border-purple-200 rounded-lg p-3">
          <SparklesIcon className="w-4 h-4 text-purple-500" />
          <span className="font-medium">💡 Zkuste chytré hledání:</span>
          {aiExamples.slice(0, 3).map((example, index) => (
            <button
              key={index}
              onClick={() => setQuery(example)}
              className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full hover:bg-purple-200 transition-colors text-xs font-medium"
            >
              "{example}"
            </button>
          ))}
        </div>
      )}

      {/* Advanced Filters Panel */}
      {showAdvancedFilters && (
        <div className="bg-gradient-to-br from-blue-50 to-cyan-50 border-2 border-blue-200 rounded-xl p-6 space-y-4 animate-slideDown">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <AdjustmentsHorizontalIcon className="w-5 h-5 text-blue-600" />
              Pokročilé filtry
            </h3>
            <button
              onClick={clearFilters}
              className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1"
            >
              <XMarkIcon className="w-4 h-4" />
              Vymazat vše
            </button>
          </div>

          {/* Clients Filters */}
          {type === 'clients' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Pohlaví</label>
                <select
                  value={localFilters.gender || 'all'}
                  onChange={(e) => handleFilterChange('gender', e.target.value)}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                  <option value="all">Všechny</option>
                  <option value="Žena">Žena</option>
                  <option value="Muž">Muž</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Město</label>
                <select
                  value={localFilters.czechCity || 'all'}
                  onChange={(e) => handleFilterChange('czechCity', e.target.value)}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                  <option value="all">Všechna města</option>
                  {filterOptions.cities?.map((city) => (
                    <option key={city} value={city}>{city}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Pojišťovna</label>
                <select
                  value={localFilters.insurance || 'all'}
                  onChange={(e) => handleFilterChange('insurance', e.target.value)}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                  <option value="all">Všechny</option>
                  {filterOptions.insuranceCompanies?.map((insurance) => (
                    <option key={insurance} value={insurance}>{insurance}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Věk od</label>
                <input
                  type="number"
                  value={localFilters.ageMin || ''}
                  onChange={(e) => handleFilterChange('ageMin', e.target.value)}
                  placeholder="0"
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Věk do</label>
                <input
                  type="number"
                  value={localFilters.ageMax || ''}
                  onChange={(e) => handleFilterChange('ageMax', e.target.value)}
                  placeholder="100"
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={localFilters.activityStatus || 'all'}
                  onChange={(e) => handleFilterChange('activityStatus', e.target.value)}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                  <option value="all">Všechny</option>
                  <option value="active">Aktivní</option>
                  <option value="inactive">Neaktivní</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Typ víza</label>
                <select
                  value={localFilters.visaType || 'all'}
                  onChange={(e) => handleFilterChange('visaType', e.target.value)}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                  <option value="all">Všechny</option>
                  {filterOptions.visaTypes?.slice(0, 20).map((visa) => (
                    <option key={visa} value={visa}>{visa}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ukrajinský region</label>
                <select
                  value={localFilters.ukrainianRegion || 'all'}
                  onChange={(e) => handleFilterChange('ukrainianRegion', e.target.value)}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                  <option value="all">Všechny regiony</option>
                  {filterOptions.ukrainianRegions?.slice(0, 30).map((region) => (
                    <option key={region} value={region}>{region}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Vyhledat v adrese</label>
                <input
                  type="text"
                  value={localFilters.addressSearch || ''}
                  onChange={(e) => handleFilterChange('addressSearch', e.target.value)}
                  placeholder="např. Školní"
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
            </div>
          )}

          {/* Visits Filters */}
          {type === 'visits' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Datum od</label>
                <input
                  type="date"
                  value={localFilters.startDate || ''}
                  onChange={(e) => handleFilterChange('startDate', e.target.value)}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Datum do</label>
                <input
                  type="date"
                  value={localFilters.endDate || ''}
                  onChange={(e) => handleFilterChange('endDate', e.target.value)}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Kategorie</label>
                <select
                  value={localFilters.category || 'all'}
                  onChange={(e) => handleFilterChange('category', e.target.value)}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                  <option value="all">Všechny</option>
                  <option value="warehouse">Humanitární sklad</option>
                  <option value="assistance">Asistenční centrum</option>
                  <option value="community">Komunitní centrum</option>
                  <option value="donations">Dary</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Jméno klienta</label>
                <input
                  type="text"
                  value={localFilters.clientName || ''}
                  onChange={(e) => handleFilterChange('clientName', e.target.value)}
                  placeholder="Hledat podle jména"
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Město</label>
                <select
                  value={localFilters.city || 'all'}
                  onChange={(e) => handleFilterChange('city', e.target.value)}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                  <option value="all">Všechna města</option>
                  {filterOptions.cities?.map((city) => (
                    <option key={city} value={city}>{city}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Adresa</label>
                <input
                  type="text"
                  value={localFilters.address || ''}
                  onChange={(e) => handleFilterChange('address', e.target.value)}
                  placeholder="Hledat v adrese"
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Věk od</label>
                <input
                  type="number"
                  value={localFilters.ageMin || ''}
                  onChange={(e) => handleFilterChange('ageMin', e.target.value)}
                  placeholder="0"
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Věk do</label>
                <input
                  type="number"
                  value={localFilters.ageMax || ''}
                  onChange={(e) => handleFilterChange('ageMax', e.target.value)}
                  placeholder="100"
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Poznámky obsahují</label>
                <input
                  type="text"
                  value={localFilters.notesSearch || ''}
                  onChange={(e) => handleFilterChange('notesSearch', e.target.value)}
                  placeholder="Hledat v poznámkách"
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t border-blue-200">
            <button
              onClick={clearFilters}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Vymazat
            </button>
            <button
              onClick={applyFilters}
              className="px-6 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-cyan-600 rounded-lg hover:from-blue-700 hover:to-cyan-700 transition-all shadow-lg"
            >
              Použít filtry
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default SmartSearchBar;

