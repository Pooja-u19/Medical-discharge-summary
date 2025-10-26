import api from './axiosConfig';

export interface ApiResponse<T> {
    data: any;
    status: number;
    statusText: string;
    headers: any;
    config: any;
    request?: any;
}

export const get = async <T>(url: string, config = {}): Promise<ApiResponse<T>> => {
    try {
        const response = await api.get<T>(url, config);
        return response;
    } catch (error) {
        throw error;
    }
};

export const post = async <T>(url: string, data: any, config = {}): Promise<ApiResponse<T>> => {
    try {
        const response = await api.post<T>(url, data, config);
        return response;
    } catch (error) {
        throw error;
    }
};

export const put = async <T>(url: string, data: any, config = {}): Promise<ApiResponse<T>> => {
    try {
        const response = await api.put<T>(url, data, config);
        return response;
    } catch (error) {
        throw error;
    }
};

export const del = async <T>(url: string, config = {}): Promise<ApiResponse<T>> => {
    try {
        const response = await api.delete<T>(url, config);
        return response;
    } catch (error) {
        throw error;
    }
};

export const patch = async <T>(url: string, data: any, config = {}): Promise<ApiResponse<T>> => {
    try {
        const response = await api.patch<T>(url, data, config);
        return response;
    } catch (error) {
        throw error;
    }
};