import { ApiResponse, get } from "../../../../../api";

const requestsListService = {
  getRequest: async (requestId: string): Promise<ApiResponse<any>> => {
    return await get(`/api/v1/document/request/${requestId}`);
  },
};

export default requestsListService;
