import { post, ApiResponse } from "../../../../../api";

const addRequestService = {
  addRequest: async (body: {
    files: { contentType: string; size: number, documentType: string }[];
  }): Promise<ApiResponse<any>> => {
    return await post("/api/v1/document/upload", body);
  },
};

export default addRequestService;
