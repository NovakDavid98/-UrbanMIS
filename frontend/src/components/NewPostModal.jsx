import { useState } from 'react';
import { XMarkIcon, PhotoIcon, DocumentIcon } from '@heroicons/react/24/outline';

function NewPostModal({ onClose, onSubmit }) {
  const [content, setContent] = useState('');
  const [postType, setPostType] = useState('general');
  const [imageUrl, setImageUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const postTypes = [
    { value: 'general', label: 'Obecné', emoji: '💬' },
    { value: 'announcement', label: 'Oznámení', emoji: '📢' },
    { value: 'event', label: 'Událost', emoji: '📅' },
    { value: 'success', label: 'Úspěch', emoji: '🏆' },
    { value: 'resource', label: 'Zdroje', emoji: '📚' },
    { value: 'milestone', label: 'Milník', emoji: '🚩' },
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!content.trim()) return;

    setIsSubmitting(true);
    try {
      await onSubmit({
        content: content.trim(),
        postType,
        imageUrl: imageUrl.trim() || null,
      });
      setContent('');
      setImageUrl('');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Nový příspěvek</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <XMarkIcon className="w-6 h-6 text-gray-400" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Post Type Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Typ příspěvku
            </label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {postTypes.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setPostType(type.value)}
                  className={`p-4 rounded-xl border-2 transition-all hover:shadow-md ${postType === type.value
                      ? 'border-indigo-500 bg-indigo-50 shadow-md'
                      : 'border-gray-200 hover:border-gray-300'
                    }`}
                >
                  <div className="text-3xl mb-2">{type.emoji}</div>
                  <div className="text-sm font-medium text-gray-900">{type.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Obsah příspěvku *
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Sdílejte novinky, úspěchy, nebo informace s týmem..."
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
              rows={6}
              required
            />
            <div className="mt-2 text-sm text-gray-500 text-right">
              {content.length} znaků
            </div>
          </div>

          {/* Image URL (optional) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              <PhotoIcon className="w-5 h-5" />
              URL obrázku (volitelné)
            </label>
            <input
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://example.com/image.jpg"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
            {imageUrl && (
              <div className="mt-3">
                <img
                  src={imageUrl}
                  alt="Preview"
                  className="max-w-full h-48 object-cover rounded-lg"
                  onError={(e) => {
                    e.target.style.display = 'none';
                  }}
                />
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors font-medium"
            >
              Zrušit
            </button>
            <button
              type="submit"
              disabled={!content.trim() || isSubmitting}
              className="btn bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Vytváření...' : 'Zveřejnit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default NewPostModal;
