import React from "react";
import { Button, ButtonProps as MantineButtonProps } from "@mantine/core";

interface CommonButtonProps extends MantineButtonProps {
  label: string;
  onClick: () => void;
  type?: "submit" | "reset" | "button";
  textColor?: string;
}

const CommonButton: React.FC<CommonButtonProps> = ({
  label,
  color = "#2563eb",
  variant = "filled",
  type = "button",
  textColor = "#fff",
  onClick,
  ...rest
}) => {
  return (
    <Button
      color={color}
      variant={variant}
      type={type}
      onClick={onClick}
      {...rest}
      styles={{
        root: {
          color: textColor, 
        },
      }}
    >
      {label}
    </Button>
  );
};

export default CommonButton;
