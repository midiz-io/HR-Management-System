import { useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { AuthContext } from '@/contexts/AuthContext';

const publicRoutes = [
  '/', 
  '/login', 
  '/signup', 
  '/forgot-password', 
  '/magic-link-login', 
  '/reset-password', 
  '/auth/callback',
  '/verify/[id]',
  '/public/gate-pass/[id]',
  '/locations'
];

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, initializing } = useContext(AuthContext);
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState<boolean>(false);

  useEffect(() => {
    // Only redirect if we're not initializing and the user is not logged in
    if (!initializing) {
      const isPublicRoute = publicRoutes.includes(router.pathname);
      
      if (!user && !isPublicRoute) {
        // Redirect to login for protected routes when not logged in
        router.push('/login');
      } else {
        // User is logged in or on a public route
        setIsAuthorized(true);
      }
    }
  }, [user, initializing, router.pathname, router]);

  if (initializing) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  // Don't render children until we've determined authorization
  if (!isAuthorized && !publicRoutes.includes(router.pathname)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;
