import React, { useEffect, useState } from "react";
import "./AddRequest.scss";
import CommonButton from "../../../../common/Elements/Button/Button";
import { useLoader, useLogger, useToast } from "../../../../../hooks";
import { LogLevel, ToastType } from "../../../../../enums";
import { useForm, yupResolver } from "@mantine/form";
import addRequestValidations from "./addRequestValidations";
import ImageUploader from "../../../../common/ImageUploader/ImageUploader";
import { useDisclosure } from "@mantine/hooks";
import ReusableDrawer from "../../../../common/ReusableDrawer/ReusableDrawer";
import {
  IconAlertCircle,
  IconCheck,
  IconDownload,
  IconFileText,
  IconX,
} from "@tabler/icons-react";
import addRequestService from "./addRequestService";
import {
  openDatabase,
  createObjectStore,
  addData,
} from "../../../../../utils/indexDBUtils";
import { environment } from "../../../../../config/environment";
import { IDocument } from "../RequestsList/requestsListTypes";
import { documentStatus } from "../RequestsList/requestsListEnum";

const AddRequest: React.FC<{
  close: () => void;
  request: {
    documents: IDocument[];
  } | null;
}> = ({ close, request }) => {
  const { log } = useLogger();
  const { showToast } = useToast();
  const [patientDoctorImage, setPatientDoctorImage] = useState<File | null>(
    null
  );
  const [xRayImage, setXRayImage] = useState<File | null>(null);
  const [otherDocument, setOtherDocument] = useState<File | null>(null);
  const [currentImage, setCurrentImage] = useState<File | null>(null);
  const [imageType, setImageType] = useState<string>("");
  const [opened, { open: openImageUploader, close: closeImageUploader }] =
    useDisclosure(false);
  const { showLoader, hideLoader } = useLoader();
  const form = useForm({
    initialValues: {
      requestName: "",
    },
  });
  const [showJson, setShowJson] = useState(false);

  const handleChange = (name: string, value: string | number | boolean) => {
    form.setValues({
      ...form.values,
      [name]: value,
    });
  };

  const handleFileUpload = (
    event: React.ChangeEvent<HTMLInputElement>,
    type: string
  ) => {
    const uploadedFile = event.target.files?.[0];
    if (uploadedFile) {
      const isImage = uploadedFile.type.startsWith("image/");
      if (isImage) {
        setImageType(type);
        setCurrentImage(uploadedFile);
        openImageUploader();
      } else if (uploadedFile.size <= 5 * 1024 * 1024) {
        setOtherDocument(uploadedFile);
      } else {
        showToast(
          ToastType.ERROR,
          `${uploadedFile.name} exceeds the maximum file size of 5MB`
        );
      }
    }
  };

  const handleSubmit = async (values: { requestName: string }) => {
    if (!patientDoctorImage && !otherDocument) {
      showToast(ToastType.ERROR, "Please upload at least one document");
      return;
    }

    try {
      const filesToUpload = [];
      if (patientDoctorImage)
        filesToUpload.push({
          contentType: patientDoctorImage.type,
          size: patientDoctorImage.size,
          documentType: "patient_doctor_image",
        });
      if (xRayImage)
        filesToUpload.push({
          contentType: xRayImage.type,
          size: xRayImage.size,
          documentType: "xray",
        });
      if (otherDocument)
        filesToUpload.push({
          contentType: otherDocument.type,
          size: otherDocument.size,
          documentType: "other_documents",
        });

      const response = await addRequestService.addRequest({
        files: filesToUpload,
      });

      if (response.data.data) {
        if (
          response.data.data.presignedUrls &&
          response.data.data.presignedUrls.length > 0
        ) {
          showLoader();
          try {
            for (const document of response.data.data.presignedUrls) {
              log(LogLevel.DEBUG, "AddRequest :: Processing document", {
                documentType: document.documentType,
                presignedUrl: document.presignedUrl
              });
              
              if (document.documentType) {
                if (
                  document.documentType === "patient_doctor_image" &&
                  patientDoctorImage
                ) {
                  log(LogLevel.DEBUG, "AddRequest :: Uploading patient_doctor_image", {
                    fileName: patientDoctorImage.name,
                    fileType: patientDoctorImage.type,
                    fileSize: patientDoctorImage.size
                  });
                  await uploadFileToPresignedUrl(
                    patientDoctorImage,
                    document.presignedUrl
                  );
                } else if (document.documentType === "xray" && xRayImage) {
                  log(LogLevel.DEBUG, "AddRequest :: Uploading xray", {
                    fileName: xRayImage.name,
                    fileType: xRayImage.type,
                    fileSize: xRayImage.size
                  });
                  await uploadFileToPresignedUrl(
                    xRayImage,
                    document.presignedUrl
                  );
                } else if (
                  document.documentType === "other_documents" &&
                  otherDocument
                ) {
                  log(LogLevel.DEBUG, "AddRequest :: Uploading other_documents", {
                    fileName: otherDocument.name,
                    fileType: otherDocument.type,
                    fileSize: otherDocument.size
                  });
                  await uploadFileToPresignedUrl(
                    otherDocument,
                    document.presignedUrl
                  );
                }
              }
            }
          } catch (uploadError) {
            hideLoader();
            showToast(ToastType.ERROR, "File upload failed. Please try again.");
            log(LogLevel.ERROR, "AddRequest :: File upload error", uploadError);
            return;
          }

          hideLoader();
        }

        const db = await openDatabase(environment.indexedDBName, 1, (db) => {
          createObjectStore(db, environment.indexedDBStoreName, "requestId", [
            { name: "requestId", keyPath: "requestId" },
          ]);
        });

        await addData(db, environment.indexedDBStoreName, {
          requestId: response.data.data.requestId,
          requestName: values.requestName,
        });

        showToast(ToastType.SUCCESS, "Request submitted successfully!");
        setTimeout(() => close(), 2000);
      }
    } catch (error) {
      log(LogLevel.ERROR, "AddRequest :: handleSubmit", error);
    }
  };

  const uploadFileToPresignedUrl = async (file: File, presignedUrl: string) => {
    try {
      const response = await fetch(presignedUrl, {
        method: "PUT",
        headers: {
          "Content-Type": file.type,
        },
        body: file,
      });

      if (response.ok) {
        log(
          LogLevel.DEBUG,
          "AddRequest :: File uploaded successfully",
          response
        );
      } else {
        log(LogLevel.ERROR, "AddRequest :: File upload failed", response);
        const errorText = await response.text();
        log(LogLevel.ERROR, "AddRequest :: Error response", errorText);
        throw new Error(`Upload failed with status: ${response.status}`);
      }
    } catch (error) {
      log(LogLevel.ERROR, "AddRequest :: Error uploading file", error);
      throw error;
    }
  };

  useEffect(() => {
    if (imageType && currentImage) {
      if (imageType === "patient_doctor_image") {
        setPatientDoctorImage(currentImage);
      } else if (imageType === "xray") {
        setXRayImage(currentImage);
      }
    }
  }, [imageType, currentImage]);

  return (
    <div className="add-request">
      {!request && (
        <>
          {/* <div className="mb-4">
            <label htmlFor="patientDoctorImage" className="font-semibold">
              Patient Doctor Image
            </label>
            <input
              id="patientDoctorImage"
              type="file"
              accept=".jpg,.jpeg,.png"
              onChange={(e) => handleFileUpload(e, "patient_doctor_image")}
            />
            {patientDoctorImage && (
              <div>
                <span>{patientDoctorImage.name}</span>
              </div>
            )}
          </div> */}

          <div className="mb-4">
            <label htmlFor="otherDocument" className="font-semibold">
              Document
            </label>
            <input
              id="otherDocument"
              type="file"
              accept=".pdf"
              onChange={(e) => handleFileUpload(e, "other_documents")}
            />
            {otherDocument && (
              <div>
                <span>{otherDocument.name}</span>
              </div>
            )}
          </div>

          {/* <div className="mb-4">
            <label htmlFor="xRayImage" className="font-semibold">
              X-Ray Image
            </label>
            <input
              id="xRayImage"
              type="file"
              accept=".jpg,.jpeg,.png"
              onChange={(e) => handleFileUpload(e, "xray")}
            />
            {xRayImage && (
              <div>
                <span>{xRayImage.name}</span>
              </div>
            )}
          </div> */}
        </>
      )}
      {request && (
        <div className="document-list mt-4">
          {request.documents.map((doc) => {
            const getDocumentStyle = (status: number) => {
              switch (status) {
                case documentStatus.LEGITIMATE:
                  return "bg-green-200";
                case documentStatus.SUSPICIOUS:
                  return "bg-red-200 hover:bg-red-300";
                case documentStatus.PENDING:
                  return "bg-yellow-200";
                default:
                  return "";
              }
            };

            const getDocumentStatusLabel = (status: number) => {
              switch (status) {
                case documentStatus.LEGITIMATE:
                  return "Legitimate Document";
                case documentStatus.SUSPICIOUS:
                  return "Suspicious Document";
                case documentStatus.ERROR:
                  return "Error while processing Document";
                default:
                  return "Under Investigation";
              }
            };

            const getDocumentStatusColor = (status: number) => {
              switch (status) {
                case documentStatus.LEGITIMATE:
                  return "text-green-500";
                case documentStatus.SUSPICIOUS:
                  return "text-red-500";
                case documentStatus.ERROR:
                  return "text-red-500";
                case documentStatus.PENDING:
                default:
                  return "text-yellow-500";
              }
            };

            return (
              <div
                key={doc.documentId}
                className={`flex items-center justify-between p-4 mb-2 border-l-4 ${getDocumentStyle(
                  doc.documentStatus
                )} rounded-md shadow-lg transition-all ease-in-out duration-300`}
              >
                <div className="flex items-center space-x-3">
                  {doc.documentStatus === documentStatus.SUSPICIOUS ? (
                    <IconAlertCircle size={20} className="text-red-500" />
                  ) : doc.documentStatus === documentStatus.LEGITIMATE ? (
                    <IconCheck size={20} className="text-green-500" />
                  ) : (
                    <IconFileText size={20} className="text-yellow-500" />
                  )}
                  <div className="flex flex-col items-start">
                    <span
                      className={`text-sm font-semibold ${getDocumentStatusColor(
                        doc.documentStatus
                      )}`}
                    >
                      {doc.documentType === "other_documents"
                        ? "CLAIM DOCUMENT"
                        : doc.documentType
                            .replace(/_/g, " ")
                            .toUpperCase()}{" "}
                      -{" "}
                      <span className="ml-1">
                        {getDocumentStatusLabel(doc.documentStatus)}
                      </span>
                    </span>

                    <div className="mt-2 flex flex-col space-y-2">
                      {(doc.documentStatus === documentStatus.SUSPICIOUS ||
                        doc.documentStatus === documentStatus.ERROR) && (
                        <div className="flex flex-col items-start space-y-1">
                          {doc.matchedDocumentS3Path && (
                            <a
                              href={doc.matchedDocumentS3Path}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline flex items-center space-x-2"
                            >
                              <IconDownload size={16} />
                              <span>Download Matched Document</span>
                            </a>
                          )}
                          <a
                            href={doc.documentS3Path}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline flex items-center space-x-2"
                          >
                            <IconDownload size={16} />
                            <span>Download This Document</span>
                          </a>
                        </div>
                      )}

                      <div className="mt-2 flex flex-col space-y-2">
                        <button
                          onClick={() => setShowJson(!showJson)}
                          className="text-blue-600 hover:underline flex items-center space-x-2"
                        >
                          <IconFileText size={16} />
                          <span>
                            {showJson
                              ? "Hide JSON Response"
                              : "Show JSON Response"}
                          </span>
                        </button>
                      </div>

                      {showJson && (
                        <div className="mt-4 p-4 border-l-4 shadow-md rounded-lg bg-yellow-100 border-yellow-500">
                          <div className="mt-2 text-gray-700">
                            <pre className="text-sm text-gray-700">
                              {JSON.stringify(doc, null, 2)}
                            </pre>
                          </div>
                        </div>
                      )}
                    </div>

                    {[documentStatus.SUSPICIOUS, documentStatus.ERROR].includes(
                      doc.documentStatus
                    ) && (
                      <div className="mt-4 p-4 border-l-4 shadow-md rounded-lg bg-red-100 border-red-500">
                        <div className="flex items-center space-x-2 text-red-600 text-lg font-semibold">
                          <IconAlertCircle size={20} />
                          <span>Error Detected</span>
                        </div>
                        <p className="mt-2 text-red-700 text-md">
                          {doc.errorMessage}
                        </p>
                      </div>
                    )}

                    {documentStatus.SUSPICIOUS === doc.documentStatus &&
                      doc.analysisSummary &&
                      doc.fraudProbability !== undefined && (
                        <div className="mt-4 p-4 border-l-4 shadow-md rounded-lg bg-yellow-100 border-yellow-500">
                          <div className="flex items-center space-x-2 text-yellow-600 text-lg font-semibold">
                            <IconAlertCircle size={20} />
                            <span>Morph Analysis</span>
                          </div>
                          <div className="mt-2 text-gray-700">
                            <p className="text-md font-medium">
                              <span className="font-bold">
                                Suspicious Probability:
                              </span>{" "}
                              {doc.fraudProbability}%
                            </p>
                            <p className="mt-1 text-md">
                              <span className="font-bold">
                                Analysis Summary:
                              </span>{" "}
                              {doc.analysisSummary}
                            </p>
                          </div>
                        </div>
                      )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="fixed bottom-4 left-0 w-full p-4 bg-white">
        <CommonButton
          label={"Analyze Document"}
          onClick={form.onSubmit((values) => handleSubmit(values))}
          fullWidth
        />
      </div>

      <ReusableDrawer
        opened={opened}
        onClose={closeImageUploader}
        title={"Upload Image"}
        closeButtonProps={{
          icon: <IconX size={25} stroke={2} />,
        }}
      >
        <ImageUploader
          setFile={setCurrentImage}
          file={currentImage}
          allowedTypes={["image/jpeg", "image/png", "image/tiff"]}
          close={closeImageUploader}
          maxSize={5}
          cropWidth={300}
          cropHeight={300}
        />
      </ReusableDrawer>
    </div>
  );
};

export default AddRequest;
