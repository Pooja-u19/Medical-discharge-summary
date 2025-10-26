import { useEffect, useImperativeHandle, useState, forwardRef } from "react";
import { Table, Flex, Pagination, Tooltip } from "@mantine/core";
import { RequestsListProps, IRequest, IDocument } from "./requestsListTypes";
import { useLogger } from "../../../../../hooks";
import iconOpen from "../../../../../assets/iconOpen.svg";
import {
  getData,
  openDatabase,
} from "../../../../../utils/indexDBUtils";
import { environment } from "../../../../../config/environment";
import { LogLevel } from "../../../../../enums";
import requestsListService from "./requestsListService";
import { documentStatus, resolutionStatus } from "./requestsListEnum";
import { useNavigate } from "react-router-dom";

const RequestsList = forwardRef<{ refresh: () => void }, RequestsListProps>(
  ({ handleShowMore }, ref) => {
    const [requests, setRequests] = useState<IRequest[]>([]);
    const [requestsCount, setRequestsCount] = useState<number>(0);
    const [activePage, setActivePage] = useState<number>(1);
    const pageSize = 50;
    const { log } = useLogger();
    const navigate = useNavigate();

    useImperativeHandle(ref, () => ({
      refresh: async () => {
        await fetchRequests();
      },
    }));

    useEffect(() => {
      fetchRequests();
    }, [activePage]);

    const openDocumentViewer = (document: IDocument) => {
      navigate("/document", {
        state: {
          pages: document.pages || [],
          summary: document.summary,
          documentS3Path: document.documentS3Path
        },
      });
    };

    const fetchRequests = async () => {
      try {
        log(LogLevel.INFO, "RequestsList :: Fetching requests from IndexedDB");
        const db = await openDatabase(environment.indexedDBName, 1);
        const result = await getData<IRequest>(
          db,
          environment.indexedDBStoreName,
          "requestId",
          pageSize,
          (activePage - 1) * pageSize
        );

        log(LogLevel.INFO, "RequestsList :: IndexedDB result", result);

        const updatedRequests: IRequest[] = [];

        for (const request of result?.data || []) {
          try {
            log(LogLevel.INFO, `RequestsList :: Fetching API data for request ${request.requestId}`);
            const requestData = await requestsListService.getRequest(
              request.requestId
            );
            if (requestData.data?.data) {
              updatedRequests.push({
                ...request,
                documents: requestData.data.data.documents,
                authorizationNumber:
                  requestData.data.data.request?.authorizationNumber || null,
                resolutionStatus: determineResolutionStatus(
                  requestData.data.data.documents
                ),
              });
            } else {
              log(
                LogLevel.ERROR,
                `Failed to fetch request ${request.requestId}`,
                requestData
              );
            }
          } catch (apiError) {
            log(
              LogLevel.ERROR,
              `Failed to fetch request ${request.requestId}`,
              apiError
            );
          }
        }

        log(LogLevel.INFO, "RequestsList :: Final updated requests", updatedRequests);
        setRequests(updatedRequests);
        setRequestsCount(updatedRequests.length);
      } catch (error) {
        log(LogLevel.ERROR, "RequestsList :: fetchRequests", error);
      }
    };

    const determineResolutionStatus = (documents: any[]) => {
      const statuses = documents.map((doc) => doc.documentStatus);
      if (statuses.includes(resolutionStatus.SUSPICIOUS))
        return resolutionStatus.SUSPICIOUS;
      if (statuses.every((status) => status === resolutionStatus.LEGITIMATE))
        return resolutionStatus.LEGITIMATE;
      if (statuses.includes(resolutionStatus.ERROR))
        return resolutionStatus.ERROR;
      return resolutionStatus.PENDING;
    };

    const getTimeRemaining = (createdAt: string) => {
      const createdTime = new Date(createdAt).getTime();
      const currentTime = new Date().getTime();
      return Math.max(0, Math.ceil((createdTime + 60000 - currentTime) / 1000));
    };

    return (
      <div className="h-[80vh] md:max-h-[800px] overflow-auto">
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
                  colSpan={5}
                  className="py-3 px-2 sm:px-4 text-center text-sm"
                >
                  <div className="flex flex-col items-center py-8">
                    <div className="text-gray-500 mb-2">No Documents Found</div>
                    <div className="text-xs text-gray-400 mb-4">
                      Click "Analyze Document" to upload and analyze your first document
                    </div>
                  </div>
                </td>
              </tr>
            )}
            {requests.map((request, index) => {
              const firstDocument = request.documents?.[0];

              return (
                <tr key={index}>
                  <td className="border-b border-gray-300 py-2 px-4">{request.requestId}</td>
                  <td className="border-b border-gray-300 py-2 px-4">
                    {firstDocument &&
                      firstDocument.documentStatus ===
                        documentStatus.LEGITIMATE && (
                        <Flex align="center" className="space-x-3">
                          <Tooltip label="Check for more info" withArrow>
                            <img
                              src={iconOpen}
                              onClick={() =>
                                openDocumentViewer(request.documents[0])
                              }
                              alt="Show More Logo"
                              className="h-5 w-5 cursor-pointer"
                            />
                          </Tooltip>
                        </Flex>
                      )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </div>
    );
  }
);

export default RequestsList;
