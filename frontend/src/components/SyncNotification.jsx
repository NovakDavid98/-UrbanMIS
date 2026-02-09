import { useEffect, useState } from 'react';
import socketService from '../services/socket';
import toast from 'react-hot-toast';

function SyncNotification() {
  const [syncStatus, setSyncStatus] = useState(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Listen for RAG sync notifications
    socketService.on('rag-sync-notification', (data) => {
      console.log('RAG Sync Notification:', data);
      setSyncStatus(data);
      setIsVisible(true);

      // Show toast notification
      if (data.status === 'started') {
        toast.loading(data.message, { id: 'rag-sync', duration: Infinity });
      } else if (data.status === 'completed') {
        toast.success(data.message, { id: 'rag-sync' });
        // Hide after 5 seconds
        setTimeout(() => setIsVisible(false), 5000);
      } else if (data.status === 'failed') {
        toast.error(data.message, { id: 'rag-sync' });
        // Hide after 5 seconds
        setTimeout(() => setIsVisible(false), 5000);
      }
    });

    return () => {
      socketService.off('rag-sync-notification');
    };
  }, []);

  if (!isVisible || !syncStatus) {
    return null;
  }

  const getStatusColor = () => {
    switch (syncStatus.status) {
      case 'started':
        return 'bg-blue-50 border-blue-200 text-blue-800';
      case 'completed':
        return 'bg-green-50 border-green-200 text-green-800';
      case 'failed':
        return 'bg-red-50 border-red-200 text-red-800';
      default:
        return 'bg-gray-50 border-gray-200 text-gray-800';
    }
  };

  const getStatusIcon = () => {
    switch (syncStatus.status) {
      case 'started':
        return (
          <svg className="animate-spin h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        );
      case 'completed':
        return (
          <svg className="h-5 w-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        );
      case 'failed':
        return (
          <svg className="h-5 w-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <div className="fixed top-20 right-6 z-50 max-w-sm animate-slide-in-right">
      <div className={`border rounded-lg shadow-lg p-4 ${getStatusColor()}`}>
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            {getStatusIcon()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">{syncStatus.message}</p>
            {syncStatus.stats && (
              <p className="text-xs mt-1 opacity-80">
                Klienti: {syncStatus.stats.total_clients} | Návštěvy: {syncStatus.stats.total_visits}
              </p>
            )}
          </div>
          {syncStatus.status !== 'started' && (
            <button
              onClick={() => setIsVisible(false)}
              className="flex-shrink-0 ml-2 text-current opacity-60 hover:opacity-100"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default SyncNotification;

