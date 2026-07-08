import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import api from "../api/api";

export const AuthContext = createContext(null);

const PRIMARY_TOKEN_KEY = "company_erp_token";
const PRIMARY_USER_KEY = "company_erp_user";

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

function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function getStoredToken() {
  for (const key of TOKEN_KEYS) {
    const value = localStorage.getItem(key) || sessionStorage.getItem(key);

    if (value && typeof value === "string" && value.trim()) {
      return value;
    }
  }

  return null;
}

function getStoredUser() {
  for (const key of USER_KEYS) {
    const value = localStorage.getItem(key) || sessionStorage.getItem(key);

    if (!value) continue;

    const parsedUser = safeJsonParse(value);

    if (parsedUser && typeof parsedUser === "object") {
      return parsedUser;
    }

    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  }

  return null;
}

function setApiToken(token) {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
}

function clearAuthStorage() {
  TOKEN_KEYS.forEach((key) => {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  });

  USER_KEYS.forEach((key) => {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  });

  setApiToken(null);
}

function saveAuthStorage(token, user) {
  clearAuthStorage();

  localStorage.setItem(PRIMARY_TOKEN_KEY, token);
  localStorage.setItem(PRIMARY_USER_KEY, JSON.stringify(user));

  setApiToken(token);
}

function extractToken(payload) {
  if (!payload) return null;

  if (typeof payload === "string") {
    return payload;
  }

  return (
    payload.access_token ||
    payload.token ||
    payload.jwt ||
    payload.data?.access_token ||
    payload.data?.token ||
    null
  );
}

function extractUser(payload, fallbackUser = null) {
  if (!payload || typeof payload !== "object") {
    return fallbackUser;
  }

  return (
    payload.user ||
    payload.current_user ||
    payload.data?.user ||
    payload.data?.current_user ||
    fallbackUser ||
    null
  );
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => getStoredToken());
  const [user, setUser] = useState(() => getStoredUser());
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [loading, setLoading] = useState(false);

  const isAuthenticated = Boolean(token && user);

  useEffect(() => {
    const storedToken = getStoredToken();
    const storedUser = getStoredUser();

    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(storedUser);
      setApiToken(storedToken);
    } else {
      clearAuthStorage();
      setToken(null);
      setUser(null);
    }

    setCheckingAuth(false);
  }, []);

  useEffect(() => {
    setApiToken(token);
  }, [token]);

  const login = (tokenOrPayload, userData = null) => {
    const nextToken = extractToken(tokenOrPayload);
    const nextUser = extractUser(tokenOrPayload, userData);

    if (!nextToken || !nextUser) {
      console.error("Login failed because token or user is missing", {
        tokenOrPayload,
        userData,
      });

      clearAuthStorage();
      setToken(null);
      setUser(null);

      return false;
    }

    saveAuthStorage(nextToken, nextUser);

    setToken(nextToken);
    setUser(nextUser);

    return true;
  };

  const updateUser = (nextUser) => {
    if (!nextUser) return;

    setUser(nextUser);
    localStorage.setItem(PRIMARY_USER_KEY, JSON.stringify(nextUser));
  };

  const logout = () => {
    clearAuthStorage();
    setToken(null);
    setUser(null);
  };

  const value = useMemo(
    () => ({
      token,
      user,
      loading,
      checkingAuth,
      isAuthenticated,
      setLoading,
      login,
      logout,
      updateUser,
    }),
    [token, user, loading, checkingAuth, isAuthenticated]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}

export default AuthProvider;