import React from 'react';
import type { NavigationTab, User } from '../../types';
import { Button } from '../ui/Button';
import { MenuIcon, PlusIcon } from '../icons/Icons';

export interface HeaderProps {
  activeTab: NavigationTab;
  currentUser: User | null;
  onOpenMobileMenu: () => void;
  onNewProjectClick?: () => void;
  onLogout?: () => void;
}

const TAB_TITLES: Record<string, string> = {
  dashboard: 'Overview',
  projects: 'Projects',
  'new-project': 'New Project',
  'project-details': 'Project Details',
  'deployment-details': 'Deployment Details',
  deployments: 'Deployments',
  settings: 'Settings',
};

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onOpenMobileMenu,
  onNewProjectClick,
}) => {
  const currentTitle = TAB_TITLES[activeTab] || 'Overview';
  const showNewProjectBtn = activeTab === 'dashboard' || activeTab === 'projects';

  return (
    <header className="sticky top-0 z-30 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800/80 px-4 sm:px-6 h-12 flex items-center justify-between gap-4">
      {/* Left: Mobile Toggle & Page Title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobileMenu}
          className="lg:hidden p-1 text-zinc-400 hover:text-zinc-100 rounded hover:bg-zinc-900 transition-colors"
          aria-label="Open Navigation Menu"
        >
          <MenuIcon size={16} />
        </button>

        <h1 className="text-xs font-semibold text-zinc-200 uppercase tracking-wider font-mono">
          {currentTitle}
        </h1>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        {showNewProjectBtn && onNewProjectClick && (
          <Button
            variant="primary"
            size="sm"
            onClick={onNewProjectClick}
            leftIcon={<PlusIcon size={12} />}
          >
            New Project
          </Button>
        )}
      </div>
    </header>
  );
};
