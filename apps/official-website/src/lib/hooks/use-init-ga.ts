import { useEffect } from 'react';
import { useLocation } from 'react-router';
import ReactGA from 'react-ga4';

import { pageview } from '../utils/ga-utils';

/**
 * Custom hook to initialize Google Analytics (GA) and track page views.
 *
 * This hook uses the `useLocation` hook to get the current router location and
 * the `useEffect` hook to initialize GA if it hasn't been initialized yet.
 * It also tracks page views whenever the pathname changes.
 */
const useInitGA = () => {
  const router = useLocation();

  useEffect(() => {
    if (!ReactGA.isInitialized) {
      ReactGA.initialize('G-NQ71FMDTPE');
    }

    pageview(router.pathname);
  }, [router.pathname]);
};

export default useInitGA;
