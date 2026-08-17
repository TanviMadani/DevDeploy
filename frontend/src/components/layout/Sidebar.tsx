import React from 'react';
import type { NavigationTab, User } from '../../types';
import {
  LogoIcon,
  DashboardIcon,
  ProjectsIcon,
  DeploymentsIcon,
  SettingsIcon,
  XIcon,
} from '../icons/Icons';

export interface SidebarProps {
  activeTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
  currentUser: User | null;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  projectCount?: number;
  activeDeploymentsCount?: number;
  onLogout?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  currentUser,
  isOpenMobile,
  onCloseMobile,
  projectCount = 0,
  activeDeploymentsCount = 0,
  onLogout,
}) => {
  const navItems: {
    id: NavigationTab;
    label: string;
    icon: React.ReactNode;
    badge?: string | number;
  }[] = [
    {
      id: 'dashboard',
      label: 'Overview',
      icon: <DashboardIcon size={15} />,
    },
    {
      id: 'projects',
      label: 'Projects',
      icon: <ProjectsIcon size={15} />,
      badge: projectCount > 0 ? projectCount : undefined,
    },
    {
      id: 'deployments',
      label: 'Deployments',
      icon: <DeploymentsIcon size={15} />,
      badge: activeDeploymentsCount > 0 ? activeDeploymentsCount : undefined,
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: <SettingsIcon size={15} />,
    },
  ];

  const isNavActive = (tabId: NavigationTab) => {
    if (activeTab === tabId) return true;
    if (tabId === 'projects' && (activeTab === 'new-project' || activeTab === 'project-details'))
      return true;
    if (tabId === 'deployments' && activeTab === 'deployment-details') return true;
    return false;
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-52 bg-zinc-950 border-r border-zinc-800/80 flex flex-col justify-between transition-transform duration-150 lg:translate-x-0 ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-3">
          {/* Brand Header */}
          <div className="flex items-center justify-between px-2.5 py-2 mb-3">
            <button
              onClick={() => {
                onSelectTab('dashboard');
                onCloseMobile();
              }}
              className="flex items-center gap-2 text-left cursor-pointer group"
            >
              <LogoIcon size={16} className="text-zinc-100" />
              <span className="text-xs font-semibold tracking-tight text-zinc-100 font-mono group-hover:text-white transition-colors">
                DevDeploy
              </span>
            </button>

            <button
              onClick={onCloseMobile}
              className="lg:hidden p-1 text-zinc-400 hover:text-white rounded"
            >
              <XIcon size={15} />
            </button>
          </div>

          {/* Navigation Items */}
          <nav className="space-y-0.5">
            {navItems.map((item) => {
              const active = isNavActive(item.id);
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onSelectTab(item.id);
                    onCloseMobile();
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-colors cursor-pointer ${
                    active
                      ? 'bg-zinc-900 text-zinc-100 font-medium'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className={active ? 'text-zinc-200' : 'text-zinc-500'}>
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                  </div>

                  {item.badge !== undefined && (
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-900 text-zinc-400 border border-zinc-800">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* User Footer */}
        {currentUser && (
          <div className="p-3 border-t border-zinc-800/80 flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-zinc-200 truncate">
                {currentUser.name}
              </p>
              <p className="text-[10px] text-zinc-500 font-mono truncate">
                {currentUser.email}
              </p>
            </div>

            {onLogout && (
              <button
                onClick={onLogout}
                className="text-[11px] text-zinc-500 hover:text-zinc-300 px-1.5 py-1 rounded hover:bg-zinc-900 transition-colors font-mono cursor-pointer"
                title="Sign out"
              >
                Exit
              </button>
            )}
          </div>
        )}
      </aside>
    </>
  );
};
