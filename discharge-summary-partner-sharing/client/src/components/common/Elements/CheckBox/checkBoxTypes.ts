export interface CheckBoxProps {
  label?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  name?: string;
}
