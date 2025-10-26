import React from "react";
import { CheckBoxProps } from "./checkBoxTypes";
import { Checkbox } from "@mantine/core";

const CheckBox: React.FC<CheckBoxProps> = ({ label, checked, onChange, name }) => {

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onChange(event.currentTarget.checked);
  };
  
  return (
    <Checkbox
      label={label}
      checked={checked}
      onChange={handleChange}
      name={name}
    />
  )

};

export default CheckBox;