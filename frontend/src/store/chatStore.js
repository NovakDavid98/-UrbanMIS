import { create } from 'zustand';
import { chatAPI } from '../services/api';
import socketService from '../services/socket';

const useChatStore = create((set, get) => ({
  // State
  isConnected: false,
  onlineUsers: [],
  conversations: [],
  activeConversation: null,
  messages: {},
  unreadCounts: {},
  typingUsers: {},
  isChatPanelOpen: false,
  isLoading: false,
  error: null,
  currentUserId: null,
  onNewMessageCallback: null,

  // Actions
  initializeChat: (token, userId) => {
    set({ currentUserId: userId });
    socketService.connect(token);

    // Load conversations immediately to show badges without opening chat
    get().loadConversations();

    // Set up event listeners
    socketService.on('connection_status', ({ connected }) => {
      set({ isConnected: connected });
    });

    socketService.on('user_online', (user) => {
      set((state) => ({
        onlineUsers: state.onlineUsers.some(u => u.id === user.userId)
          ? state.onlineUsers.map(u => u.id === user.userId ? { ...u, is_online: true } : u)
          : [...state.onlineUsers, {
            id: user.userId,
            username: user.username,
            first_name: user.firstName,
            last_name: user.lastName,
            is_online: true
          }]
      }));
    });

    socketService.on('user_offline', (data) => {
      set((state) => ({
        onlineUsers: state.onlineUsers.map(u =>
          u.id === data.userId ? { ...u, is_online: false } : u
        )
      }));
    });

    socketService.on('new_message', (message) => {
      const { activeConversation, messages, currentUserId, onNewMessageCallback } = get();

      // Check if message already exists to prevent duplicates
      const existingMessages = messages[message.conversation_id] || [];
      const messageExists = existingMessages.some(m => m.id === message.id);

      if (!messageExists) {
        set((state) => {
          // Remove any temporary messages for this conversation when real message arrives
          const conversationMessages = state.messages[message.conversation_id] || [];
          const filteredMessages = conversationMessages.filter(m => !m.is_temp);

          return {
            messages: {
              ...state.messages,
              [message.conversation_id]: [
                ...filteredMessages,
                message
              ]
            }
          };
        });

        // Update conversation last message time
        get().loadConversations();

        // Update unread count if not active conversation
        if (!activeConversation || activeConversation.id !== message.conversation_id) {
          set((state) => ({
            unreadCounts: {
              ...state.unreadCounts,
              [message.conversation_id]: (state.unreadCounts[message.conversation_id] || 0) + 1
            }
          }));
        }

        // Trigger notification sound only if message is from another user
        if (message.sender_id !== currentUserId && onNewMessageCallback) {
          onNewMessageCallback(message);
        }
      }
    });

    socketService.on('user_typing', (data) => {
      set((state) => ({
        typingUsers: {
          ...state.typingUsers,
          [data.userId]: data.username
        }
      }));
    });

    socketService.on('user_stop_typing', (data) => {
      set((state) => {
        const newTypingUsers = { ...state.typingUsers };
        delete newTypingUsers[data.userId];
        return { typingUsers: newTypingUsers };
      });
    });

    socketService.on('message_error', (error) => {
      // Remove temporary messages on error
      const { activeConversation } = get();
      if (activeConversation) {
        set((state) => ({
          messages: {
            ...state.messages,
            [activeConversation.id]: (state.messages[activeConversation.id] || []).filter(m => !m.is_temp)
          }
        }));
      }
      set({ error: error.error || 'Failed to send message' });
    });
    socketService.on('messages_seen', ({ conversationId, seenByUserId, seenAt }) => {
      set((state) => {
        const conversationMessages = state.messages[conversationId];
        if (!conversationMessages) return state;

        // Update all messages sent by current user in this conversation to be seen
        // if they weren't seen before
        const updatedMessages = conversationMessages.map(msg => {
          if (msg.sender_id === get().currentUserId && !msg.read_at) {
            return { ...msg, read_at: seenAt };
          }
          return msg;
        });

        return {
          messages: {
            ...state.messages,
            [conversationId]: updatedMessages
          }
        };
      });
    });
  },

  disconnectChat: () => {
    socketService.disconnect();
    set({
      isConnected: false,
      onlineUsers: [],
      conversations: [],
      activeConversation: null,
      messages: {},
      unreadCounts: {},
      typingUsers: {},
      isChatPanelOpen: false
    });
  },

  toggleChatPanel: () => {
    set((state) => ({ isChatPanelOpen: !state.isChatPanelOpen }));
  },

  loadOnlineUsers: async () => {
    try {
      set({ isLoading: true });
      const response = await chatAPI.getOnlineUsers();
      set({ onlineUsers: response.data.users, isLoading: false });
    } catch (error) {
      set({ error: error.message, isLoading: false });
    }
  },

  loadConversations: async () => {
    try {
      const response = await chatAPI.getConversations();
      const conversations = response.data.conversations;

      // Extract unread counts
      const unreadCounts = {};
      conversations.forEach(conv => {
        if (conv.unread_count > 0) {
          unreadCounts[conv.id] = conv.unread_count;
        }
      });

      set({ conversations, unreadCounts });
    } catch (error) {
      set({ error: error.message });
    }
  },

  startConversation: async (participantId) => {
    try {
      const response = await chatAPI.createConversation(participantId);
      const { conversation, participant } = response.data;

      // Add to conversations if not exists
      set((state) => {
        const exists = state.conversations.find(c => c.id === conversation.id);
        if (!exists) {
          return {
            conversations: [
              {
                ...conversation,
                other_user_id: participant.id,
                other_username: participant.username,
                other_first_name: participant.first_name,
                other_last_name: participant.last_name,
                other_is_online: state.onlineUsers.find(u => u.id === participant.id)?.is_online || false
              },
              ...state.conversations
            ]
          };
        }
        return state;
      });

      get().setActiveConversation(conversation.id);
      return conversation;
    } catch (error) {
      set({ error: error.message });
    }
  },

  setActiveConversation: async (conversationId) => {
    const { conversations, messages } = get();
    const conversation = conversations.find(c => c.id === conversationId);

    if (!conversation) return;

    set({ activeConversation: conversation });

    // Join conversation room
    socketService.joinConversation(conversationId);

    // Mark messages as seen immediately
    get().markConversationAsSeen(conversationId);

    // Load messages if not already loaded
    if (!messages[conversationId]) {
      try {
        const response = await chatAPI.getMessages(conversationId);
        set((state) => ({
          messages: {
            ...state.messages,
            [conversationId]: response.data.messages
          }
        }));
      } catch (error) {
        set({ error: error.message });
      }
    }
  },

  markConversationAsSeen: (conversationId) => {
    // Emit socket event
    socketService.markSeen(conversationId);

    // Clear local unread count
    set((state) => {
      const newUnreadCounts = { ...state.unreadCounts };
      delete newUnreadCounts[conversationId];
      return { unreadCounts: newUnreadCounts };
    });
  },

  closeConversation: () => {
    const { activeConversation } = get();
    if (activeConversation) {
      socketService.leaveConversation(activeConversation.id);
    }
    set({ activeConversation: null });
  },

  sendMessage: (content, messageType = 'text') => {
    const { activeConversation } = get();
    if (!activeConversation) return;

    // Create a temporary message with a unique temporary ID
    const tempMessage = {
      id: `temp_${Date.now()}_${Math.random()}`,
      conversation_id: activeConversation.id,
      sender_id: get().currentUserId, // We'll need to store this
      content,
      message_type: messageType,
      created_at: new Date().toISOString(),
      is_temp: true // Mark as temporary
    };

    // Add temporary message immediately for instant feedback
    set((state) => ({
      messages: {
        ...state.messages,
        [activeConversation.id]: [
          ...(state.messages[activeConversation.id] || []),
          tempMessage
        ]
      }
    }));

    socketService.sendMessage(activeConversation.id, content, messageType);

    // Set timeout to remove temporary message if no response after 10 seconds
    setTimeout(() => {
      set((state) => ({
        messages: {
          ...state.messages,
          [activeConversation.id]: (state.messages[activeConversation.id] || []).filter(m => m.id !== tempMessage.id)
        }
      }));
    }, 10000);
  },

  startTyping: () => {
    const { activeConversation } = get();
    if (!activeConversation) return;

    socketService.startTyping(activeConversation.id);
  },

  stopTyping: () => {
    const { activeConversation } = get();
    if (!activeConversation) return;

    socketService.stopTyping(activeConversation.id);
  },

  setOnNewMessageCallback: (callback) => set({ onNewMessageCallback: callback }),

  clearError: () => set({ error: null }),
}));

export default useChatStore;
