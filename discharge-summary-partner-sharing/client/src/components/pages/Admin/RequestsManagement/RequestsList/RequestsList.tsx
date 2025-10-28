import { useEffect, useImperativeHandle, useState, forwardRef, useCallback, useRef } from "react";
import { Table, Flex, Tooltip } from "@mantine/core";
import { RequestsListProps, IRequest, IDocument } from "./requestsListTypes";
import { useLogger } from "../../../../../hooks";
import iconOpen from "../../../../../assets/iconOpen.svg";
import {
  getData,
  openDatabase,
  createObjectStore,
} from "../../../../../utils/indexDBUtils";
import { environment } from "../../../../../config/environment";
import { LogLevel } from "../../../../../enums";
import requestsListService from "./requestsListService";
import { resolutionStatus } from "./requestsListEnum";
import { useNavigate } from "react-router-dom";

const RequestsList = forwardRef<{ refresh: () => void }, RequestsListProps>(
  ({ handleShowMore }, ref) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [requests, setRequests] = useState<IRequest[]>([]);
    const [isAutoRefreshing, setIsAutoRefreshing] = useState<boolean>(false);
    const pageSize = 50;
    const { log } = useLogger();
    const navigate = useNavigate();
    const autoRefreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const AUTO_REFRESH_INTERVAL = 10000; // 10 seconds

    const determineResolutionStatus = useCallback((documents: any[]) => {
      const statuses = documents.map((doc) => doc.documentStatus);
      if (statuses.includes(resolutionStatus.SUSPICIOUS))
        return resolutionStatus.SUSPICIOUS;
      if (statuses.every((status) => status === resolutionStatus.LEGITIMATE))
        return resolutionStatus.LEGITIMATE;
      if (statuses.includes(resolutionStatus.ERROR))
        return resolutionStatus.ERROR;
      return resolutionStatus.PENDING;
    }, []);

    const checkForPendingDocuments = useCallback((requests: IRequest[]): boolean => {
      const pendingRequests = requests.filter(request => {
        const requestPending = request.resolutionStatus === resolutionStatus.PENDING;
        const docsPending = request.documents.some(doc => doc.documentStatus === 0); // PENDING status
        const actionPending = request.actions?.some(action =>
          action.label === "Processing Document" ||
          action.type === "processing" ||
          action.label.toLowerCase().includes("processing")
        );

        const isPending = requestPending || docsPending || actionPending;
        
        log(LogLevel.INFO, `RequestsList :: Request ${request.requestId} status:`, {
          resolutionStatus: request.resolutionStatus,
          requestPending,
          docsPending,
          actionPending,
          isPending,
          actions: request.actions,
          documents: request.documents.map(doc => ({
            id: doc.documentId,
            status: doc.documentStatus
          }))
        });

        return isPending;
      });

      const hasPending = pendingRequests.length > 0;
      log(LogLevel.INFO, `RequestsList :: Has pending documents: ${hasPending}, Pending count: ${pendingRequests.length}`);
      
      // Log completed requests
      const completedRequests = requests.filter(request => 
        request.resolutionStatus === resolutionStatus.LEGITIMATE
      );
      if (completedRequests.length > 0) {
        log(LogLevel.INFO, `RequestsList :: Completed requests: ${completedRequests.length}`, 
          completedRequests.map(r => r.requestId)
        );
      }
      
      return hasPending;
    }, [log]);

    const fetchRequests = useCallback(async () => {
      try {
        log(LogLevel.INFO, "RequestsList :: Fetching requests from IndexedDB");
        const db = await openDatabase(environment.indexedDBName, 1, (db) => {
          createObjectStore<IRequest>(db, environment.indexedDBStoreName, "requestId");
        });

        let result: { count: number; data: IRequest[] } = { count: 0, data: [] };
        try {
          result = await getData<IRequest>(
            db,
            environment.indexedDBStoreName,
            "requestId",
            pageSize,
            0
          ) || { count: 0, data: [] };
        } catch (dbError) {
          log(LogLevel.WARN, "RequestsList :: IndexedDB query failed, using empty result", dbError);
        }

        log(LogLevel.INFO, "RequestsList :: IndexedDB result", result);

        const updatedRequests: IRequest[] = [];

        for (const requestItem of result?.data || []) {
          try {
            log(LogLevel.INFO, `RequestsList :: Fetching API data for request ${requestItem.requestId}`);
            const requestData = await requestsListService.getRequest(
              requestItem.requestId
            );
            if (requestData.data?.data) {
              updatedRequests.push({
                ...requestItem,
                documents: requestData.data.data.documents,
                authorizationNumber:
                  requestData.data.data.request?.authorizationNumber || null,
                resolutionStatus: determineResolutionStatus(
                  requestData.data.data.documents
                ),
                actions: requestData.data.data.request?.actions || [],
              });
            } else {
              log(
                LogLevel.ERROR,
                `Failed to fetch request ${requestItem.requestId}`,
                requestData
              );
            }
          } catch (apiError) {
            log(
              LogLevel.ERROR,
              `Failed to fetch request ${requestItem.requestId}`,
              apiError
            );
          }
        }

        log(LogLevel.INFO, "RequestsList :: Final updated requests", updatedRequests);

        // Log detailed status information for debugging
        updatedRequests.forEach(request => {
          log(LogLevel.INFO, `RequestsList :: Request ${request.requestId} status:`, {
            resolutionStatus: request.resolutionStatus,
            actions: request.actions,
            documents: request.documents.map(doc => ({
              id: doc.documentId,
              status: doc.documentStatus,
              type: doc.documentType
            }))
          });
        });

        setRequests(updatedRequests);

        return updatedRequests;
      } catch (error) {
        log(LogLevel.ERROR, "RequestsList :: fetchRequests", error);
        return [];
      }
    }, [log, determineResolutionStatus]);

    // Separate effect to handle auto-refresh logic
    useEffect(() => {
      const hasPendingDocuments = checkForPendingDocuments(requests);

      if (hasPendingDocuments && !isAutoRefreshing) {
        // Start auto-refresh
        if (autoRefreshIntervalRef.current) {
          clearInterval(autoRefreshIntervalRef.current);
        }

        setIsAutoRefreshing(true);
        log(LogLevel.INFO, "RequestsList :: Starting auto-refresh for pending documents");

        autoRefreshIntervalRef.current = setInterval(async () => {
          log(LogLevel.INFO, "RequestsList :: Auto-refresh triggered");
          await fetchRequests();
        }, AUTO_REFRESH_INTERVAL);

      } else if (!hasPendingDocuments && isAutoRefreshing) {
        // Stop auto-refresh
        if (autoRefreshIntervalRef.current) {
          clearInterval(autoRefreshIntervalRef.current);
          autoRefreshIntervalRef.current = null;
        }
        setIsAutoRefreshing(false);
        log(LogLevel.INFO, "RequestsList :: Auto-refresh stopped");
      }
    }, [requests, isAutoRefreshing, checkForPendingDocuments, log, fetchRequests]);

    useImperativeHandle(ref, () => ({
      refresh: async () => {
        await fetchRequests();
      },
    }), [fetchRequests]);

    useEffect(() => {
      fetchRequests();

      // Cleanup interval on component unmount
      return () => {
        if (autoRefreshIntervalRef.current) {
          clearInterval(autoRefreshIntervalRef.current);
        }
      };
    }, [fetchRequests]);

    const openDocumentViewer = useCallback((document: IDocument | undefined) => {
      if (!document) {
        log(LogLevel.ERROR, "RequestsList :: No document provided to openDocumentViewer");
        return;
      }
      
      navigate("/document", {
        state: {
          pages: document.pages || [],
          summary: document.summary || null,
          documentS3Path: document.documentS3Path || null
        },
      });
    }, [navigate, log]);

    return (
      <div className="h-[80vh] md:max-h-[800px] overflow-auto">
        {isAutoRefreshing && (
          <div className="bg-blue-50 border-l-4 border-blue-400 p-3 mb-4">
            <div className="flex items-center">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
              <p className="text-sm text-blue-700">
                Auto-refreshing... Checking for document processing updates every 10 seconds
              </p>
            </div>
          </div>
        )}
        <Table striped highlightOnHover>
          <thead
            style={{ backgroundColor: "#DEEFFC" }}
            className="lg:sticky top-0 z-10"
          >
            <tr>
              <th className="py-3 px-2 sm:px-4 text-left text-sm">
                Document Identifier
              </th>
              <th className="py-3 px-2 sm:px-4 text-left text-sm">Action</th>
            </tr>
          </thead>
          <tbody className="text-gray-700">
            {requests.length === 0 && (
              <tr>
                <td
                  colSpan={2}
                  className="py-3 px-2 sm:px-4 text-center text-sm"
                >
                  <div className="flex flex-col items-center py-8">
                    <div className="text-gray-500 mb-2">No Documents Found</div>
                    <div className="text-xs text-gray-400 mb-4">
                      Click "Analyze Documents" to upload and analyze your documents
                    </div>
                  </div>
                </td>
              </tr>
            )}
            {requests.map((requestItem, index) => (
              <tr key={index}>
                <td className="border-b border-gray-300 py-2 px-4">{requestItem.requestId}</td>
                <td className="border-b border-gray-300 py-2 px-4">
                  {requestItem.actions && requestItem.actions.length > 0 ? (
                    <Flex align="center" className="space-x-3">
                      {/* Status Icon */}
                      {requestItem.resolutionStatus === resolutionStatus.LEGITIMATE ? (
                        <div className="flex items-center space-x-2">
                          <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          <span className="text-sm text-green-600 font-medium">
                            {requestItem.actions[0].label}
                          </span>
                        </div>
                      ) : requestItem.resolutionStatus === resolutionStatus.PENDING ? (
                        <div className="flex items-center space-x-2">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                          <span className="text-sm text-blue-600">
                            {requestItem.actions[0].label || 'Processing Document'}
                          </span>
                        </div>
                      ) : (
                        <span className={`text-sm ${
                          requestItem.actions[0].type === 'success' ? 'text-green-600' :
                          requestItem.actions[0].type === 'error' ? 'text-red-600' :
                          requestItem.actions[0].type === 'warning' ? 'text-yellow-600' :
                          'text-blue-600'
                        }`}>
                          {requestItem.actions[0].label}
                        </span>
                      )}
                      
                      {/* View Summary Button */}
                      {(requestItem.actions[0].type === 'success' || requestItem.resolutionStatus === resolutionStatus.LEGITIMATE) && (
                        <Tooltip label="View Summary" withArrow>
                          <img
                            src={iconOpen}
                            onClick={() => {
                              const document = requestItem.documents?.[0];
                              if (document) {
                                openDocumentViewer(document);
                              } else {
                                log(LogLevel.ERROR, "RequestsList :: No document found for request", requestItem.requestId);
                              }
                            }}
                            alt="View Summary"
                            className="h-5 w-5 cursor-pointer hover:opacity-75"
                          />
                        </Tooltip>
                      )}
                    </Flex>
                  ) : requestItem.resolutionStatus === resolutionStatus.PENDING ? (
                    <Flex align="center" className="space-x-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                      <span className="text-sm text-blue-600">Processing Document</span>
                    </Flex>
                  ) : requestItem.resolutionStatus === resolutionStatus.LEGITIMATE ? (
                    <Flex align="center" className="space-x-3">
                      <div className="flex items-center space-x-2">
                        <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <span className="text-sm text-green-600 font-medium">Document Processed Successfully</span>
                      </div>
                      <Tooltip label="View Summary" withArrow>
                        <img
                          src={iconOpen}
                          onClick={() => {
                            const document = requestItem.documents?.[0];
                            if (document) {
                              openDocumentViewer(document);
                            } else {
                              log(LogLevel.ERROR, "RequestsList :: No document found for request", requestItem.requestId);
                            }
                          }}
                          alt="View Summary"
                          className="h-5 w-5 cursor-pointer hover:opacity-75"
                        />
                      </Tooltip>
                    </Flex>
                  ) : (
                    <span className="text-sm text-gray-500">No action available</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
    );
  }
);

RequestsList.displayName = 'RequestsList';

export default RequestsList;