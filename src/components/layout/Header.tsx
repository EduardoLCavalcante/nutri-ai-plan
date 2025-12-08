import { Link, useLocation } from 'react-router-dom';
import { Salad, Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { cn } from '@/lib/utils';

const Header = () => {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();

  const navLinks = [
    { href: '/', label: 'Início' },
    { href: '/formulario', label: 'Criar Plano' },
    { href: '/chat', label: 'Chat Nutricional' },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <header className="sticky top-0 z-50 glass-effect border-b border-border/50">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="gradient-primary p-2 rounded-xl shadow-soft group-hover:shadow-glow transition-shadow duration-300">
              <Salad className="h-6 w-6 text-primary-foreground" />
            </div>
            <span className="font-display font-bold text-xl text-foreground">
              Nutri<span className="text-primary">AI</span>
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link key={link.href} to={link.href}>
                <Button
                  variant={isActive(link.href) ? "default" : "ghost"}
                  size="sm"
                  className={cn(
                    "font-medium",
                    isActive(link.href) && "shadow-soft"
                  )}
                >
                  {link.label}
                </Button>
              </Link>
            ))}
          </nav>

          {/* Mobile Menu Button */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setIsOpen(!isOpen)}
          >
            {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>

        {/* Mobile Navigation */}
        {isOpen && (
          <nav className="md:hidden py-4 border-t border-border/50 animate-slide-up">
            <div className="flex flex-col gap-2">
              {navLinks.map((link) => (
                <Link key={link.href} to={link.href} onClick={() => setIsOpen(false)}>
                  <Button
                    variant={isActive(link.href) ? "default" : "ghost"}
                    className="w-full justify-start"
                  >
                    {link.label}
                  </Button>
                </Link>
              ))}
            </div>
          </nav>
        )}
      </div>
    </header>
  );
};

export default Header;
