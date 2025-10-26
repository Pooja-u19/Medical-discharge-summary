export interface TextInputProps {
    type?: 'text' | 'email' | 'password' | 'number' | 'textarea' | 'tel'; 
    label: string;
    placeholder?: string; 
    value: string | number ; 
    onChange: (value: string | number ) => void;
    name: string;
    disabled?: boolean;
    options?: { value: string; label: string }[];
    size?: string; 
    className?: string;
    radius?: string;
    classNames?: any;
    error?: React.ReactNode;
}