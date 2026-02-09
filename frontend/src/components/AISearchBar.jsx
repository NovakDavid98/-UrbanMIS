import { useState } from 'react';
import { SparklesIcon, MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

function AISearchBar({ onSearch, placeholder, examples }) {
  const [query, setQuery] = useState('');
  const [showExamples, setShowExamples] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) {
      toast.error('Zadejte vyhledávací dotaz');
      return;
    }

    setIsSearching(true);
    try {
      await onSearch(query);
    } catch (error) {
      console.error('Search error:', error);
      toast.error('Chyba při vyhledávání');
    } finally {
      setIsSearching(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSearch();
    }
  };

  const handleExampleClick = (example) => {
    setQuery(example);
    setShowExamples(false);
    // Automatically search with example
    setTimeout(() => {
      onSearch(example);
    }, 100);
  };

  return (
    <div className="relative">
      {/* Search Bar */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <SparklesIcon className="h-6 w-6 text-purple-500 animate-pulse" />
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyPress={handleKeyPress}
          onFocus={() => setShowExamples(true)}
          placeholder={placeholder || "🔍 Zkuste: 'Zobraz ženy z Ostravy' nebo 'Show visits this week'"}
          className="w-full pl-14 pr-24 py-4 text-lg border-2 border-purple-300 rounded-xl focus:ring-4 focus:ring-purple-200 focus:border-purple-500 transition-all shadow-lg"
        />
        <div className="absolute inset-y-0 right-0 flex items-center gap-2 pr-2">
          {query && (
            <button
              onClick={() => {
                setQuery('');
                setShowExamples(false);
              }}
              className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              title="Vymazat"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          )}
          <button
            onClick={handleSearch}
            disabled={isSearching || !query.trim()}
            className="px-6 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-medium hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSearching ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Hledám...
              </>
            ) : (
              <>
                <MagnifyingGlassIcon className="w-5 h-5" />
                Hledat
              </>
            )}
          </button>
        </div>
      </div>

      {/* Examples Dropdown */}
      {showExamples && examples && examples.length > 0 && (
        <div className="absolute z-10 mt-2 w-full bg-white border border-gray-200 rounded-xl shadow-xl max-h-64 overflow-y-auto">
          <div className="p-3 border-b border-gray-200 bg-gray-50">
            <p className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <SparklesIcon className="w-4 h-4 text-purple-500" />
              Příklady dotazů:
            </p>
          </div>
          <div className="p-2">
            {examples.map((example, index) => (
              <button
                key={index}
                onClick={() => handleExampleClick(example)}
                className="w-full text-left px-4 py-3 hover:bg-purple-50 rounded-lg transition-colors text-sm text-gray-700 hover:text-purple-700"
              >
                <SparklesIcon className="w-4 h-4 inline mr-2 text-purple-400" />
                {example}
              </button>
            ))}
          </div>
          <div className="p-3 border-t border-gray-200 bg-gray-50 text-xs text-gray-500">
            💡 Podporované jazyky: Čeština, Ukrajinština, English
          </div>
        </div>
      )}

      {/* Click outside to close examples */}
      {showExamples && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => setShowExamples(false)}
        />
      )}
    </div>
  );
}

export default AISearchBar;


