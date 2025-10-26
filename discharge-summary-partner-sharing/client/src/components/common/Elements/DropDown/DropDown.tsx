import React from "react";
import { DropDownProps } from "./dropDownTypes";
import { NativeSelect } from '@mantine/core';

const DropDown: React.FC<DropDownProps> = ({ label, value, onChange, name, options, error }) => {
  
  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    onChange(event.currentTarget.value);
  };

  const commonStyles = {
    input: { marginTop: '0.5rem' },
  };

  return (
    <NativeSelect
      label={label}
      value={value || ''}
      onChange={handleChange}
      name={name}
      error={error}
      data={[
        ...options.map(option => ({ value: option.value, label: option.label }))
      ]}
      styles={commonStyles}
    />
  )

};

export default DropDown;