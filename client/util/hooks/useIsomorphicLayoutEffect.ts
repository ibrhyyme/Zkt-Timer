import {useEffect, useLayoutEffect} from 'react';

/**
 * useLayoutEffect logs an SSR warning because its effect cannot run during server render.
 * On the server we fall back to useEffect (these layout effects are client-only anyway);
 * on the client we keep useLayoutEffect for synchronous, pre-paint behavior.
 */
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export default useIsomorphicLayoutEffect;
