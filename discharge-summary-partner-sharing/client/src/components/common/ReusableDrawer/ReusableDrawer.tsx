import React from "react";
import { Drawer } from "@mantine/core";
import { ReusableDrawerProps } from "./ReusableDrawerTypes";

const ReusableDrawer: React.FC<ReusableDrawerProps> = ({
  opened,
  onClose,
  title,
  children,
  position = "right",
  closeButtonProps,
}) => {
  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position={position}
      title={title}
      closeButtonProps={closeButtonProps}
    >
      {children}
    </Drawer>
  );
};

export default ReusableDrawer;
