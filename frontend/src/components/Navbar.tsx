import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import WalletButton from './WalletButton';
import { cn } from '../utils/cn';

const Navbar: React.FC = () => {
  const location = useLocation();
  
  const navLinks = [
    { name: 'Trade', path: '/trade' },
    { name: 'Pool', path: '/pool' },
    { name: 'Analytics', path: '/analytics' },
  ];

  return (
    <nav className="flex items-center justify-between px-6 py-4 border-b border-border bg-background">
      <div className="flex items-center space-x-8">
        <Link to="/" className="text-2xl font-bold text-primary tracking-tight">SwapX</Link>
        <div className="hidden md:flex space-x-1">
          {navLinks.map((link) => (
            <Link 
              key={link.path}
              to={link.path} 
              className={cn(
                "px-4 py-2 text-sm font-medium transition-colors",
                location.pathname === link.path || (link.path === '/trade' && location.pathname === '/')
                  ? "text-foreground bg-secondary"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
              )}
            >
              {link.name}
            </Link>
          ))}
        </div>
      </div>
      <div className="flex items-center space-x-4">
        <WalletButton />
      </div>
    </nav>
  );
};

export default Navbar;
