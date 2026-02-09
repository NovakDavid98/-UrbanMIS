import { useEffect } from 'react';
import { 
  ChatBubbleLeftRightIcon
} from '@heroicons/react/24/outline';
import useChatStore from '../store/chatStore';

function ConversationsList() {
  const {
    conversations,
    loadConversations,
    setActiveConversation,
    unreadCounts,
    isLoading
  } = useChatStore();

  useEffect(() => {
    loadConversations();
  }, []);

  const getInitials = (firstName, lastName) => {
    return `${firstName?.charAt(0) || ''}${lastName?.charAt(0) || ''}`.toUpperCase();
  };

  const formatLastMessageTime = (timestamp) => {
    if (!timestamp) return '';
    
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now - date) / (1000 * 60 * 60);
    
    if (diffInHours < 24) {
      return date.toLocaleTimeString('cs-CZ', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } else if (diffInHours < 48) {
      return 'Včera';
    } else {
      return date.toLocaleDateString('cs-CZ', { 
        day: '2-digit', 
        month: '2-digit' 
      });
    }
  };

  const truncateMessage = (content, maxLength = 40) => {
    if (!content) return '';
    return content.length > maxLength ? content.substring(0, maxLength) + '...' : content;
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
      {conversations.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-32 text-gray-500">
          <ChatBubbleLeftRightIcon className="w-12 h-12 mb-2" />
          <p className="text-sm text-center px-4">
            Zatím žádné konverzace.<br />
            Začněte chatovat s někým z uživatelů!
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto chat-messages">
          <div className="p-3 space-y-2">
            {conversations.map((conversation) => {
            const unreadCount = unreadCounts[conversation.id] || 0;
            
            return (
              <div
                key={conversation.id}
                className="flex items-center p-3 rounded-xl hover:bg-gray-50 transition-all duration-200 cursor-pointer border border-transparent hover:border-gray-200 hover:shadow-sm"
                onClick={() => setActiveConversation(conversation.id)}
              >
                {/* Avatar */}
                <div className="relative">
                  <div className="w-12 h-12 bg-gradient-to-br from-gray-200 to-gray-300 rounded-full flex items-center justify-center text-sm font-medium text-gray-700 shadow-sm">
                    {getInitials(conversation.other_first_name, conversation.other_last_name)}
                  </div>
                  {/* Online status indicator */}
                  <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-white ${
                    conversation.other_is_online ? 'bg-green-400' : 'bg-gray-400'
                  }`} />
                </div>

                {/* Conversation info */}
                <div className="ml-3 flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className={`text-sm truncate ${
                      unreadCount > 0 ? 'font-semibold text-gray-900' : 'font-medium text-gray-900'
                    }`}>
                      {conversation.other_first_name} {conversation.other_last_name}
                    </p>
                    <div className="flex items-center space-x-2">
                      {conversation.last_message_time && (
                        <span className="text-xs text-gray-500">
                          {formatLastMessageTime(conversation.last_message_time)}
                        </span>
                      )}
                      {unreadCount > 0 && (
                        <span className="bg-primary-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                          {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {conversation.last_message_content && (
                    <div className="flex items-center space-x-1 mt-1">
                      {conversation.last_message_sender_name && (
                        <span className="text-xs text-gray-500">
                          {conversation.last_message_sender_name}:
                        </span>
                      )}
                      <p className={`text-xs truncate ${
                        unreadCount > 0 ? 'font-medium text-gray-700' : 'text-gray-500'
                      }`}>
                        {conversation.last_message_type === 'image' ? '📷 Obrázek' :
                         conversation.last_message_type === 'file' ? '📎 Soubor' :
                         truncateMessage(conversation.last_message_content)}
                      </p>
                    </div>
                  )}

                  <div className="flex items-center space-x-1 mt-1">
                    <div className={`w-2 h-2 rounded-full ${
                      conversation.other_is_online ? 'bg-green-400' : 'bg-gray-400'
                    }`} />
                    <span className="text-xs text-gray-500">
                      @{conversation.other_username}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
          </div>
        </div>
      )}
    </div>
  );
}

export default ConversationsList;
