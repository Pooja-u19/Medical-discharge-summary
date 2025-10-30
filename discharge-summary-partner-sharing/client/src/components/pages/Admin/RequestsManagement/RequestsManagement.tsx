import React, { useRef, useState } from "react";
import RequestsList from "./RequestsList/RequestsList";
import ReusableDrawer from "../../../common/ReusableDrawer/ReusableDrawer";
import AddRequest from "./AddRequest/AddRequest";
import CommonButton from "../../../common/Elements/Button/Button";
import { useDisclosure } from "@mantine/hooks";
import { Modal, Image } from "@mantine/core";
import { IconX } from "@tabler/icons-react";
import { IDocument } from "./RequestsList/requestsListTypes";
import pipelineDiagram from "../../../../assets/pipeline.jpg";
import architectureDiagram from "../../../../assets/architecture.png";

const RequestsManagement: React.FC = () => {
  const [opened, { open, close }] = useDisclosure(false);
  const [diagramOpened, { open: openDiagram, close: closeDiagram }] =
    useDisclosure(false);
  const [
    architectureDiagramOpened,
    { open: openArchitectureDiagram, close: closeArchitectureDiagram },
  ] = useDisclosure(false);
  const requestsListRef = useRef<{ refresh: () => void } | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<{
    documents: IDocument[];
  } | null>(null);

  const handleClose = () => {
    close();
    setSelectedRequest(null);
    // Always refresh the list when drawer closes to show updated status
    setTimeout(() => {
      requestsListRef.current?.refresh();
    }, 500); // Small delay to ensure drawer is closed
  };

  const handleShowMore = (request: { documents: IDocument[] }) => {
    setSelectedRequest(request);
    open();
  };

  return (
    <div className="relative flex flex-col bg-cream-600">
      <div className="w-full p-2">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-xl font-bold text-gray-800">
            Discharge Summary
          </h1>
          <div className="flex gap-2">
            <CommonButton label="Analyze Documents" onClick={open} />
            <CommonButton 
              label="Refresh" 
              onClick={() => requestsListRef.current?.refresh()} 
            />
            {/* <CommonButton label="Show Pipeline" onClick={openDiagram} />
            <CommonButton
              label="Show Architecture"
              onClick={openArchitectureDiagram}
            /> */}
          </div>
          <ReusableDrawer
            opened={opened}
            onClose={handleClose}
            title={"Analyze Documents"}
            closeButtonProps={{
              icon: <IconX size={25} stroke={2} />,
            }}
          >
            <AddRequest request={selectedRequest} close={handleClose} />
          </ReusableDrawer>
          <Modal
            opened={diagramOpened}
            onClose={closeDiagram}
            title="Pipeline Diagram"
            centered
            size="auto"
            styles={{
              body: {
                height: "auto",
                maxHeight: "100vh",
                width: "auto",
                maxWidth: "100vw",
              },
            }}
          >
            <div className="max-h-[85vh] max-w-[85vw] overflow-auto flex justify-center items-center">
              <Image
                src={pipelineDiagram}
                alt="Pipeline Diagram"
                className="max-h-full max-w-full object-contain"
              />
            </div>
          </Modal>
          <Modal
            opened={architectureDiagramOpened}
            onClose={closeArchitectureDiagram}
            title="Architecture Diagram"
            centered
            size="auto"
            styles={{
              body: {
                height: "auto",
                maxHeight: "100vh",
                width: "auto",
                maxWidth: "100vw",
              },
            }}
          >
            <div className="max-h-[85vh] max-w-[85vw] overflow-auto flex justify-center items-center">
              <Image
                src={architectureDiagram}
                alt="Pipeline Diagram"
                className="max-h-full max-w-full object-contain"
              />
            </div>
          </Modal>
        </div>
        <div className="border border-gray-300 rounded-lg overflow-hidden">
          <RequestsList ref={requestsListRef} handleShowMore={handleShowMore} />
        </div>
      </div>
    </div>
  );
};

export default RequestsManagement;
