"use client";

import { useState, useEffect } from 'react';

/**
 * HydrationBoundary - A wrapper that prevents hydration mismatches
 * Use this for components that have unavoidable hydration differences
 */
export default function HydrationBoundary({ 
  children, 
  fallback = null,
  suppressWarnings = true 
}) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // During SSR and initial hydration, show fallback
  if (!isClient) {
    return fallback;
  }

  // After hydration, show actual content
  return (
    <div suppressHydrationWarning={suppressWarnings}>
      {children}
    </div>
  );
}

/**
 * NoHydration - Component that never hydrates (client-only)
 * Use for components that absolutely cannot be server-rendered
 */
export function NoHydration({ children, fallback = null }) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return fallback;
  }

  return children;
}

/**
 * HydrationSafeWrapper - Wrapper that suppresses all hydration warnings
 */
export function HydrationSafeWrapper({ children }) {
  return (
    <div suppressHydrationWarning>
      <div suppressHydrationWarning>
        {children}
      </div>
    </div>
  );
}