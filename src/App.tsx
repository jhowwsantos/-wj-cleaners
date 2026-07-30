import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { DashboardView } from './components/Dashboard/DashboardView';
import { ScheduleView } from './components/Schedule/ScheduleView';
import { RouteView } from './components/Route/RouteView';
import { ClientsView } from './components/Clients/ClientsView';
import { CleanerMobileHub } from './components/Cleaner/CleanerMobileHub';
import { FinancialsView } from './components/Financials/FinancialsView';
import { StaffView } from './components/Staff/StaffView';
import { ReportsView } from './components/Reports/ReportsView';
import { NewClientModal } from './components/NewClientModal';
import { NewJobModal } from './components/NewJobModal';
import { LoginView } from './components/LoginView';
import { ForcePasswordChangeModal } from './components/ForcePasswordChangeModal';

function AppContent() {
  const { activeTab, isAuthenticated } = useApp();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isNewClientModalOpen, setIsNewClientModalOpen] = useState(false);
  const [isNewJobModalOpen, setIsNewJobModalOpen] = useState(false);

  if (!isAuthenticated) {
    return <LoginView />;
  }

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors font-sans antialiased flex flex-col">
      {/* Top Navbar */}
      <Navbar onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />

      {/* Main Layout Container */}
      <div className="flex-1 flex max-w-7xl w-full mx-auto">
        {/* Navigation Sidebar */}
        <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

        {/* View Main Content Area */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 min-w-0">
          {activeTab === 'dashboard' && (
            <DashboardView
              onOpenNewClientModal={() => setIsNewClientModalOpen(true)}
              onOpenNewJobModal={() => setIsNewJobModalOpen(true)}
            />
          )}

          {activeTab === 'cleaner_hub' && <CleanerMobileHub />}

          {activeTab === 'schedule' && (
            <ScheduleView
              isAddModalOpen={isNewJobModalOpen}
              onCloseAddModal={() => setIsNewJobModalOpen(false)}
              onOpenAddModal={() => setIsNewJobModalOpen(true)}
            />
          )}

          {activeTab === 'route' && <RouteView />}

          {activeTab === 'clients' && (
            <ClientsView
              isAddModalOpen={isNewClientModalOpen}
              onCloseAddModal={() => setIsNewClientModalOpen(false)}
              onOpenAddModal={() => setIsNewClientModalOpen(true)}
            />
          )}

          {activeTab === 'cleaners' && <StaffView />}

          {activeTab === 'financials' && <FinancialsView />}

          {activeTab === 'reports' && <ReportsView />}

          {activeTab === 'saas' && <ReportsView />}
        </main>
      </div>

      {/* Global Modals for "+ Novo Cliente" & "+ Agendar Limpeza" */}
      <NewClientModal
        isOpen={isNewClientModalOpen}
        onClose={() => setIsNewClientModalOpen(false)}
      />
      <NewJobModal
        isOpen={isNewJobModalOpen}
        onClose={() => setIsNewJobModalOpen(false)}
      />

      {/* Mandatory First Access Password Change Modal */}
      <ForcePasswordChangeModal />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
