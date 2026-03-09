// Supabase configuration
export const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || "YOUR_SUPABASE_URL";
export const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY || "YOUR_SUPABASE_ANON_KEY";

// API configuration
const rawApiUrl = (
  import.meta.env.VITE_API_URL || "http://localhost:5000/api"
).trim();

const normalizeApiUrl = (url) => {
  // Ensure callers can set either https://domain.com or https://domain.com/api
  if (/\/api\/?$/i.test(url)) {
    return url.replace(/\/+$/, "");
  }
  return `${url.replace(/\/+$/, "")}/api`;
};

export const API_URL = normalizeApiUrl(rawApiUrl);

// App configuration
export const APP_NAME = "Boarding Connect";
export const APP_DESCRIPTION = "Find Your Perfect Boarding House";
