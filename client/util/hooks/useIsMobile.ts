import { useState, useEffect } from 'react';

const MOBILE_BREAKPOINT = 600;

export function useIsMobile() {
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const checkMobile = () => {
            setIsMobile(window.innerWidth <= MOBILE_BREAKPOINT);
        };

        // Check on mount
        checkMobile();

        // Check on resize
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    return isMobile;
}
