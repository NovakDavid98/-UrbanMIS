import { useState } from 'react';
import {
  ChatBubbleLeftRightIcon,
  XMarkIcon,
  UserIcon,
  PaperAirplaneIcon,
  FaceSmileIcon,
  PaperClipIcon
} from '@heroicons/react/24/outline';
import { ChatBubbleLeftRightIcon as ChatBubbleLeftRightIconSolid } from '@heroicons/react/24/solid';
import useChatStore from '../store/chatStore';
import useAuthStore from '../store/authStore';
import OnlineUsersList from './OnlineUsersList';
import ConversationsList from './ConversationsList';
import ChatWindow from './ChatWindow';
import { FloatingChatIcon } from './icons/CustomChatIcon';

function ChatPanel() {
  const { user } = useAuthStore();
  const {
    isChatPanelOpen,
    toggleChatPanel,
    isConnected,
    activeConversation,
    unreadCounts
  } = useChatStore();

  const [activeTab, setActiveTab] = useState('users');

  // Calculate total unread conversations (not messages)
  const totalUnread = Object.keys(unreadCounts).length;

  if (!user) return null;

  return (
    <>
      {/* Chat Toggle Button */}
      {/* Chat Toggle Button - Only show when panel is closed */}
      {!isChatPanelOpen && (
        <div className="fixed bottom-6 right-6 z-40">
          <button
            onClick={toggleChatPanel}
            className="group relative rounded-full transition-transform duration-300 transform hover:scale-110 focus:outline-none"
          >
            <FloatingChatIcon className="w-16 h-16 drop-shadow-xl" />

            {/* Unread badge */}
            {totalUnread > 0 && (
              <span className="absolute top-0 right-0 bg-red-500 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center font-bold border-2 border-white">
                {totalUnread > 99 ? '99+' : totalUnread}
              </span>
            )}
          </button>
        </div>
      )}

      {/* Chat Panel */}
      {isChatPanelOpen && (
        <div className="fixed inset-y-0 right-0 w-80 bg-white shadow-2xl border-l border-gray-200 z-30 flex flex-col rounded-l-xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 text-white p-4 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <ChatBubbleLeftRightIcon className="w-6 h-6" />
              <h3 className="font-semibold">Chat</h3>
              {!isConnected && (
                <span className="text-xs bg-red-500 px-2 py-1 rounded">Offline</span>
              )}
            </div>
            <button
              onClick={toggleChatPanel}
              className="text-white hover:text-gray-200 transition-colors"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {activeConversation ? (
              <ChatWindow />
            ) : (
              <>
                {/* Tab Navigation */}
                <div className="border-b border-gray-200 bg-gray-50">
                  <nav className="flex">
                    <button
                      onClick={() => setActiveTab('users')}
                      className={`flex-1 py-3 px-4 text-sm font-medium text-center border-b-2 transition-colors rounded-t-lg mx-1 ${activeTab === 'users'
                        ? 'border-indigo-500 text-indigo-600 bg-white'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                        }`}
                    >
                      <div className="flex items-center justify-center space-x-1">
                        <UserIcon className="w-4 h-4" />
                        <span>Uživatelé</span>
                      </div>
                    </button>
                    <button
                      onClick={() => setActiveTab('conversations')}
                      className={`flex-1 py-3 px-4 text-sm font-medium text-center border-b-2 transition-colors relative rounded-t-lg mx-1 ${activeTab === 'conversations'
                        ? 'border-indigo-500 text-indigo-600 bg-white'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                        }`}
                    >
                      <div className="flex items-center justify-center space-x-1">
                        <ChatBubbleLeftRightIcon className="w-4 h-4" />
                        <span>Konverzace</span>
                        {totalUnread > 0 && (
                          <span className="bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                            {totalUnread > 9 ? '9+' : totalUnread}
                          </span>
                        )}
                      </div>
                    </button>
                  </nav>
                </div>

                {/* Tab Content */}
                <div className="flex-1 flex flex-col min-h-0">
                  {activeTab === 'users' && <OnlineUsersList />}
                  {activeTab === 'conversations' && <ConversationsList />}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Overlay for mobile */}
      {isChatPanelOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden"
          onClick={toggleChatPanel}
        />
      )}
    </>
  );
}

export default ChatPanel;
