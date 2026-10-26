// Same backend the website (website/nextjs) talks to. For local testing on a
// phone, point this at your PC's LAN IP (e.g. http://192.168.1.10:5000) via
// EXPO_PUBLIC_API_BASE_URL in a .env file — localhost won't resolve on device.
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL || 'https://api.zillybuy.com';

// Admin API that serves the home page's banners, quick filters and banner
// collections (the website reads these from here too).
export const ADMIN_API_URL = 'https://prodadapi.zillybuy.com';

export const WEBSITE_URL = 'https://zillybuy.com';

// Must match the backend's Cashfree environment (website: NEXT_PUBLIC_CASHFREE_ENV,
// which defaults to production).
export const CASHFREE_MODE: 'production' | 'sandbox' =
  process.env.EXPO_PUBLIC_CASHFREE_ENV === 'sandbox' ? 'sandbox' : 'production';

// Pincode used until the shopper picks one; same default as the website.
export const DEFAULT_PINCODE_ID = 30508;

// Sent as x-utm-source / chatbot "source" so backend analytics can tell app
// traffic apart from the website.
export const APP_SOURCE = 'app';
