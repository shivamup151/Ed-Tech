"use client";

import { useEffect } from 'react';

export default function WeglotProvider() {
  useEffect(() => {
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

    // Small delay to ensure DOM is fully ready
    const timer = setTimeout(initWeglot, 100);
    
    return () => clearTimeout(timer);
  }, []);

  return null; // This component doesn't render anything
}
