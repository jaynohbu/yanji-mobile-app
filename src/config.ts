// Yanji Restaurant - Mobile Configuration

const isDevelopment = __DEV__;

export const config = {
  API_BASE: isDevelopment
    ? 'http://localhost:3000'
    : 'https://yanji.tunesbasis.com',
};

export const API_BASE = config.API_BASE;
