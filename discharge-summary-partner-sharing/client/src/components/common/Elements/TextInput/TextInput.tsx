import React from 'react';
import { TextInput as MantineTextInput, PasswordInput, NumberInput, Textarea } from '@mantine/core';
import { TextInputProps } from './textInputTypes';

const TextInput: React.FC<TextInputProps> = ({
  type = 'text', 
  label,
  placeholder,
  value,
  onChange,
  name,
  disabled = false,
  options = [],
  size,
  className,
  radius,
  classNames,
  error
}) => {
  const handleChange = (event: React.ChangeEvent<HTMLInputElement> | React.ChangeEvent<HTMLTextAreaElement> | React.ChangeEvent<HTMLSelectElement>) => {
     if (type === 'number' && event.currentTarget instanceof HTMLInputElement) {
      onChange(Number(event.currentTarget.value));
    } else if (event.currentTarget instanceof HTMLInputElement || event.currentTarget instanceof HTMLTextAreaElement || event.currentTarget instanceof HTMLSelectElement) {
      onChange(event.currentTarget.value);
    }
  }

  const commonStyles = {
    input: { marginTop: '0.5rem' },
  };

  switch (type) {
    case 'password':
      return (
        <PasswordInput
          label={label}
          placeholder={placeholder}
          value={value as string}
          onChange={handleChange}
          name={name}
          disabled={disabled}
          styles={commonStyles}
          error={error}
        />
      );
    case 'number':
      return (
        <NumberInput
          label={label}
          placeholder={placeholder}
          value={value as number}
          onChange={(val) => onChange(val as number)}
          name={name}
          disabled={disabled}
          styles={commonStyles}
          error={error}
        />
      );
    case 'email':
      return (
        <MantineTextInput
          type="email"
          label={label}
          placeholder={placeholder}
          value={value as string}
          onChange={handleChange}
          name={name}
          disabled={disabled}
          styles={commonStyles}
          error={error}
        />
      );
    case 'textarea':
      return (
        <Textarea
          label={label}
          placeholder={placeholder}
          value={value as string}
          onChange={handleChange}
          name={name}
          disabled={disabled}
          styles={commonStyles}
          error={error}
        />
      );
      case 'tel': 
      return (
        <MantineTextInput
          type="tel"
          label={label}
          placeholder={placeholder}
          value={value as string}
          onChange={handleChange}
          name={name}
          size = {size}
          styles={commonStyles}
          className={className}
          radius={radius}
          disabled={disabled}
          classNames={classNames}
          error={error}
        />
      );
    default:
      return (
        <MantineTextInput
          type="text"
          label={label}
          placeholder={placeholder}
          value={value as string}
          name={name}
          size = {size}
          styles={commonStyles}
          className={className}
          radius={radius}
          disabled={disabled}
          classNames={classNames}
          onChange={(e) => onChange(e.target.value)}
          error={error}
        />
      );
  }
};

export default TextInput;
