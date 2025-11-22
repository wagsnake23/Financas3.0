import * as React from "react";

const MOBILE_BREAKPOINT = 768;

export function useIsMobile() {
  // Initialize state based on window.innerWidth if available, otherwise default to false
  const [isMobile, setIsMobile] = React.useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < MOBILE_BREAKPOINT;
    }
    return false; // Default for non-browser environments or initial render
  });

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    mql.addEventListener("change", onChange);
    // Set initial state again in useEffect to ensure it's correct after hydration
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT); 
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isMobile; // Return the boolean directly
}