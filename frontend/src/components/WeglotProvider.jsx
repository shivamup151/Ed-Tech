"use client";

import { useEffect, useState } from 'react';

export default function WeglotProvider() {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    
    // Only initialize Weglot on the client side after hydration
    const initWeglot = () => {
      if (typeof window !== 'undefined' && window.Weglot && window.Weglot.initialize) {
        try {
          window.Weglot.initialize({
            api_key: process.env.NEXT_PUBLIC_WEGLOT_API_KEY,
            original_language: 'en',
            destination_languages: 'ar',
            auto_switch: true,
            switcher: {
              style: 'dropdown',
              position: 'bottom-right'
            }
          });
        } catch (error) {
          console.warn('Weglot initialization failed:', error);
        }
      }
    };

    // Wait for DOM to be ready and add a small delay
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        setTimeout(initWeglot, 200);
      });
    } else {
      setTimeout(initWeglot, 200);
    }
  }, []);

  // Don't render anything during SSR to prevent hydration mismatches
  if (!isClient) {
    return null;
  }

  return null; // This component doesn't render anything
}
