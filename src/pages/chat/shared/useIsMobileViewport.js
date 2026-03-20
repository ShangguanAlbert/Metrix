import { useEffect, useState } from "react";

const MOBILE_BREAKPOINT_PX = 720;

function readIsMobile() {
  if (typeof window === "undefined") return false;
  return window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT_PX}px)`).matches;
}

export default function useIsMobileViewport() {
  const [isMobile, setIsMobile] = useState(readIsMobile);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const mediaQuery = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT_PX}px)`);
    const onChange = (event) => {
      setIsMobile(Boolean(event.matches));
    };
    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", onChange);
    } else if (typeof mediaQuery.addListener === "function") {
      mediaQuery.addListener(onChange);
    }
    return () => {
      if (typeof mediaQuery.removeEventListener === "function") {
        mediaQuery.removeEventListener("change", onChange);
      } else if (typeof mediaQuery.removeListener === "function") {
        mediaQuery.removeListener(onChange);
      }
    };
  }, []);

  return isMobile;
}
