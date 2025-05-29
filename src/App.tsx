// App.tsx with fixed undefined functions and improved watchlist handling

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './components/Dashboard';
import WatchlistPage from './components/watchlist/WatchlistPage';
import CompanyPage from './components/company/CompanyPage';
import AuthRouter from './components/auth/AuthRouter';
import ProtectedRoute from './components/auth/ProtectedRoute';
import { WatchlistProvider } from './context/WatchlistContext';
import { FilterProvider } from './context/FilterContext';
import { AuthProvider } from './context/AuthContext';
import { Company, ProcessedAnnouncement, enhanceAnnouncementData } from './api';
import { SocketProvider } from './context/SocketContext';
import { useAuth } from './context/AuthContext';
import { toast, Toaster } from 'react-hot-toast';
import NotificationIndicator from './components/common/NotificationIndicator';
import { sortByNewestDate } from './utils/dateUtils';

// Inner component with enhanced socket handling
const AppWithSocket = () => {
  const [activePage, setActivePage] = useState<'dashboard' | 'watchlist' | 'company'>('dashboard');
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [watchlistParams, setWatchlistParams] = useState<{ watchlistId?: string }>({});
  const [newAnnouncements, setNewAnnouncements] = useState<ProcessedAnnouncement[]>([]);
  const { user } = useAuth();
  const isAuthenticated = !!user;
  const processedAnnouncementIds = useRef<Set<string>>(new Set());

  // Navigation handlers
  // Fixed: Create proper handleViewNewAnnouncements without undefined variables
  const handleViewNewAnnouncements = () => {
    // Scroll to top where new announcements are displayed
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });

    // Clear new announcements after viewing
    setNewAnnouncements([]);
  };

  // Fixed: Define the missing handleViewAnnouncements function
  const handleViewAnnouncements = useCallback(() => {
    setActivePage('dashboard');
  }, []);

  const handleNavigate = (page: 'home' | 'watchlist' | 'company', params?: { watchlistId?: string }) => {
    console.log(`Navigating to ${page} with params:`, params);
    
    if (page === 'home') {
      setActivePage('dashboard');
      setSelectedCompany(null);
    } else if (page === 'watchlist') {
      setActivePage('watchlist');
      // Always update watchlist params, even if undefined
      setWatchlistParams(params || {});
      console.log("Set watchlist params to:", params);
    } else if (page === 'company' && selectedCompany) {
      setActivePage('company');
    }
  };

  const handleCompanyClick = (company: Company) => {
    setSelectedCompany(company);
    setActivePage('company');
  };

  // Enhanced new announcement handler 
  const handleNewAnnouncement = useCallback((rawAnnouncement: any) => {
    try {
      console.log('New announcement received in App:', rawAnnouncement);

      // Basic validation
      if (!rawAnnouncement) {
        console.warn('Received empty announcement data');
        return;
      }

      // Create a unique ID for deduplication
      const announcementId = rawAnnouncement.corp_id ||
        rawAnnouncement.id ||
        `new-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Check if we've already processed this announcement
      if (processedAnnouncementIds.current.has(announcementId)) {
        console.log(`Announcement ${announcementId} already processed in App, skipping`);
        return;
      }

      // Mark as processed
      processedAnnouncementIds.current.add(announcementId);

      // Format basic announcement data
      const baseAnnouncement: ProcessedAnnouncement = {
        id: announcementId,
        company: rawAnnouncement.companyname || rawAnnouncement.company || "Unknown Company",
        ticker: rawAnnouncement.symbol || rawAnnouncement.Symbol || "",
        category: rawAnnouncement.category || rawAnnouncement.Category || "Other",
        date: rawAnnouncement.date || new Date().toISOString(),
        summary: rawAnnouncement.ai_summary || rawAnnouncement.summary || "",
        detailedContent: rawAnnouncement.ai_summary || rawAnnouncement.summary || "",
        isin: rawAnnouncement.isin || rawAnnouncement.ISIN || "",
        sentiment: "Neutral",
        isNew: true, // Mark as new
        receivedAt: Date.now() // Add timestamp for sorting
      };

      // Enhance the announcement data
      let processedAnnouncement: ProcessedAnnouncement;
      try {
        processedAnnouncement = enhanceAnnouncementData([baseAnnouncement])[0];
      } catch (enhanceError) {
        console.error('Error enhancing announcement data:', enhanceError);
        // Fallback to base announcement if enhancement fails
        processedAnnouncement = baseAnnouncement;
      }

      // Update state with the new announcement
      setNewAnnouncements(prev => {
        // Check for duplicates again (by ID, which should be unique)
        if (prev.some(a => a.id === processedAnnouncement.id)) {
          return prev; // No change if duplicate
        }
        
        // Add to the beginning and sort properly
        const updated = [processedAnnouncement, ...prev];
        return sortByNewestDate(updated);
      });
      
    } catch (error) {
      console.error('Error processing new announcement:', error);
    }
  }, []);

  // Cleanup old "new" announcements after a while
  useEffect(() => {
    if (newAnnouncements.length > 0) {
      const timer = setTimeout(() => {
        // Move announcements from "new" to regular after 5 minutes
        const now = Date.now();
        const fiveMinutesAgo = now - 5 * 60 * 1000;

        setNewAnnouncements(prev =>
          prev.filter(announcement => {
            // Keep only announcements that arrived in the last 5 minutes
            const announcementTime = announcement.receivedAt || now;
            return announcementTime > fiveMinutesAgo;
          })
        );
      }, 60000); // Check every minute

      return () => clearTimeout(timer);
    }
  }, [newAnnouncements]);

  // We only want to use socket connections when user is authenticated
  if (!isAuthenticated) {
    return (
      <Router>
        <Routes>
          {/* Auth Routes */}
          <Route path="/auth/*" element={<AuthRouter />} />
          <Route path="*" element={<Navigate to="/auth/login" replace />} />
        </Routes>
      </Router>
    );
  }

  // Add debugging logs to help understand the state
  console.log("Active page:", activePage);
  console.log("Watchlist params:", watchlistParams);

  // Return fully configured app
  return (
    <SocketProvider onNewAnnouncement={handleNewAnnouncement}>
      <Router>
        <FilterProvider>
          <WatchlistProvider>
            <Routes>
              {/* Auth Routes */}
              <Route path="/auth/*" element={<AuthRouter />} />

              {/* Protected App Routes */}
              <Route path="/" element={
                <ProtectedRoute>
                  {activePage === 'dashboard' ? (
                    <Dashboard
                      onNavigate={handleNavigate}
                      onCompanySelect={handleCompanyClick}
                      newAnnouncements={newAnnouncements}
                    />
                  ) : activePage === 'watchlist' ? (
                    <WatchlistPage
                      onViewAnnouncements={handleViewAnnouncements}
                      onNavigate={handleNavigate}
                      watchlistParams={watchlistParams}
                      newAnnouncements={newAnnouncements}
                    />
                  ) : (
                    selectedCompany && (
                      <CompanyPage
                        company={selectedCompany}
                        onNavigate={handleNavigate}
                        onBack={() => setActivePage('dashboard')}
                        newAnnouncements={newAnnouncements.filter(
                          a => a.company === selectedCompany.name ||
                            a.isin === selectedCompany.isin ||
                            a.ticker === selectedCompany.symbol
                        )} 
                      />
                    )
                  )}
                </ProtectedRoute>
              } />

              {/* Fallback route */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            <NotificationIndicator
              onViewNewAnnouncements={handleViewNewAnnouncements}
            />
          </WatchlistProvider>
        </FilterProvider>
      </Router>
      {/* Toast container for notifications */}
      <Toaster />
    </SocketProvider>
  );
};

// Main component
function App() {
  return (
    <AuthProvider>
      <AppWithSocket />
    </AuthProvider>
  );
}

export default App;