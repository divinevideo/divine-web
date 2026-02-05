import { Home, Compass, Search, MoreVertical, Info, Code2, HelpCircle, Headphones, FileText, Sun, Moon } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useSubdomainNavigate } from '@/hooks/useSubdomainNavigate';
import { Button } from '@/components/ui/button';
import { LoginArea } from '@/components/auth/LoginArea';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTheme } from '@/hooks/useTheme';

export interface AppHeaderProps {
  className?: string;
}

export function AppHeader({ className }: AppHeaderProps) {
  const navigate = useSubdomainNavigate();
  const location = useLocation();
  const { displayTheme, setTheme } = useTheme();
  const { user } = useCurrentUser();

  const isActive = (path: string) => location.pathname === path;

  const toggleTheme = () => {
    setTheme(displayTheme === 'dark' ? 'light' : 'dark');
  };

  return (
    <header className={cn("sticky top-0 z-50 w-full border-b border-border bg-background backdrop-blur-md shadow-sm", className)}>
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
                isActive('/') && "bg-primary text-primary-foreground"
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
              isActive('/discovery') && "bg-primary text-primary-foreground"
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
              isActive('/search') && "bg-primary text-primary-foreground"
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
              {/* About diVine section */}
              <DropdownMenuItem
                onClick={() => navigate('/about')}
                className="cursor-pointer hover:bg-muted focus:bg-muted"
              >
                <Info className="mr-2 h-4 w-4" />
                <span>About</span>
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={() => navigate('/authenticity')}
                className="cursor-pointer hover:bg-muted focus:bg-muted"
              >
                <FileText className="mr-2 h-4 w-4" />
                <span>Our Mission</span>
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={() => window.open('https://about.divine.video/news/', '_blank')}
                className="cursor-pointer hover:bg-muted focus:bg-muted"
              >
                <FileText className="mr-2 h-4 w-4" />
                <span>News</span>
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={() => window.open('https://about.divine.video/blog/', '_blank')}
                className="cursor-pointer hover:bg-muted focus:bg-muted"
              >
                <FileText className="mr-2 h-4 w-4" />
                <span>Blog</span>
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={() => window.open('https://about.divine.video/faqs/', '_blank')}
                className="cursor-pointer hover:bg-muted focus:bg-muted"
              >
                <HelpCircle className="mr-2 h-4 w-4" />
                <span>FAQ</span>
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={() => window.open('https://about.divine.video/media-resources/', '_blank')}
                className="cursor-pointer hover:bg-muted focus:bg-muted"
              >
                <FileText className="mr-2 h-4 w-4" />
                <span>Media Resources</span>
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              {/* Terms and open source section */}
              <DropdownMenuItem
                onClick={() => navigate('/terms')}
                className="cursor-pointer hover:bg-muted focus:bg-muted"
              >
                <FileText className="mr-2 h-4 w-4" />
                <span>Terms</span>
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={() => navigate('/privacy')}
                className="cursor-pointer hover:bg-muted focus:bg-muted"
              >
                <FileText className="mr-2 h-4 w-4" />
                <span>Privacy</span>
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={() => navigate('/safety')}
                className="cursor-pointer hover:bg-muted focus:bg-muted"
              >
                <FileText className="mr-2 h-4 w-4" />
                <span>Safety</span>
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={() => navigate('/open-source')}
                className="cursor-pointer hover:bg-muted focus:bg-muted"
              >
                <Code2 className="mr-2 h-4 w-4" />
                <span>Open Source</span>
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={() => window.open('https://opencollective.com/aos-collective/contribute/divine-keepers-95646', '_blank')}
                className="cursor-pointer hover:bg-muted focus:bg-muted"
              >
                <FileText className="mr-2 h-4 w-4" />
                <span>Donate</span>
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              {/* Help - standalone */}
              <DropdownMenuItem
                onClick={() => navigate('/support')}
                className="cursor-pointer hover:bg-muted focus:bg-muted"
              >
                <Headphones className="mr-2 h-4 w-4" />
                <span>Help</span>
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

