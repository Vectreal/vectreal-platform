import { useEffect } from 'react';
import { Link, Outlet, useLocation } from 'react-router';
import { Pencil2Icon } from '@radix-ui/react-icons';

import { TypewriterEffect, Button, Toaster } from '@vctrl/shared/components';

import { useInitGA } from '../lib/hooks';
import { sendCustomEvent } from '../lib/utils/ga-utils';

import NavMenu from './nav-menu';
import Footer from './footer';

const words = ['Make', 'your', '3D', 'models', 'Perfect.'];

const cta = words.map((word, i) => ({
  text: word,
  // make last word different color
  ...(i === words.length - 1 && {
    className: 'text-zinc-500 dark:text-orange',
  }),
}));

/**
 * BaseLayout component that sets up the main layout for the application.
 * It includes navigation, main content area, and footer.
 *
 * @component
 *
 * @returns {JSX.Element} The rendered component.
 *
 * @remarks
 * - Uses `useLocation` to get the current URL path.
 * - Uses `useEffect` to scroll to the top of the page on path change.
 * - Initializes Google Analytics with `useInitGA`.
 * - Displays a navigation menu, main content, and a footer.
 * - Conditionally renders additional sections and footer based on the current path.
 *  */
const BaseLayout = () => {
  const currentLocation = useLocation();

  // Scroll to top on path change
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [currentLocation.pathname]);

  // Initialize Google Analytics
  useInitGA();

  return (
    <>
      <NavMenu />
      <main className="min-h-full h-full px-4">
        <Outlet />

        {!currentLocation.pathname.includes('editor') && (
          <div className="flex flex-col gap-48 py-48 w-full">
            <section className="flex flex-col items-center justify-center text-center gap-8 relative z-10">
              <p className="text-zinc-500 text-sm">
                Try out the one-click solution to web 3D efficiency
              </p>
              <TypewriterEffect words={cta} cursorClassName="bg-zinc-500" />
              <div className="flex flex-row gap-4">
                <Link
                  to="/editor"
                  onClick={() =>
                    sendCustomEvent({
                      category: 'Footer',
                      action: 'click',
                      label: 'CTA - Open Editor',
                    })
                  }
                >
                  <Button variant="secondary">
                    <Pencil2Icon className="mr-3" /> Open the Free Editor
                  </Button>
                </Link>
              </div>
            </section>
          </div>
        )}
      </main>

      {!currentLocation.pathname.includes('editor') && <Footer />}

      <Toaster position="bottom-right" />
    </>
  );
};

export default BaseLayout;
