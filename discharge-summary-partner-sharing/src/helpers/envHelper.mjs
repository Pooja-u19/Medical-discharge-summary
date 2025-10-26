export const getBooleanEnv = (key, defaultValue = false) => {
  const value = process.env[key];
  if (value === undefined) return defaultValue;
  return value.toLowerCase() === "true" || value === "1";
};

export const getIntEnv = (key, defaultValue = 0) => {
  const value = process.env[key];
  if (value === undefined) return defaultValue;
  const parsedValue = parseInt(value, 10);
  return isNaN(parsedValue) ? defaultValue : parsedValue;
};

export const getStringEnv = (key, defaultValue = "") => {
  return process.env[key] || defaultValue;
};
