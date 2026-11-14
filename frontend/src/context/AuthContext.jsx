import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [store, setStore] = useState(null);
  const [session, setSession] = useState(null);
  const [activeDevices, setActiveDevices] = useState([]);
  const [loading, setLoading] = useState(true);

  // Check if session is active on mount
  const checkSession = useCallback(async () => {
    try {
      const data = await authApi.getMe();
      if (data.success && data.store) {
        setStore(data.store);
        setSession(data.session);
        // Also fetch active devices
        try {
          const devData = await authApi.getDevices();
          if (devData.success) {
            setActiveDevices(devData.devices);
          }
        } catch (err) {
          console.warn('Could not fetch active devices', err);
        }
      } else {
        setStore(null);
        setSession(null);
      }
    } catch (err) {
      setStore(null);
      setSession(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  const refreshDevices = async () => {
    try {
      const devData = await authApi.getDevices();
      if (devData.success) {
        setActiveDevices(devData.devices);
      }
    } catch (err) {
      console.error('Failed to refresh devices', err);
    }
  };

  const login = async (username, password) => {
    const data = await authApi.login({ username, password });
    if (data.success && data.store) {
      setStore(data.store);
      await checkSession();
      return { success: true };
    }
    return { success: false, error: data.error || 'Login failed' };
  };

  const register = async (params) => {
    const data = await authApi.register(params);
    if (data.success && data.store) {
      setStore(data.store);
      await checkSession();
      return { success: true };
    }
    return { success: false, error: data.error || 'Registration failed' };
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } finally {
      setStore(null);
      setSession(null);
      setActiveDevices([]);
    }
  };

  const logoutAll = async () => {
    try {
      await authApi.logoutAll();
    } finally {
      setStore(null);
      setSession(null);
      setActiveDevices([]);
    }
  };

  const revokeDevice = async (sessionId) => {
    const res = await authApi.revokeDevice(sessionId);
    if (res.success) {
      await refreshDevices();
      return { success: true };
    }
    return { success: false, error: res.error };
  };

  return (
    <AuthContext.Provider
      value={{
        store,
        session,
        activeDevices,
        loading,
        login,
        register,
        logout,
        logoutAll,
        refreshDevices,
        revokeDevice,
        checkSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

