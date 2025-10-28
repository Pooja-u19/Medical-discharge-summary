import { environment } from '../config/environment';

export const debugApiCall = async () => {
  console.log('=== API Debug Information ===');
  console.log('Environment:', {
    apiBaseUrl: environment.apiBaseUrl,
    apiKey: environment.apiKey ? `${environment.apiKey.substring(0, 4)}...${environment.apiKey.substring(environment.apiKey.length - 4)}` : 'NOT_SET',
    production: environment.production
  });

  const testPayload = {
    files: [{
      contentType: "application/pdf",
      size: 1024,
      documentType: "other_documents",
      fileName: "test.pdf"
    }]
  };

  const headers = {
    'Content-Type': 'application/json',
    'x-api-key': environment.apiKey,
    'Accept': 'application/json'
  };

  console.log('Request Headers:', {
    'Content-Type': headers['Content-Type'],
    'x-api-key': headers['x-api-key'] ? `${headers['x-api-key'].substring(0, 4)}...` : 'NOT_SET',
    'Accept': headers['Accept']
  });

  console.log('Request URL:', `${environment.apiBaseUrl}/api/v1/document/upload`);
  console.log('Request Payload:', testPayload);

  try {
    const response = await fetch(`${environment.apiBaseUrl}/api/v1/document/upload`, {
      method: 'POST',
      headers,
      body: JSON.stringify(testPayload)
    });

    console.log('Response Status:', response.status);
    console.log('Response Headers:', Object.fromEntries(response.headers.entries()));
    
    const responseText = await response.text();
    console.log('Response Body:', responseText);

    if (!response.ok) {
      console.error('Request failed with status:', response.status);
      return { success: false, status: response.status, body: responseText };
    }

    return { success: true, status: response.status, body: responseText };
  } catch (error: any) {
    console.error('Network error:', error);
    return { success: false, error: error?.message || 'Unknown error' };
  }
};

export const testCorsPreflightRequest = async () => {
  console.log('=== CORS Preflight Test ===');
  
  try {
    const response = await fetch(`${environment.apiBaseUrl}/api/v1/document/upload`, {
      method: 'OPTIONS',
      headers: {
        'Origin': window.location.origin,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type,x-api-key'
      }
    });

    console.log('Preflight Response Status:', response.status);
    console.log('Preflight Response Headers:', Object.fromEntries(response.headers.entries()));
    
    return response.ok;
  } catch (error: any) {
    console.error('Preflight request failed:', error);
    return false;
  }
};