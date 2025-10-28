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
import { Dropzone, FileWithPath } from "@mantine/dropzone";
import {
  IconAlertCircle,
  IconCheck,
  IconDownload,
  IconFileText,
  IconX,
  IconUpload,
  IconTrash,
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
  const [selectedFiles, setSelectedFiles] = useState<FileWithPath[]>([]);
  const [fileStatuses, setFileStatuses] = useState<{[key: string]: 'pending' | 'uploading' | 'processing' | 'completed' | 'error'}>({});
  const [uploadProgress, setUploadProgress] = useState<{[key: string]: number}>({});
  const [requestId, setRequestId] = useState<string | null>(null);
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);
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

  // Cleanup polling interval on unmount
  useEffect(() => {
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [pollingInterval]);

  const handleChange = (name: string, value: string | number | boolean) => {
    form.setValues({
      ...form.values,
      [name]: value,
    });
  };

  const handleFileDrop = (files: FileWithPath[]) => {
    log(LogLevel.INFO, `Dropzone received ${files.length} files`, files.map(f => ({ name: f.name, type: f.type, size: f.size })));
    
    const validFiles: FileWithPath[] = [];
    const maxFileSize = 10 * 1024 * 1024; // 10MB
    
    files.forEach(file => {
      log(LogLevel.INFO, `Processing file: ${file.name}, type: ${file.type}, size: ${file.size}`);
      
      if (file.size > maxFileSize) {
        showToast(
          ToastType.ERROR,
          `${file.name} exceeds the maximum file size of 10MB`
        );
      } else {
        validFiles.push(file);
        log(LogLevel.INFO, `File ${file.name} added to valid files`);
      }
    });
    
    log(LogLevel.INFO, `Adding ${validFiles.length} valid files to selection`);
    setSelectedFiles(prev => {
      const newFiles = [...prev, ...validFiles];
      log(LogLevel.INFO, `Total selected files after addition: ${newFiles.length}`);
      return newFiles;
    });
    
    // Initialize file statuses
    const newStatuses: {[key: string]: 'pending'} = {};
    validFiles.forEach(file => {
      newStatuses[file.name] = 'pending';
    });
    setFileStatuses(prev => ({ ...prev, ...newStatuses }));
  };

  const removeFile = (index: number) => {
    const fileToRemove = selectedFiles[index];
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    
    // Clean up file status
    if (fileToRemove) {
      setFileStatuses(prev => {
        const newStatuses = { ...prev };
        delete newStatuses[fileToRemove.name];
        return newStatuses;
      });
      setUploadProgress(prev => {
        const newProgress = { ...prev };
        delete newProgress[fileToRemove.name];
        return newProgress;
      });
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const startStatusPolling = async (requestId: string) => {
    log(LogLevel.INFO, `Starting status polling for request: ${requestId}`);
    
    const pollStatus = async () => {
      try {
        const response = await addRequestService.getRequestStatus(requestId);
        
        if (response.data?.data?.documents && response.data.data.documents.length > 0) {
          const documents = response.data.data.documents;
          const newStatuses: {[key: string]: 'pending' | 'uploading' | 'processing' | 'completed' | 'error'} = {};
          let allCompleted = true;
          
          documents.forEach((doc: any) => {
            const fileName = doc.fileName || `document-${doc.documentId}`;
            
            switch (doc.documentStatus) {
              case 0: // PENDING
                newStatuses[fileName] = 'processing';
                allCompleted = false;
                break;
              case 1: // LEGITIMATE
                newStatuses[fileName] = 'completed';
                break;
              case 2: // SUSPICIOUS
                newStatuses[fileName] = 'completed';
                break;
              case 3: // ERROR
                newStatuses[fileName] = 'error';
                break;
              default:
                newStatuses[fileName] = 'processing';
                allCompleted = false;
            }
          });
          
          setFileStatuses(prev => ({ ...prev, ...newStatuses }));
          
          if (allCompleted && Object.keys(newStatuses).length > 0) {
            log(LogLevel.INFO, 'All documents processed, stopping polling');
            if (pollingInterval) {
              clearInterval(pollingInterval);
              setPollingInterval(null);
            }
            
            const completedCount = Object.values(newStatuses).filter(status => status === 'completed').length;
            const errorCount = Object.values(newStatuses).filter(status => status === 'error').length;
            
            if (errorCount > 0) {
              showToast(ToastType.WARNING, `${completedCount} documents processed successfully, ${errorCount} failed`);
            } else {
              showToast(ToastType.SUCCESS, `All ${completedCount} documents processed successfully!`);
            }
          }
        } else {
          log(LogLevel.INFO, 'No documents found in response, continuing polling');
        }
      } catch (error) {
        log(LogLevel.ERROR, 'Status polling error:', error);
      }
    };
    
    // Poll immediately, then every 10 seconds
    await pollStatus();
    const interval = setInterval(pollStatus, 10000);
    setPollingInterval(interval);
  };

  const handleSubmit = async (values: { requestName: string }) => {
    if (selectedFiles.length === 0) {
      showToast(ToastType.ERROR, "Please upload at least one document");
      return;
    }

    // Log API configuration for debugging
    log(LogLevel.INFO, "API Configuration:", {
      baseUrl: environment.apiBaseUrl,
      hasApiKey: !!environment.apiKey
    });

    try {
      showLoader();
      
      // Prepare files for upload request
      const filesToUpload = selectedFiles.map(file => ({
        contentType: file.type,
        size: file.size,
        documentType: "other_documents", // You can modify this logic to categorize files
        fileName: file.name
      }));

      log(LogLevel.INFO, `AddRequest :: Preparing to upload ${filesToUpload.length} files`, filesToUpload);

      const response = await addRequestService.addRequest({
        files: filesToUpload,
      });

      if (response && response.data && response.data.data) {
        if (
          response.data.data.presignedUrls &&
          response.data.data.presignedUrls.length > 0
        ) {
          try {
            // Upload each file to its corresponding presigned URL
            for (let i = 0; i < response.data.data.presignedUrls.length; i++) {
              const document = response.data.data.presignedUrls[i];
              const file = selectedFiles[i];
              
              if (file && document.presignedUrl) {
                log(LogLevel.DEBUG, "AddRequest :: Uploading file", {
                  fileName: file.name,
                  fileType: file.type,
                  fileSize: file.size,
                  documentType: document.documentType
                });
                
                await uploadFileToPresignedUrl(file, document.presignedUrl);
              }
            }
          } catch (uploadError) {
            hideLoader();
            showToast(ToastType.ERROR, "File upload failed. Please try again.");
            log(LogLevel.ERROR, "AddRequest :: File upload error", uploadError);
            return;
          }
        }

        // Save to IndexedDB
        const db = await openDatabase(environment.indexedDBName, 1, (db) => {
          createObjectStore(db, environment.indexedDBStoreName, "requestId", [
            { name: "requestId", keyPath: "requestId" },
          ]);
        });

        await addData(db, environment.indexedDBStoreName, {
          requestId: response.data.data.requestId,
          requestName: values.requestName || `Upload-${new Date().toISOString()}`,
        });

        // Store request ID and start polling
        setRequestId(response.data.data.requestId);
        hideLoader();
        showToast(ToastType.SUCCESS, `Successfully uploaded ${selectedFiles.length} document(s)! Processing started...`);
        
        // Start polling for status updates
        await startStatusPolling(response.data.data.requestId);
      }
    } catch (error: any) {
      hideLoader();
      const errorMessage = error?.response?.data?.message || error?.message || "Upload failed. Please try again.";
      showToast(ToastType.ERROR, errorMessage);
      log(LogLevel.ERROR, "AddRequest :: handleSubmit", {
        error: error?.message,
        status: error?.response?.status,
        data: error?.response?.data,
        config: {
          url: error?.config?.url,
          method: error?.config?.method,
          headers: error?.config?.headers ? {
            'x-api-key': error?.config?.headers['x-api-key'] ? 'PRESENT' : 'MISSING',
            'Content-Type': error?.config?.headers['Content-Type']
          } : 'NO_HEADERS'
        }
      });
    }
  };

  const uploadFileToPresignedUrl = async (file: File, presignedUrl: string) => {
    try {
      // Update status to uploading
      setFileStatuses(prev => ({ ...prev, [file.name]: 'uploading' }));
      setUploadProgress(prev => ({ ...prev, [file.name]: 0 }));
      
      const response = await fetch(presignedUrl, {
        method: "PUT",
        headers: {
          "Content-Type": file.type,
        },
        body: file,
      });

      if (response.ok) {
        // Update progress to 100% and status to processing
        setUploadProgress(prev => ({ ...prev, [file.name]: 100 }));
        setFileStatuses(prev => ({ ...prev, [file.name]: 'processing' }));
        
        log(
          LogLevel.DEBUG,
          "AddRequest :: File uploaded successfully",
          response
        );
      } else {
        setFileStatuses(prev => ({ ...prev, [file.name]: 'error' }));
        log(LogLevel.ERROR, "AddRequest :: File upload failed", response);
        const errorText = await response.text();
        log(LogLevel.ERROR, "AddRequest :: Error response", errorText);
        throw new Error(`Upload failed with status: ${response.status}`);
      }
    } catch (error) {
      setFileStatuses(prev => ({ ...prev, [file.name]: 'error' }));
      log(LogLevel.ERROR, "AddRequest :: Error uploading file", error);
      throw error;
    }
  };



  return (
    <div className="add-request">
      {!request && (
        <>
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              Upload Documents (Multiple files supported)
            </label>
            
            <Dropzone
              onDrop={handleFileDrop}
              onReject={(files) => {
                log(LogLevel.ERROR, "Files rejected by Dropzone", files);
                files.forEach(file => {
                  showToast(ToastType.ERROR, `${file.file.name}: ${file.errors.map(e => e.message).join(', ')}`);
                });
              }}
              accept={{
                'application/pdf': ['.pdf'],
                'image/jpeg': ['.jpg', '.jpeg'],
                'image/png': ['.png'],
                'image/tiff': ['.tiff', '.tif'],
                'text/plain': ['.txt'],
                'application/msword': ['.doc'],
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
              }}
              maxSize={10 * 1024 * 1024} // 10MB
              multiple={true}
              maxFiles={20} // Allow up to 20 files
            >
              <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                <IconUpload size={48} className="text-gray-400 mb-4" />
                <div className="text-lg font-medium text-gray-700 mb-2">
                  Drop files here or click to browse
                </div>
                <div className="text-sm text-gray-500 mb-2">
                  Supports PDF, Images (JPG, PNG, TIFF), Word documents, and Text files
                </div>
                <div className="text-xs text-gray-400">
                  Maximum file size: 10MB per file
                </div>
              </div>
            </Dropzone>

            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Or use traditional file picker (supports multiple selection):
              </label>
              <input
                type="file"
                multiple
                accept=".pdf,.jpg,.jpeg,.png,.tiff,.tif,.txt,.doc,.docx"
                onChange={(e) => {
                  const files = Array.from(e.target.files || []) as FileWithPath[];
                  if (files.length > 0) {
                    handleFileDrop(files);
                  }
                }}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
            </div>

            {selectedFiles.length > 0 && (
              <div className="mt-4">
                <div className="text-sm font-semibold text-gray-700 mb-2">
                  Selected Files ({selectedFiles.length}):
                </div>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {selectedFiles.map((file, index) => {
                    const status = fileStatuses[file.name] || 'pending';
                    const progress = uploadProgress[file.name] || 0;
                    
                    const getStatusIcon = () => {
                      switch (status) {
                        case 'uploading':
                          return <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>;
                        case 'processing':
                          return <div className="animate-pulse rounded-full h-4 w-4 bg-yellow-500"></div>;
                        case 'completed':
                          return <IconCheck size={16} className="text-green-500" />;
                        case 'error':
                          return <IconX size={16} className="text-red-500" />;
                        default:
                          return <IconFileText size={16} className="text-blue-500" />;
                      }
                    };
                    
                    const getStatusText = () => {
                      switch (status) {
                        case 'uploading': return 'Uploading...';
                        case 'processing': return 'Processing...';
                        case 'completed': return 'Completed';
                        case 'error': return 'Error';
                        default: return 'Ready';
                      }
                    };
                    
                    const getStatusColor = () => {
                      switch (status) {
                        case 'uploading': return 'text-blue-600';
                        case 'processing': return 'text-yellow-600';
                        case 'completed': return 'text-green-600';
                        case 'error': return 'text-red-600';
                        default: return 'text-gray-600';
                      }
                    };
                    
                    return (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border"
                      >
                        <div className="flex items-center space-x-3 flex-1">
                          {getStatusIcon()}
                          <div className="flex-1">
                            <div className="text-sm font-medium text-gray-900">
                              {file.name}
                            </div>
                            <div className="text-xs text-gray-500">
                              {formatFileSize(file.size)} • {file.type || 'Unknown type'}
                            </div>
                            <div className={`text-xs ${getStatusColor()}`}>
                              {getStatusText()}
                            </div>
                            {status === 'uploading' && (
                              <div className="w-full bg-gray-200 rounded-full h-1 mt-1">
                                <div 
                                  className="bg-blue-600 h-1 rounded-full transition-all duration-300" 
                                  style={{ width: `${progress}%` }}
                                ></div>
                              </div>
                            )}
                          </div>
                        </div>
                        {status === 'pending' && (
                          <button
                            onClick={() => removeFile(index)}
                            className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
                            title="Remove file"
                          >
                            <IconTrash size={16} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
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
          label={
            !request 
              ? (() => {
                  const processingCount = Object.values(fileStatuses).filter(status => 
                    status === 'uploading' || status === 'processing'
                  ).length;
                  const completedCount = Object.values(fileStatuses).filter(status => 
                    status === 'completed'
                  ).length;
                  
                  if (processingCount > 0) {
                    return `Processing ${processingCount} Document${processingCount > 1 ? 's' : ''}...`;
                  } else if (completedCount > 0) {
                    return `${completedCount} Document${completedCount > 1 ? 's' : ''} Completed`;
                  } else if (selectedFiles.length > 0) {
                    return `Analyze ${selectedFiles.length} Document${selectedFiles.length > 1 ? 's' : ''}`;
                  } else {
                    return "Analyze Documents";
                  }
                })()
              : "View Analysis Results"
          }
          onClick={form.onSubmit((values) => handleSubmit(values))}
          fullWidth
          disabled={!request && (selectedFiles.length === 0 || Object.values(fileStatuses).some(status => status === 'uploading'))}
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
