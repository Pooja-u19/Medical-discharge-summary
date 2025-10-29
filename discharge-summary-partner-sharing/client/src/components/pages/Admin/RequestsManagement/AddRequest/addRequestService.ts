import { post, get, ApiResponse } from "../../../../../api";

const addRequestService = {
  addRequest: async (body: {
    files: { 
      contentType: string; 
      size: number; 
      documentType: string;
      fileName?: string;
    }[];
    patientId?: string;
  }): Promise<ApiResponse<any>> => {
    return await post("/api/v1/document/upload", body);
  },
  
  getRequestStatus: async (requestId: string): Promise<ApiResponse<any>> => {
    return await get(`/api/v1/document/request/${requestId}`);
  },
};

export default addRequestService;
