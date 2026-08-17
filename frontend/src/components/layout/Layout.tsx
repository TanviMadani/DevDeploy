import React, { useState } from 'react';
import type { NavigationTab, User } from '../../types';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

export interface LayoutProps {
  activeTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
  currentUser: User | null;
  onNewProjectClick?: () => void;
  onLogout?: () => void;
  projectCount?: number;
  activeDeploymentsCount?: number;
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({
  activeTab,
  onSelectTab,
  currentUser,
  onNewProjectClick,
  onLogout,
  projectCount = 0,
  activeDeploymentsCount = 0,
  children,
}) => {
  const [isOpenMobile, setIsOpenMobile] = useState(false);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex font-sans antialiased">
      {/* Persistent Left Sidebar */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={onSelectTab}
        currentUser={currentUser}
        isOpenMobile={isOpenMobile}
        onCloseMobile={() => setIsOpenMobile(false)}
        projectCount={projectCount}
        activeDeploymentsCount={activeDeploymentsCount}
        onLogout={onLogout}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-52">
        {/* Sticky Top Header */}
        <Header
          activeTab={activeTab}
          currentUser={currentUser}
          onOpenMobileMenu={() => setIsOpenMobile(true)}
          onNewProjectClick={onNewProjectClick}
          onLogout={onLogout}
        />

        {/* Page Content */}
        <main className="flex-1 p-4 sm:p-6 max-w-5xl w-full mx-auto space-y-6">
          {children}
        </main>
      </div>
    </div>
  );
};
