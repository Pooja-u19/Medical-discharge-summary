export interface ReusableDrawerProps {
    opened: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    position?: 'left' | 'right' | 'top' | 'bottom';
    closeButtonProps?: any;
  }