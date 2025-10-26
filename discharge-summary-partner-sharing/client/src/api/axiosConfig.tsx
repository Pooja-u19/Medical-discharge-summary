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
      return config;
    },
    (error) => {
      hideLoader();
      return Promise.reject(error);
    }
  );

  api.interceptors.response.use(
    (response: AxiosResponse) => {
      hideLoader();
      log(LogLevel.DEBUG, "api", response);
      return response;
    },
    (error: any) => {
      log(LogLevel.ERROR, "api", error);
      hideLoader();
      if (error.response && error.response.data) {
        const errorMessage = error.response.data.message || "An error occurred";
        showToast(errorMessage, "Error", ToastType.ERROR);
      } else if (error.message) {
        showToast(error.message, "Error", ToastType.ERROR);
      }
    }
  );
};

export default api;
export { setupInterceptors };
