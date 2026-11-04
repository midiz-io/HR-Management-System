import { useContext } from 'react';
import { useRouter } from 'next/router';
import { AuthContext } from '@/contexts/AuthContext';
import Logo from '@/components/Logo';
import { Button } from "@/components/ui/button";
import { useTheme } from '@/hooks/useTheme'; // Added
import { Sun, Moon } from 'lucide-react'; // Added

const Header = () => {
  const { user, initializing, signOut } = useContext(AuthContext);
  const router = useRouter();
  const { theme, toggleTheme } = useTheme(); // Added

  const handleButtonClick = () => {
    if (user && (router.pathname === '/dashboard' || router.pathname === '/admin-dashboard' || router.pathname === '/super-admin-dashboard')) {
      signOut();
      router.push('/');
    } else {
      router.push(user ? "/dashboard" : "/login");
    }
  };

  const buttonText = () => {
    if (user && (router.pathname === '/dashboard' || router.pathname === '/admin-dashboard' || router.pathname === '/super-admin-dashboard')) {
      return "Log out";
    }
    return user ? "Dashboard" : "Login";
  };

  return (
    <header className="w-full">
      <div className="flex justify-between items-center py-4 px-4 sm:px-6 lg:px-8">
        <div className="cursor-pointer" onClick={() => router.push("/")}>
          <Logo />
        </div>
        {!initializing && (
          <div className="flex items-center space-x-4">
            <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle theme">
              {theme === 'light' ? <Sun className="h-[1.2rem] w-[1.2rem]" /> : <Moon className="h-[1.2rem] w-[1.2rem]" />}
              <span className="sr-only">Toggle theme</span>
            </Button>
            <Button
              onClick={handleButtonClick}
              variant="default"
              size="default"
            >
              {buttonText()}
            </Button>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;