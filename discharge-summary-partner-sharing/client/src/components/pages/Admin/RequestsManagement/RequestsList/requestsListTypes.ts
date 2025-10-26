import { documentStatus, resolutionStatus } from "./requestsListEnum";

export interface RequestsListProps {
  ref: { current: { refresh: () => void } | null };
  handleShowMore: (request: {
    requestName: string;
    authorizationNumber?: string;
    documents: IDocument[];
  }) => void;
}

export interface IRequest {
  requestId: string;
  requestName: string;
  authorizationNumber?: string;
  resolutionStatus: resolutionStatus;
  documents: IDocument[];
}

export interface IDocument {
  documentId: string;
  documentStatus: documentStatus;
  documentType: string;
  errorMessage?: string;
  documentS3Path: string;
  fraudProbability: number;
  analysisSummary: string;
  matchedDocumentS3Path?: string;
  pages: string[];
  summary: any;
  createdAt: string;
  updatedAt: string;
}
