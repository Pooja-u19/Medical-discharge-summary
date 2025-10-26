import React, { createContext } from 'react';
import { notifications } from '@mantine/notifications';
import { ToastType } from '../enums';

interface ToastContextType {
  showToast: (message: string, title?: string, type?: ToastType) => void;
}

export const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const showToast = (message: string, title?: string, type: ToastType = ToastType.INFO, autoClose = 3000) => {
    notifications.show({
      id: (Math.random() * 10000).toString(),
      withCloseButton: true,
      autoClose,
      title,
      message,
      color: type === ToastType.ERROR ? 'red' : (type === ToastType.SUCCESS ? 'green' : (type === ToastType.WARNING ? 'yellow' : 'blue')),
      withBorder: true
    });
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
    </ToastContext.Provider>
  );
};
