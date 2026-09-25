import React, { createContext, useContext, useState, useEffect } from 'react';
import { jwtDecode } from 'jwt-decode';
import { User, UserRole } from '../types';
import { authApi } from '../services/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isVerifyingSession: boolean;
  login: (email: string, password: string, role?: string) => Promise<User>;
  register: (registerData: {
    name: string;
    email: string;
    password: string;
    role?: string;
    specialization?: string;
    qualifications?: string;
    years_experience?: string;
    crops_expertise?: string[];
    bio?: string;
    assigned_region?: string;
    department?: string;
    phone?: string;
  }) => Promise<User>;
  updateUser: (user: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function getStoredSession(): { user: User | null; token: string | null } {
  try {
    const token = localStorage.getItem('agriguard_token');
    const saved = localStorage.getItem('agriguard_user');
    if (!token || token === 'demo-token' || !saved) {
      return { user: null, token: null };
    }

    // Inspect JWT expiration timestamp synchronously
    try {
      const decoded = jwtDecode<{ exp?: number }>(token);
      if (decoded.exp && decoded.exp * 1000 < Date.now()) {
        console.log('[Auth] Stored session expired. Purging credentials.');
        localStorage.removeItem('agriguard_token');
        localStorage.removeItem('agriguard_user');
        localStorage.removeItem('agriguard_refresh_token');
        return { user: null, token: null };
      }
    } catch {
      // If token is opaque or malformed, continue to API check
    }

    return { user: JSON.parse(saved), token };
  } catch {
    return { user: null, token: null };
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const initialSession = getStoredSession();
  const [user, setUser] = useState<User | null>(initialSession.user);
  const [token, setToken] = useState<string | null>(initialSession.token);
  const [isVerifyingSession, setIsVerifyingSession] = useState<boolean>(!!initialSession.token);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (user) {
      localStorage.setItem('agriguard_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('agriguard_user');
    }
  }, [user]);

  // Verify real user session on mount
  useEffect(() => {
    if (token) {
      authApi.getMe()
        .then((userData) => {
          setUser(userData);
        })
        .catch((err: any) => {
          // ONLY clear stored session if server definitively rejected the token (401 Unauthorized)
          if (err?.response?.status === 401) {
            console.warn('[Auth] Server rejected token (401 Unauthorized). Logging out.');
            logout();
          } else {
            console.warn('[Auth] Network or server busy during session verification. Preserving cached session.');
          }
        })
        .finally(() => {
          setIsVerifyingSession(false);
        });
    } else {
      setIsVerifyingSession(false);
    }
  }, []);

  const login = async (email: string, password: string, role?: string): Promise<User> => {
    setIsLoading(true);
    try {
      const data = await authApi.login(email, password, role);
      setToken(data.access_token);
      setUser(data.user);
      localStorage.setItem('agriguard_token', data.access_token);
      if (data.refresh_token) {
        localStorage.setItem('agriguard_refresh_token', data.refresh_token);
      }
      localStorage.setItem('agriguard_user', JSON.stringify(data.user));
      return data.user;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (registerData: {
    name: string;
    email: string;
    password: string;
    role?: string;
    specialization?: string;
    qualifications?: string;
    years_experience?: string;
    crops_expertise?: string[];
    bio?: string;
    assigned_region?: string;
    department?: string;
    phone?: string;
  }): Promise<User> => {
    setIsLoading(true);
    try {
      const data = await authApi.register(registerData);
      setToken(data.access_token);
      setUser(data.user);
      localStorage.setItem('agriguard_token', data.access_token);
      localStorage.setItem('agriguard_user', JSON.stringify(data.user));
      return data.user;
    } finally {
      setIsLoading(false);
    }
  };

  const updateUser = (updatedUser: User) => {
    setUser(updatedUser);
    localStorage.setItem('agriguard_user', JSON.stringify(updatedUser));
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    setIsVerifyingSession(false);
    localStorage.removeItem('agriguard_token');
    localStorage.removeItem('agriguard_refresh_token');
    localStorage.removeItem('agriguard_user');
    sessionStorage.clear();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user && !!token,
        isLoading,
        isVerifyingSession,
        login,
        register,
        updateUser,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
