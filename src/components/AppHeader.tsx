import { Home, Compass, Search, MoreVertical, Info, Code2, HelpCircle, Headphones, FileText, Sun, Moon } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { LoginArea } from '@/components/auth/LoginArea';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTheme } from '@/hooks/useTheme';

export function AppHeader() {
  const navigate = useNavigate();
  const location = useLocation();
  const { displayTheme, setTheme } = useTheme();
  const { user } = useCurrentUser();

  const isActive = (path: string) => location.pathname === path;

  const toggleTheme = () => {
    setTheme(displayTheme === 'dark' ? 'light' : 'dark');
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-primary/10 bg-background/80 backdrop-blur-md shadow-sm">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            aria-label="Go to home"
          >
            <img
              src="/divine-logo.svg"
              alt="diVine"
              className="h-6"
            />
          </button>
        </div>
        <div className="flex items-center gap-2">
          {/* Main navigation - hidden on mobile when BottomNav is visible */}
          {user && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/')}
              className={cn(
                "hidden md:flex items-center gap-2",
                isActive('/') && "bg-primary/10 text-primary"
              )}
            >
              <Home className="h-4 w-4" />
              <span className="hidden lg:inline">Home</span>
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/discovery')}
            className={cn(
              "hidden md:flex items-center gap-2",
              isActive('/discovery') && "bg-primary/10 text-primary"
            )}
          >
            <Compass className="h-4 w-4" />
            <span className="hidden lg:inline">Discover</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/search')}
            className={cn(
              "hidden md:flex items-center gap-2",
              isActive('/search') && "bg-primary/10 text-primary"
            )}
          >
            <Search className="h-4 w-4" />
            <span className="hidden lg:inline">Search</span>
          </Button>
          <Button
            onClick={toggleTheme}
            variant="ghost"
            size="icon"
          >
            {displayTheme === 'dark'
              ? <Sun className='w-4 h-4' />
              : <Moon className='w-4 h-4' />
            }
          </Button>
          {/* More menu with info links */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
              >
                <MoreVertical className="h-4 w-4" />
                <span className="sr-only">More options</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem
                onClick={() => navigate('/about')}
                className="cursor-pointer hover:!bg-transparent hover:outline hover:outline-1 hover:outline-primary/30 focus:!bg-transparent focus:outline focus:outline-1 focus:outline-primary"
              >
                <Info className="mr-2 h-4 w-4" />
                <span>About</span>
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={() => window.location.href = 'https://about.divine.video/faqs/'}
                className="cursor-pointer hover:!bg-transparent hover:outline hover:outline-1 hover:outline-primary/30 focus:!bg-transparent focus:outline focus:outline-1 focus:outline-primary"
              >
                <HelpCircle className="mr-2 h-4 w-4" />
                <span>FAQ</span>
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={() => navigate('/support')}
                className="cursor-pointer hover:!bg-transparent hover:outline hover:outline-1 hover:outline-primary/30 focus:!bg-transparent focus:outline focus:outline-1 focus:outline-primary"
              >
                <Headphones className="mr-2 h-4 w-4" />
                <span>Support</span>
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={() => navigate('/open-source')}
                className="cursor-pointer hover:!bg-transparent hover:outline hover:outline-1 hover:outline-primary/30 focus:!bg-transparent focus:outline focus:outline-1 focus:outline-primary"
              >
                <Code2 className="mr-2 h-4 w-4" />
                <span>Open Source</span>
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={() => window.location.href = 'https://about.divine.video/media-resources/'}
                className="cursor-pointer hover:!bg-transparent hover:outline hover:outline-1 hover:outline-primary/30 focus:!bg-transparent focus:outline focus:outline-1 focus:outline-primary"
              >
                <FileText className="mr-2 h-4 w-4" />
                <span>Media Resources</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <LoginArea className="max-w-60" />
        </div>
      </div>
    </header>
  );
}

export default AppHeader;

