export interface Option {
  value: string;
  label: string;
}

export interface DropDownProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  name?: string;
  error?: React.ReactNode;
  options: Option[];
}
