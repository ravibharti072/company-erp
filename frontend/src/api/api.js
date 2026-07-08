import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://127.0.0.1:8000",
});

const TOKEN_KEYS = [
  "company_erp_token",
  "company_erp_access_token",
  "aerostate_erp_token",
  "access_token",
  "auth_token",
  "erp_token",
  "token",
];

const USER_KEYS = [
  "company_erp_user",
  "aerostate_erp_user",
  "auth_user",
  "erp_user",
  "user",
];

function getStoredToken() {
  for (const key of TOKEN_KEYS) {
    const token = localStorage.getItem(key) || sessionStorage.getItem(key);

    if (token && typeof token === "string" && token.trim()) {
      return token;
    }
  }

  return null;
}

export function clearAuthStorage() {
  TOKEN_KEYS.forEach((key) => {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  });

  USER_KEYS.forEach((key) => {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  });

  delete api.defaults.headers.common.Authorization;
}

export function setApiAuthToken(token) {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
}

api.interceptors.request.use(
  (config) => {
    const token = getStoredToken();

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    } else if (config.headers?.Authorization) {
      delete config.headers.Authorization;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const currentPath = window.location.pathname;

    const isAuthPage =
      currentPath === "/login" ||
      currentPath === "/super-admin-login";

    if (status === 401) {
      clearAuthStorage();

      if (!isAuthPage) {
        window.location.replace("/login");
      }
    }

    return Promise.reject(error);
  }
);

const existingToken = getStoredToken();

if (existingToken) {
  setApiAuthToken(existingToken);
}

export default api;