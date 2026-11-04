import { useEffect } from 'react';

const ServiceWorkerRegister: React.FC = () => {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if ('serviceWorker' in navigator) {
      // Register the service worker located in public/service-worker.js
      navigator.serviceWorker
        .register('/service-worker.js')
        .then((registration) => {
          console.log('Service Worker registered:', registration);

          registration.onupdatefound = () => {
            const installingWorker = registration.installing;
            if (installingWorker) {
              installingWorker.onstatechange = () => {
                if (installingWorker.state === 'installed') {
                  if (navigator.serviceWorker.controller) {
                    console.log('New content is available; please refresh.');
                  } else {
                    console.log('Content is cached for offline use.');
                  }
                }
              };
            }
          };
        })
        .catch((err) => {
          console.warn('Service Worker registration failed:', err);
        });
    } else {
      console.log('Service Workers are not supported in this browser.');
    }
  }, []);

  return null;
};

export default ServiceWorkerRegister;
