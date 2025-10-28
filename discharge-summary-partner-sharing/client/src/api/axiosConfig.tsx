import axios, { AxiosInstance, AxiosResponse } from "axios";
import { environment } from "../config/environment";
import { LogLevel, ToastType } from "../enums";

const api: AxiosInstance = axios.create({
  timeout: 10000,
});

const setupInterceptors = (
  showLoader: () => void,
  hideLoader: () => void,
  showToast: (
    message: string,
    title?: string,
    type?: ToastType,
    autoClose?: number
  ) => void,
  log: (level: LogLevel, message: string, ...args: any[]) => void
) => {
  api.interceptors.request.use(
    async (config) => {
      showLoader();
      config.baseURL = environment.apiBaseUrl;
      config.headers["x-api-key"] = environment.apiKey;
      config.headers["Content-Type"] = "application/json";
      config.headers["Accept"] = "application/json";
      
      // Debug logging
      log(LogLevel.DEBUG, "API Request Config:", {
        url: `${config.baseURL}${config.url}`,
        method: config.method,
        headers: {
          "x-api-key": config.headers["x-api-key"] ? "[PRESENT]" : "[MISSING]",
          "Content-Type": config.headers["Content-Type"],
          "Accept": config.headers["Accept"]
        },
        data: config.data
      });
      
      return config;
    },
    (error) => {
      hideLoader();
      log(LogLevel.ERROR, "Request interceptor error:", error);
      return Promise.reject(error);
    }
  );

  api.interceptors.response.use(
    (response: AxiosResponse) => {
      hideLoader();
      log(LogLevel.DEBUG, "API Response Success:", {
        status: response.status,
        statusText: response.statusText,
        url: response.config.url,
        data: response.data
      });
      return response;
    },
    (error: any) => {
      hideLoader();
      
      // Enhanced error logging
      log(LogLevel.ERROR, "API Response Error:", {
        status: error.response?.status,
        statusText: error.response?.statusText,
        url: error.config?.url,
        method: error.config?.method,
        headers: error.config?.headers,
        responseData: error.response?.data,
        message: error.message
      });
      
      if (error.response && error.response.data) {
        const errorMessage = error.response.data.message || "An error occurred";
        showToast(errorMessage, "Error", ToastType.ERROR);
      } else if (error.message) {
        showToast(error.message, "Error", ToastType.ERROR);
      }
      
      // Don't reject promise to prevent unhandled errors
      throw error;
    }
  );
};

export default api;
export { setupInterceptors };
