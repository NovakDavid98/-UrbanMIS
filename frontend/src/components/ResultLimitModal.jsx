import { useState } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';

function ResultLimitModal({ isOpen, onClose, onConfirm, estimatedCount }) {
  const [customLimit, setCustomLimit] = useState('');
  const [selectedOption, setSelectedOption] = useState('100');

  if (!isOpen) return null;

  const handleConfirm = () => {
    let limit;
    if (selectedOption === 'all') {
      limit = estimatedCount || 10000; // Use a very high number for "all"
    } else if (selectedOption === 'custom') {
      limit = parseInt(customLimit) || 100;
    } else {
      limit = parseInt(selectedOption);
    }
    onConfirm(limit);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-900">📊 Počet výsledků</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="mb-6">
          <p className="text-gray-700 mb-2">
            Bylo nalezeno více než 100 výsledků! Kolik záznamů chcete zobrazit?
          </p>
          {estimatedCount && (
            <p className="text-sm text-purple-600 font-medium">
              Odhadovaný počet: ~{estimatedCount}+ výsledků
            </p>
          )}
        </div>

        <div className="space-y-3 mb-6">
          <label className="flex items-center p-3 border-2 rounded-lg cursor-pointer hover:bg-purple-50 transition-colors">
            <input
              type="radio"
              name="limit"
              value="100"
              checked={selectedOption === '100'}
              onChange={(e) => setSelectedOption(e.target.value)}
              className="w-4 h-4 text-purple-600"
            />
            <span className="ml-3 text-gray-900 font-medium">Prvních 100 výsledků</span>
          </label>

          <label className="flex items-center p-3 border-2 rounded-lg cursor-pointer hover:bg-purple-50 transition-colors">
            <input
              type="radio"
              name="limit"
              value="250"
              checked={selectedOption === '250'}
              onChange={(e) => setSelectedOption(e.target.value)}
              className="w-4 h-4 text-purple-600"
            />
            <span className="ml-3 text-gray-900 font-medium">250 výsledků</span>
          </label>

          <label className="flex items-center p-3 border-2 rounded-lg cursor-pointer hover:bg-purple-50 transition-colors">
            <input
              type="radio"
              name="limit"
              value="500"
              checked={selectedOption === '500'}
              onChange={(e) => setSelectedOption(e.target.value)}
              className="w-4 h-4 text-purple-600"
            />
            <span className="ml-3 text-gray-900 font-medium">500 výsledků</span>
          </label>

          <label className="flex items-center p-3 border-2 rounded-lg cursor-pointer hover:bg-purple-50 transition-colors">
            <input
              type="radio"
              name="limit"
              value="all"
              checked={selectedOption === 'all'}
              onChange={(e) => setSelectedOption(e.target.value)}
              className="w-4 h-4 text-purple-600"
            />
            <span className="ml-3 text-gray-900 font-medium">
              Všechny výsledky
              <span className="text-sm text-gray-500 ml-2">(může trvat déle)</span>
            </span>
          </label>

          <label className="flex items-center p-3 border-2 rounded-lg cursor-pointer hover:bg-purple-50 transition-colors">
            <input
              type="radio"
              name="limit"
              value="custom"
              checked={selectedOption === 'custom'}
              onChange={(e) => setSelectedOption(e.target.value)}
              className="w-4 h-4 text-purple-600"
            />
            <div className="ml-3 flex items-center gap-2 flex-1">
              <span className="text-gray-900 font-medium">Vlastní:</span>
              <input
                type="number"
                min="1"
                max="10000"
                value={customLimit}
                onChange={(e) => {
                  setCustomLimit(e.target.value);
                  setSelectedOption('custom');
                }}
                onClick={() => setSelectedOption('custom')}
                placeholder="např. 150"
                className="input py-1 px-2 w-24 text-sm"
              />
            </div>
          </label>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 border-2 border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
          >
            Zrušit
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-semibold hover:from-purple-700 hover:to-pink-700 transition-all shadow-lg"
          >
            Zobrazit výsledky
          </button>
        </div>
      </div>
    </div>
  );
}

export default ResultLimitModal;


