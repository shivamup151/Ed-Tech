"use client";

import { useEffect } from 'react';

export default function CleanupService() {
  useEffect(() => {
    // Run cleanup immediately on app start
    const runCleanup = async () => {
      try {
        const response = await fetch('/api/cleanup/feedback', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        
        if (response.ok) {
          const result = await response.json();
          console.log('Initial feedback cleanup completed:', result);
        } else {
          console.error('Initial cleanup failed:', response.statusText);
        }
      } catch (error) {
        console.error('Error running initial cleanup:', error);
      }
    };

    // Run cleanup immediately
    runCleanup();

    // Set up interval to run cleanup every hour
    const interval = setInterval(async () => {
      try {
        const response = await fetch('/api/cleanup/feedback', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        
        if (response.ok) {
          const result = await response.json();
          console.log('Scheduled feedback cleanup completed:', result);
        } else {
          console.error('Scheduled cleanup failed:', response.statusText);
        }
      } catch (error) {
        console.error('Error running scheduled cleanup:', error);
      }
    }, 60 * 60 * 1000); // Every hour

    // Cleanup interval on component unmount
    return () => {
      clearInterval(interval);
    };
  }, []);

  // This component doesn't render anything
  return null;
}
