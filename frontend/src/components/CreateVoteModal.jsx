import { useState } from 'react';
import { votingAPI } from '../services/api';
import toast from 'react-hot-toast';
import {
  XMarkIcon,
  PlusIcon,
  TrashIcon,
  ChartBarIcon
} from '@heroicons/react/24/outline';

function CreateVoteModal({ isOpen, onClose, onVoteCreated }) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    voteType: 'multiple_choice',
    isAnonymous: false,
    endsAt: '',
    createWallPost: true
  });
  
  const [options, setOptions] = useState([
    { text: '' },
    { text: '' }
  ]);
  
  const [isLoading, setIsLoading] = useState(false);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleOptionChange = (index, value) => {
    setOptions(prev => prev.map((option, i) => 
      i === index ? { text: value } : option
    ));
  };

  const addOption = () => {
    setOptions(prev => [...prev, { text: '' }]);
  };

  const removeOption = (index) => {
    if (options.length > 2) {
      setOptions(prev => prev.filter((_, i) => i !== index));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    if (!formData.title.trim()) {
      toast.error('Název hlasování je povinný');
      return;
    }
    
    const validOptions = options.filter(opt => opt.text.trim());
    if (validOptions.length < 2) {
      toast.error('Musíte zadat alespoň 2 možnosti');
      return;
    }

    setIsLoading(true);
    try {
      const voteData = {
        ...formData,
        options: validOptions,
        endsAt: formData.endsAt || null
      };

      const response = await votingAPI.create(voteData);
      toast.success('Hlasování bylo vytvořeno!');
      
      if (onVoteCreated) {
        onVoteCreated(response.data);
      }
      
      handleClose();
    } catch (error) {
      toast.error('Nepodařilo se vytvořit hlasování');
      console.error('Create vote error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({
      title: '',
      description: '',
      voteType: 'multiple_choice',
      isAnonymous: false,
      endsAt: '',
      createWallPost: true
    });
    setOptions([{ text: '' }, { text: '' }]);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
              <ChartBarIcon className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">Vytvořit hlasování</h2>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <XMarkIcon className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Název hlasování *
            </label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Např. Které funkce chcete přidat?"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Popis (volitelný)
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Dodatečné informace o hlasování..."
            />
          </div>

          {/* Vote Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Typ hlasování
            </label>
            <select
              name="voteType"
              value={formData.voteType}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="single_choice">Jedna možnost</option>
              <option value="multiple_choice">Více možností</option>
              <option value="rating">Hodnocení (1-5 hvězdiček)</option>
            </select>
          </div>

          {/* Options */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Možnosti *
            </label>
            <div className="space-y-3">
              {options.map((option, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={option.text}
                    onChange={(e) => handleOptionChange(index, e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder={`Možnost ${index + 1}`}
                  />
                  {options.length > 2 && (
                    <button
                      type="button"
                      onClick={() => removeOption(index)}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
              
              <button
                type="button"
                onClick={addOption}
                className="flex items-center space-x-2 px-3 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              >
                <PlusIcon className="w-4 h-4" />
                <span>Přidat možnost</span>
              </button>
            </div>
          </div>

          {/* End Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Konec hlasování (volitelný)
            </label>
            <input
              type="datetime-local"
              name="endsAt"
              value={formData.endsAt}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Options */}
          <div className="space-y-3">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="isAnonymous"
                name="isAnonymous"
                checked={formData.isAnonymous}
                onChange={handleInputChange}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="isAnonymous" className="ml-2 text-sm text-gray-700">
                Anonymní hlasování
              </label>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="createWallPost"
                name="createWallPost"
                checked={formData.createWallPost}
                onChange={handleInputChange}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="createWallPost" className="ml-2 text-sm text-gray-700">
                Vytvořit příspěvek na nástěnce
              </label>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end space-x-3 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Zrušit
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? 'Vytváření...' : 'Vytvořit hlasování'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CreateVoteModal;
