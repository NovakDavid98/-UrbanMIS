import { useState, useEffect, useRef, useCallback } from 'react';
import {
  ArrowLeftIcon,
  PaperAirplaneIcon,
  FaceSmileIcon,
  PaperClipIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import EmojiPicker from 'emoji-picker-react';
import useChatStore from '../store/chatStore';
import useAuthStore from '../store/authStore';

function ChatWindow() {
  const { user } = useAuthStore();
  const {
    activeConversation,
    messages,
    closeConversation,
    sendMessage,
    startTyping,
    stopTyping,
    typingUsers,
    markConversationAsSeen
  } = useChatStore();

  const [messageText, setMessageText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const scrollTimeoutRef = useRef(null);

  const conversationMessages = messages[activeConversation?.id] || [];

  // Auto-scroll to bottom when new messages arrive (only if user isn't manually scrolling)
  useEffect(() => {
    if (!isUserScrolling) {
      scrollToBottom();
    } else {
      // Show scroll to bottom button if user is scrolling and new messages arrive
      setShowScrollToBottom(true);
    }
  }, [conversationMessages, isUserScrolling]);

  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
      setShowScrollToBottom(false);
      setIsUserScrolling(false);
    }
  }, []);

  const handleScroll = useCallback(() => {
    if (!messagesContainerRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50; // 50px threshold

    if (isAtBottom) {
      setIsUserScrolling(false);
      setShowScrollToBottom(false);
    } else {
      setIsUserScrolling(true);
      setShowScrollToBottom(true);
    }

    // Clear existing timeout
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    // Set timeout to detect when user stops scrolling
    scrollTimeoutRef.current = setTimeout(() => {
      const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;

      if (isAtBottom) {
        setIsUserScrolling(false);
        setShowScrollToBottom(false);
      }
    }, 150);
  }, []);

  const handleSendMessage = (e) => {
    e.preventDefault();

    if (!messageText.trim()) return;

    sendMessage(messageText.trim());
    setMessageText('');
    setShowEmojiPicker(false);

    // Stop typing indicator
    if (isTyping) {
      stopTyping();
      setIsTyping(false);
    }
  };

  const handleInputChange = (e) => {
    setMessageText(e.target.value);

    // Handle typing indicators
    if (!isTyping) {
      startTyping();
      setIsTyping(true);
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set new timeout to stop typing
    typingTimeoutRef.current = setTimeout(() => {
      stopTyping();
      setIsTyping(false);
    }, 1000);
  };

  const handleEmojiClick = (emojiObject) => {
    setMessageText(prev => prev + emojiObject.emoji);
    setShowEmojiPicker(false);
  };

  const formatMessageTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString('cs-CZ', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getInitials = (firstName, lastName) => {
    return `${firstName?.charAt(0) || ''}${lastName?.charAt(0) || ''}`.toUpperCase();
  };

  // Get typing users for this conversation (excluding current user)
  const currentTypingUsers = Object.entries(typingUsers)
    .filter(([userId, username]) => userId !== user?.id)
    .map(([userId, username]) => username);

  if (!activeConversation) return null;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4 flex items-center space-x-3">
        <button
          onClick={closeConversation}
          className="text-gray-600 hover:text-gray-800 transition-colors"
        >
          <ArrowLeftIcon className="w-5 h-5" />
        </button>

        <div className="relative">
          <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center text-sm font-bold">
            {getInitials(activeConversation.other_first_name, activeConversation.other_last_name)}
          </div>
          <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-white ${activeConversation.other_is_online ? 'bg-green-400' : 'bg-gray-400'
            }`} />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">
            {activeConversation.other_first_name} {activeConversation.other_last_name}
          </p>
          <p className="text-xs text-gray-500">
            {activeConversation.other_is_online ? 'Online' : 'Offline'}
          </p>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50 relative chat-messages"
      >
        {conversationMessages.map((message) => {
          const isOwnMessage = message.sender_id === user?.id;
          const isTemporary = message.is_temp;

          return (
            <div
              key={message.id}
              className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'} ${isTemporary ? 'opacity-70' : ''} message-enter`}
            >
              <div className={`max-w-xs lg:max-w-md px-4 py-3 rounded-2xl shadow-sm transition-opacity ${isOwnMessage
                ? 'bg-indigo-600 text-white'
                : 'bg-white text-gray-900 border border-gray-200'
                }`}>
                {!isOwnMessage && (
                  <p className="text-xs font-medium mb-1 opacity-75">
                    {message.first_name} {message.last_name}
                  </p>
                )}

                <p className="text-sm break-words">{message.content}</p>

                <div className="flex items-center justify-between mt-1">
                  <div className="flex items-center space-x-1">
                    <p className={`text-xs ${isOwnMessage ? 'text-indigo-100' : 'text-gray-500'
                      }`}>
                      {formatMessageTime(message.created_at)}
                    </p>
                    {isOwnMessage && message.read_at && (
                      <span className="text-indigo-100" title={`Přečteno: ${formatMessageTime(message.read_at)}`}>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                          <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                          <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                        </svg>
                      </span>
                    )}
                  </div>
                  {isTemporary && (
                    <div className="ml-2">
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-current opacity-50"></div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Typing indicator */}
        {currentTypingUsers.length > 0 && (
          <div className="flex justify-start">
            <div className="bg-white text-gray-900 px-4 py-2 rounded-2xl shadow-sm border border-gray-200">
              <div className="flex items-center space-x-2">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
                <span className="text-xs text-gray-500">
                  {currentTypingUsers.join(', ')} píše...
                </span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />

        {/* Scroll to bottom button */}
        {showScrollToBottom && (
          <button
            onClick={scrollToBottom}
            className="absolute bottom-4 right-4 bg-indigo-600 text-white p-3 rounded-full shadow-lg hover:bg-indigo-700 transition-all duration-200 transform hover:scale-105 z-10"
            title="Přejít na konec konverzace"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </button>
        )}
      </div>

      {/* Emoji Picker */}
      {showEmojiPicker && (
        <div className="border-t border-gray-200 p-2">
          <div className="relative">
            <button
              onClick={() => setShowEmojiPicker(false)}
              className="absolute top-2 right-2 text-gray-500 hover:text-gray-700 z-10"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
            <EmojiPicker
              onEmojiClick={handleEmojiClick}
              width="100%"
              height={300}
              searchDisabled
              skinTonesDisabled
              previewConfig={{ showPreview: false }}
            />
          </div>
        </div>
      )}

      {/* Input */}
      <div className="border-t border-gray-200 p-4 bg-white">
        <form onSubmit={handleSendMessage} className="flex items-end space-x-2">
          <div className="flex-1">
            <div className="relative">
              <textarea
                value={messageText}
                onChange={handleInputChange}
                placeholder="Napište zprávu..."
                className="w-full resize-none border border-gray-300 rounded-xl px-4 py-3 pr-20 focus:ring-2 focus:ring-indigo-500 focus:border-transparent shadow-sm"
                rows={1}
                style={{ minHeight: '44px', maxHeight: '120px' }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage(e);
                  }
                }}
                onFocus={() => {
                  // Auto-scroll to bottom when user focuses on input
                  if (!isUserScrolling) {
                    setTimeout(scrollToBottom, 100);
                  }
                  // Mark as seen when typing
                  if (activeConversation) {
                    markConversationAsSeen(activeConversation.id);
                  }
                }}
              />

              {/* Emoji and File buttons */}
              <div className="absolute right-2 bottom-2 flex items-center space-x-1">
                <button
                  type="button"
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <FaceSmileIcon className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                  title="Připojit soubor (brzy)"
                >
                  <PaperClipIcon className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={!messageText.trim()}
            className="bg-indigo-600 text-white p-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <PaperAirplaneIcon className="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  );
}

export default ChatWindow;
