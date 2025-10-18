/**
 * Global hydration error handler
 * This will catch and suppress hydration errors in production
 */

// Only run in browser
if (typeof window !== 'undefined') {
  // Override console.error to filter out hydration warnings
  const originalError = console.error;
  const originalWarn = console.warn;
  const originalLog = console.log;
  
  console.error = (...args) => {
    const message = args[0]?.toString() || '';
    
    // Filter out hydration mismatch errors
    if (
      message.includes('Hydration failed') || 
      message.includes('hydration') ||
      message.includes('suppressHydrationWarning') ||
      message.includes('418') ||
      message.includes('mismatch') ||
      message.includes('server rendered') ||
      message.includes('client rendered')
    ) {
      // Silently ignore hydration errors
      return;
    }
    
    // Log all other errors normally
    originalError.apply(console, args);
  };

  console.warn = (...args) => {
    const message = args[0]?.toString() || '';
    
    // Filter out font preload warnings
    if (
      message.includes('preload') || 
      message.includes('font') ||
      message.includes('was preloaded using link preload but not used')
    ) {
      // Silently ignore font warnings
      return;
    }
    
    // Log all other warnings normally
    originalWarn.apply(console, args);
  };

  // Catch unhandled hydration errors
  window.addEventListener('error', (event) => {
    if (
      event.message && 
      (event.message.includes('Hydration failed') || 
       event.message.includes('hydration') ||
       event.message.includes('418'))
    ) {
      event.preventDefault();
      event.stopPropagation();
      return false;
    }
  });

  // Catch unhandled promise rejections related to hydration
  window.addEventListener('unhandledrejection', (event) => {
    if (
      event.reason && 
      event.reason.message && 
      (event.reason.message.includes('Hydration failed') || 
       event.reason.message.includes('hydration') ||
       event.reason.message.includes('418'))
    ) {
      event.preventDefault();
      return false;
    }
  });

  // Override React's error boundary to catch hydration errors
  const originalAddEventListener = window.addEventListener;
  window.addEventListener = function(type, listener, options) {
    if (type === 'error') {
      const wrappedListener = function(event) {
        if (
          event.error && 
          event.error.message && 
          (event.error.message.includes('Hydration failed') || 
           event.error.message.includes('hydration') ||
           event.error.message.includes('418'))
        ) {
          event.preventDefault();
          event.stopPropagation();
          return false;
        }
        return listener.call(this, event);
      };
      return originalAddEventListener.call(this, type, wrappedListener, options);
    }
    return originalAddEventListener.call(this, type, listener, options);
  };
}