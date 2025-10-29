export const environment = {
    production: process.env.NODE_ENV === 'production',
    appPreferencesPrefix: process.env.REACT_APP_PREFERENCES_PREFIX || 'dvs:admin:',
    apiBaseUrl: process.env.REACT_APP_API_BASE_URL || 'https://6efwf9hdy8.execute-api.us-east-1.amazonaws.com/dev',
    indexedDBStoreName: process.env.REACT_APP_INDEXEDDB_STORE_NAME || 'requests',
    indexedDBName: process.env.REACT_APP_INDEXEDDB_NAME || 'dvs',
    indexedDBVersion: process.env.REACT_APP_INDEXEDDB_VERSION || 1,
    apiKey: process.env.REACT_APP_API_KEY || "eS0yz4iHrMDqxrewoNrJ9RVcQHfnWvknTvIntE00"
};
