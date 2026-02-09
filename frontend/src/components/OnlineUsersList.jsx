import { useEffect } from 'react';
import { 
  UserIcon,
  ChatBubbleLeftIcon
} from '@heroicons/react/24/outline';
import useChatStore from '../store/chatStore';

function OnlineUsersList() {
  const {
    onlineUsers,
    loadOnlineUsers,
    startConversation,
    isLoading
  } = useChatStore();

  useEffect(() => {
    loadOnlineUsers();
  }, []);

  const handleStartChat = async (userId) => {
    await startConversation(userId);
  };

  const getInitials = (firstName, lastName) => {
    return `${firstName?.charAt(0) || ''}${lastName?.charAt(0) || ''}`.toUpperCase();
  };

  const getRoleColor = (role) => {
    switch (role) {
      case 'admin': return 'bg-red-100 text-red-800';
      case 'worker': return 'bg-blue-100 text-blue-800';
      case 'viewer': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {onlineUsers.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-32 text-gray-500">
          <UserIcon className="w-12 h-12 mb-2" />
          <p className="text-sm">Žádní uživatelé online</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto chat-messages">
          <div className="p-3 space-y-2">
            {onlineUsers.map((user) => (
            <div
              key={user.id}
              className="flex items-center p-3 rounded-xl hover:bg-gray-50 transition-all duration-200 group cursor-pointer border border-transparent hover:border-gray-200 hover:shadow-sm"
              onClick={() => handleStartChat(user.id)}
            >
              {/* Avatar */}
              <div className="relative">
                <div className="w-10 h-10 bg-gradient-to-br from-gray-200 to-gray-300 rounded-full flex items-center justify-center text-sm font-medium text-gray-700 shadow-sm">
                  {getInitials(user.first_name, user.last_name)}
                </div>
                {/* Online status indicator */}
                <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-white ${
                  user.is_online ? 'bg-green-400' : 'bg-gray-400'
                }`} />
              </div>

              {/* User info */}
              <div className="ml-3 flex-1 min-w-0">
                <div className="flex items-center space-x-2">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {user.first_name} {user.last_name}
                  </p>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getRoleColor(user.role)}`}>
                    {user.role}
                  </span>
                </div>
                <p className="text-xs text-gray-500 truncate">@{user.username}</p>
                <div className="flex items-center space-x-1 mt-1">
                  <div className={`w-2 h-2 rounded-full ${
                    user.is_online ? 'bg-green-400' : 'bg-gray-400'
                  }`} />
                  <span className="text-xs text-gray-500">
                    {user.is_online ? 'Online' : 'Offline'}
                  </span>
                  {!user.is_online && user.last_seen && (
                    <span className="text-xs text-gray-400">
                      • {new Date(user.last_seen).toLocaleTimeString('cs-CZ', { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </span>
                  )}
                </div>
              </div>

              {/* Chat button */}
              <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                <ChatBubbleLeftIcon className="w-5 h-5 text-primary-600" />
              </div>
            </div>
          ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default OnlineUsersList;
