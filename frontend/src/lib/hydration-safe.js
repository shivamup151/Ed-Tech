/**
 * Hydration-safe utilities to prevent React error #418
 * These utilities ensure consistent behavior between server and client rendering
 */

import React from 'react';

/**
 * Generate a consistent ID that works the same on server and client
 * Uses a counter-based approach instead of Date.now() or Math.random()
 */
let idCounter = 0;
export const generateHydrationSafeId = (prefix = 'id') => {
  return `${prefix}-${++idCounter}`;
};

/**
 * Get a safe timestamp that's consistent during hydration
 * Returns null during SSR, actual date after hydration
 */
export const getHydrationSafeTimestamp = (isClient) => {
  return isClient ? new Date() : null;
};

/**
 * Safe localStorage access that doesn't cause hydration mismatches
 */
export const safeLocalStorage = {
  getItem: (key, defaultValue = null) => {
    if (typeof window === 'undefined') return defaultValue;
    try {
      return localStorage.getItem(key) || defaultValue;
    } catch {
      return defaultValue;
    }
  },
  
  setItem: (key, value) => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(key, value);
    } catch {
      // Silently fail if localStorage is not available
    }
  }
};

/**
 * Safe window access that doesn't cause hydration mismatches
 */
export const safeWindow = {
  get: (property, defaultValue = undefined) => {
    if (typeof window === 'undefined') return defaultValue;
    return window[property] || defaultValue;
  },
  
  isAvailable: () => typeof window !== 'undefined'
};

/**
 * Hook to safely access client-side only features
 */
export const useIsClient = () => {
  const [isClient, setIsClient] = React.useState(false);
  
  React.useEffect(() => {
    setIsClient(true);
  }, []);
  
  return isClient;
};

/**
 * Component wrapper that only renders on client side
 */
export const ClientOnly = ({ children, fallback = null }) => {
  const isClient = useIsClient();
  
  if (!isClient) {
    return fallback;
  }
  
  return children;
};

/**
 * Hook to safely access browser APIs
 */
export const useSafeBrowserAPI = () => {
  const [isClient, setIsClient] = React.useState(false);
  
  React.useEffect(() => {
    setIsClient(true);
  }, []);
  
  return {
    isClient,
    localStorage: isClient ? window.localStorage : null,
    sessionStorage: isClient ? window.sessionStorage : null,
    document: isClient ? window.document : null,
    window: isClient ? window : null,
  };
};