import { useState, useEffect } from 'react';

// Exclusive, matching `bp-down($bp-md)` in styles/tokens.scss and Tailwind's
// `md:` prefix. At exactly 768px CSS width (iPad Mini and iPad 9.7 in portrait)
// the app is on the desktop side, which is what the 92 `md:` utility classes
// already assumed. The nav shell is a separate, wider threshold: see
// HeaderNav.tsx, which collapses below 1024.
const MOBILE_BREAKPOINT = 768;

export function useIsMobile() {
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const checkMobile = () => {
            setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
        };

        // Check on mount
        checkMobile();

        // Check on resize
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    return isMobile;
}
