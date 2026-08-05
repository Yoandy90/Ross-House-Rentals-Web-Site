/**
 * Notification Context
 * Manages unread messages and notifications across the app
 */
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AppState } from 'react-native';
import api from '../services/api';
import { useAuth } from './AuthContext';

interface NotificationContextType {
  unreadChatMessages: number;
  unreadNotifications: number;
  totalUnread: number;
  setUnreadChatMessages: (count: number) => void;
  incrementUnreadChatMessages: () => void;
  resetUnreadChatMessages: () => void;
  refreshNotifications: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [unreadChatMessages, setUnreadChatMessages] = useState(0);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  // Load unread notifications from backend
  const refreshNotifications = async () => {
    if (!user) return;
    
    try {
      const response = await api.get('/notifications');
      const unreadCount = response.data.filter((n: any) => !n.read).length;
      setUnreadNotifications(unreadCount);
    } catch (error) {
      console.error('Error loading notifications:', error);
    }
  };

  // Load on mount and when user changes
  useEffect(() => {
    if (user) {
      refreshNotifications();
    }
  }, [user]);

  // Refresh periodically
  useEffect(() => {
    const interval = setInterval(() => {
      if (user) {
        refreshNotifications();
      }
    }, 30000); // Every 30 seconds

    return () => clearInterval(interval);
  }, [user]);

  // Reset chat messages when app comes to foreground
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        refreshNotifications();
      }
    });

    return () => subscription.remove();
  }, []);

  const incrementUnreadChatMessages = () => {
    setUnreadChatMessages(prev => prev + 1);
  };

  const resetUnreadChatMessages = () => {
    setUnreadChatMessages(0);
  };

  const totalUnread = unreadChatMessages + unreadNotifications;

  return (
    <NotificationContext.Provider
      value={{
        unreadChatMessages,
        unreadNotifications,
        totalUnread,
        setUnreadChatMessages,
        incrementUnreadChatMessages,
        resetUnreadChatMessages,
        refreshNotifications,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    // Return default values if not in provider (for safety)
    return {
      unreadChatMessages: 0,
      unreadNotifications: 0,
      totalUnread: 0,
      setUnreadChatMessages: () => {},
      incrementUnreadChatMessages: () => {},
      resetUnreadChatMessages: () => {},
      refreshNotifications: async () => {},
    };
  }
  return context;
}
