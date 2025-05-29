import React, { createContext, useState, useContext, useEffect } from 'react';
import { 
  Company, 
  getWatchlist as apiGetWatchlist, 
  createWatchlist as apiCreateWatchlist,
  addToWatchlist as apiAddToWatchlist,
  removeFromWatchlist as apiRemoveFromWatchlist,
  clearWatchlist as apiClearWatchlist,
  deleteWatchlist as apiDeleteWatchlist,
  bulkAddToWatchlist as apiBulkAddToWatchlist,
  WatchlistResponse
} from '../api';
import { useAuth } from './AuthContext';
import axios from 'axios';

// Updated Watchlist interface to align with backend data
export interface Watchlist {
  id: string;          // Maps to _id from server
  name: string;        // Maps to watchlistName from server
  companies: Company[]; // Derived from isin array from server
  category?: string;   // Maps to category from server
  isDefault?: boolean; // Derived from server response (e.g., if name is "My Watchlist")
  createdAt: Date;     // Derived if available
  type?: 'company' | 'category' | 'mixed'; // Client-side type for backward compatibility
}

interface WatchlistContextType {
  watchlists: Watchlist[];
  activeWatchlistId: string | null;
  setActiveWatchlistId: (id: string | null) => void;
  createWatchlist: (name: string) => Promise<Watchlist>;
  renameWatchlist: (id: string, newName: string) => Promise<boolean>;
  deleteWatchlist: (id: string) => Promise<boolean>;
  addToWatchlist: (company: Company, watchlistId?: string) => Promise<boolean>;
  removeFromWatchlist: (companyId: string, watchlistId?: string) => Promise<boolean>;
  removeMultipleFromWatchlist: (companyIds: string[], watchlistId?: string) => Promise<boolean>;
  clearWatchlist: (watchlistId?: string) => Promise<boolean>;
  bulkAddToWatchlist: (companies: Company[], watchlistId?: string) => Promise<number>;
  isWatched: (companyId: string, watchlistId?: string) => boolean;
  getWatchlistById: (id: string) => Watchlist | undefined;
  getDefaultWatchlist: () => Watchlist | undefined;
  isLoading: boolean;
  refreshWatchlists: () => Promise<void>;
}

const WatchlistContext = createContext<WatchlistContextType | undefined>(undefined);

// Generate a unique ID for optimistic updates
const generateId = (): string => {
  return Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
};

export const WatchlistProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [watchlists, setWatchlists] = useState<Watchlist[]>([]);
  const [activeWatchlistId, setActiveWatchlistId] = useState<string | null>(null);
  const { user, isLoading: isUserLoading } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  // Helper function for debugging API operations
  const logApiOperation = (operation: string, request: any, response?: any, error?: any) => {
    console.group(`API Operation: ${operation}`);
    console.log("Request:", request);
    if (response) console.log("Response:", response);
    if (error) console.error("Error:", error);
    console.groupEnd();
  };

  // Helper function to fetch company details for multiple ISINs
  const fetchCompanyDetailsForIsins = async (isins: string[]): Promise<Company[]> => {
    const companies: Company[] = [];
    
    for (const isin of isins) {
      try {
        // Use the company search API to find details by ISIN
        console.log(`Fetching company details for ISIN: ${isin}`);
        const response = await axios.get(`/api/company/search?q=${encodeURIComponent(isin)}`);
        
        if (response.data?.companies?.length > 0) {
          // Find the company with matching ISIN
          const matchingCompany = response.data.companies.find(
            (c: any) => (c.isin || c.ISIN) === isin
          );
          
          if (matchingCompany) {
            console.log(`Found company details for ISIN ${isin}:`, matchingCompany);
            companies.push({
              id: isin,
              symbol: matchingCompany.newnsecode || matchingCompany.oldnsecode || '',
              name: matchingCompany.newname || matchingCompany.oldname || '',
              isin: isin,
              industry: matchingCompany.industry || ''
            });
            continue; // Skip the fallback if we found a match
          }
        }
        
        // Fallback: Create a placeholder company with just the ISIN
        console.log(`No matching company found for ISIN ${isin}, using placeholder`);
        companies.push({
          id: isin,
          symbol: isin.substring(0, 6), // Use part of ISIN as a placeholder symbol
          name: `Company (${isin})`,    // Use ISIN as placeholder name
          isin: isin,
          industry: ''
        });
      } catch (error) {
        console.error(`Error fetching company details for ISIN ${isin}:`, error);
        
        // Add placeholder on error
        companies.push({
          id: isin,
          symbol: isin.substring(0, 6), // Use part of ISIN as a placeholder symbol
          name: `Company (${isin})`,    // Use ISIN as placeholder name
          isin: isin,
          industry: ''
        });
      }
    }
    
    console.log(`Returning ${companies.length} companies for ${isins.length} ISINs:`, companies);
    return companies;
  };

  // Helper function to convert server watchlist format to frontend format
  const convertServerWatchlists = async (serverWatchlists: any[]): Promise<Watchlist[]> => {
    if (!Array.isArray(serverWatchlists)) {
      console.error("Expected serverWatchlists to be an array, but got:", serverWatchlists);
      return [];
    }
    
    const convertedWatchlists: Watchlist[] = [];
    
    for (const wl of serverWatchlists) {
      // Fetch company details for each ISIN
      let companies: Company[] = [];
      
      if (Array.isArray(wl.isin) && wl.isin.length > 0) {
        companies = await fetchCompanyDetailsForIsins(wl.isin);
      }
      
      // Determine if it's the default watchlist
      const isDefault = wl.isDefault === true || wl.watchlistName === "My Watchlist";
      
      convertedWatchlists.push({
        id: wl._id || generateId(),
        name: wl.watchlistName || 'My Watchlist',
        companies: companies,
        category: wl.category || undefined,
        isDefault: isDefault,
        createdAt: wl.createdAt ? new Date(wl.createdAt) : new Date(),
        type: 'company', // Default type
      });
    }
    
    return convertedWatchlists;
  };

  // Refresh watchlists from server
  const refreshWatchlists = async () => {
    if (!user) {
      setWatchlists([]);
      setActiveWatchlistId(null);
      return;
    }

    setIsLoading(true);
    try {
      console.log('Fetching watchlists from server...');
      const response = await apiGetWatchlist();
      
      if (response && response.watchlists && Array.isArray(response.watchlists)) {
        console.log('Raw watchlists from server:', response.watchlists);
        const convertedWatchlists = await convertServerWatchlists(response.watchlists);
        console.log('Fetched and converted watchlists:', convertedWatchlists);

        setWatchlists(convertedWatchlists);

        // Set the active watchlist if not already set
        if (!activeWatchlistId && convertedWatchlists.length > 0) {
          const defaultWl = convertedWatchlists.find(wl => wl.isDefault) || convertedWatchlists[0];
          setActiveWatchlistId(defaultWl.id);
        } else if (activeWatchlistId && !convertedWatchlists.some(wl => wl.id === activeWatchlistId)) {
          // If active watchlist no longer exists, reset to default
          if (convertedWatchlists.length > 0) {
            const defaultWl = convertedWatchlists.find(wl => wl.isDefault) || convertedWatchlists[0];
            setActiveWatchlistId(defaultWl.id);
          } else {
            setActiveWatchlistId(null);
          }
        }
      } else {
        console.warn('Invalid or empty watchlist response format', response);
        // Create default watchlist if none exist
        await createDefaultWatchlist();
      }
    } catch (error) {
      console.error('Error fetching watchlists:', error);
      // Create default watchlist if fetch fails
      await createDefaultWatchlist();
    } finally {
      setIsLoading(false);
    }
  };

  // Create a default watchlist if none exists on the server
  const createDefaultWatchlist = async () => {
    if (!user || watchlists.length > 0) {
      return;
    }

    console.log('No watchlists found, creating default watchlist...');

    try {
      // Create a temporary watchlist for optimistic update
      const tempId = generateId();
      const defaultWatchlist: Watchlist = {
        id: tempId,
        name: "My Watchlist",
        companies: [],
        createdAt: new Date(),
        isDefault: true
      };

      // Optimistic update
      setWatchlists([defaultWatchlist]);
      setActiveWatchlistId(defaultWatchlist.id);

      // Create on server
      const response = await apiCreateWatchlist("My Watchlist");
      logApiOperation('createDefaultWatchlist', { watchlistName: "My Watchlist" }, response);

      if (response && response.watchlist) {
        // Get the server-created watchlist
        await refreshWatchlists();
      }
    } catch (error) {
      console.error('Error creating default watchlist:', error);
      // Rollback optimistic update
      setWatchlists([]);
      setActiveWatchlistId(null);
    }
  };

  // Fetch watchlists when user changes or component mounts
  useEffect(() => {
    refreshWatchlists();
  }, [user]);

  // Helper function to get watchlist by ID
  const getWatchlistById = (id: string): Watchlist | undefined => {
    return watchlists.find(watchlist => watchlist.id === id);
  };

  // Get the default watchlist
  const getDefaultWatchlist = (): Watchlist | undefined => {
    const defaultWatchlist = watchlists.find(w => w.isDefault === true);
    if (defaultWatchlist) return defaultWatchlist;
    if (watchlists.length > 0) return watchlists[0];
    return undefined;
  };

  // Create a new watchlist
  const createWatchlist = async (name: string): Promise<Watchlist> => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    // Create a temporary watchlist for optimistic update
    const tempId = generateId();
    const newWatchlist: Watchlist = {
      id: tempId,
      name,
      companies: [],
      createdAt: new Date(),
      isDefault: false
    };

    // Optimistic update
    setWatchlists(prev => [...prev, newWatchlist]);
    setActiveWatchlistId(newWatchlist.id);

    try {
      // Create on server
      const response = await apiCreateWatchlist(name);
      logApiOperation('createWatchlist', { name }, response);

      if (response && response.watchlist) {
        // Update with server data
        await refreshWatchlists();
        // Find the created watchlist in the refreshed list
        const createdWatchlist = watchlists.find(wl => wl.name === name);
        if (createdWatchlist) {
          return createdWatchlist;
        }
      }
      
      return newWatchlist; // Return the optimistic one if server data not available
    } catch (error) {
      console.error('Error creating watchlist:', error);
      // Rollback optimistic update
      setWatchlists(prev => prev.filter(wl => wl.id !== tempId));
      if (activeWatchlistId === tempId) {
        const defaultWl = getDefaultWatchlist();
        setActiveWatchlistId(defaultWl ? defaultWl.id : null);
      }
      throw error;
    }
  };

  // Rename a watchlist
  const renameWatchlist = async (id: string, newName: string): Promise<boolean> => {
    if (!user) {
      console.error('Cannot rename watchlist: User not authenticated');
      return false;
    }

    const watchlist = getWatchlistById(id);
    if (!watchlist) return false;

    // Store original name for rollback
    const originalName = watchlist.name;

    // Optimistic update
    setWatchlists(prev =>
      prev.map(wl =>
        wl.id === id ? { ...wl, name: newName } : wl
      )
    );

    try {
      // The server doesn't have a direct rename endpoint, but we can try to simulate it
      // For example, we could create a new watchlist, copy all ISINs, then delete the old one
      // For simplicity, let's just refresh the watchlists after making changes
      
      // TODO: Implement server-side rename when the API supports it
      // For now, let's assume success but keep the code ready for when the API is updated
      
      console.warn('Watchlist rename is only applied locally - the server API does not support renaming');
      return true;
    } catch (error) {
      console.error('Error renaming watchlist:', error);
      // Rollback optimistic update
      setWatchlists(prev =>
        prev.map(wl =>
          wl.id === id ? { ...wl, name: originalName } : wl
        )
      );
      return false;
    }
  };

  // Delete a watchlist
  const deleteWatchlist = async (id: string): Promise<boolean> => {
    if (!user) {
      console.error('Cannot delete watchlist: User not authenticated');
      return false;
    }

    const watchlistToDelete = getWatchlistById(id);
    if (!watchlistToDelete) return false;

    // Prevent deleting default watchlists
    if (watchlistToDelete.isDefault) {
      console.warn("Cannot delete default watchlist.");
      return false;
    }

    // Store deleted watchlist for rollback
    const deletedWatchlist = { ...watchlistToDelete };

    // Optimistic update
    setWatchlists(prev => prev.filter(watchlist => watchlist.id !== id));

    // Update active watchlist if needed
    if (activeWatchlistId === id) {
      const defaultWatchlist = getDefaultWatchlist();
      setActiveWatchlistId(defaultWatchlist ? defaultWatchlist.id : null);
    }

    try {
      // Delete on server
      const response = await apiDeleteWatchlist(id);
      logApiOperation('deleteWatchlist', { id }, response);

      // Refresh watchlists from server to ensure sync
      await refreshWatchlists();
      return true;
    } catch (error) {
      console.error('Error deleting watchlist:', error);
      // Rollback optimistic update
      setWatchlists(prev => [...prev, deletedWatchlist]);
      if (activeWatchlistId !== id && deletedWatchlist.isDefault) {
        setActiveWatchlistId(id);
      }
      return false;
    }
  };

  // Add a company to a watchlist
  const addToWatchlist = async (company: Company, watchlistId?: string): Promise<boolean> => {
    if (!user) {
      console.error('Cannot add to watchlist: User not authenticated');
      return false;
    }

    const targetWatchlistId = watchlistId || activeWatchlistId || getDefaultWatchlist()?.id;
    if (!targetWatchlistId) {
      console.error('Cannot add to watchlist: No target watchlist specified or found.');
      return false;
    }

    const targetWatchlist = getWatchlistById(targetWatchlistId);
    if (!targetWatchlist) {
      console.error('Cannot add to watchlist: Target watchlist not found in state.');
      return false;
    }

    // Ensure we have an ISIN
    if (!company.isin) {
      console.error('Cannot add to watchlist: Company is missing ISIN.');
      return false;
    }

    // Check if already in watchlist
    if (targetWatchlist.companies.some(c => c.isin === company.isin)) {
      console.log('Company already in watchlist, skipping add.');
      return false;
    }

    // Prepare company object with ISIN as id
    const companyToAdd: Company = { ...company, id: company.isin };

    // Optimistic update
    setWatchlists(prev =>
      prev.map(watchlist => {
        if (watchlist.id === targetWatchlistId) {
          return {
            ...watchlist,
            companies: [...watchlist.companies, companyToAdd]
          };
        }
        return watchlist;
      })
    );

    try {
      // Add to server
      const response = await apiAddToWatchlist(company.isin, targetWatchlistId);
      logApiOperation('addToWatchlist', { isin: company.isin, watchlist_id: targetWatchlistId }, response);

      // Refresh from server
      await refreshWatchlists();
      return true;
    } catch (error) {
      console.error('Error adding to watchlist:', error);
      // Rollback optimistic update
      setWatchlists(prev =>
        prev.map(watchlist => {
          if (watchlist.id === targetWatchlistId) {
            return {
              ...watchlist,
              companies: watchlist.companies.filter(c => c.isin !== company.isin)
            };
          }
          return watchlist;
        })
      );
      return false;
    }
  };

  // Remove a company from a watchlist
  const removeFromWatchlist = async (companyId: string, watchlistId?: string): Promise<boolean> => {
    if (!user) {
      console.error('Cannot remove from watchlist: User not authenticated');
      return false;
    }

    const targetWatchlistId = watchlistId || activeWatchlistId || getDefaultWatchlist()?.id;
    if (!targetWatchlistId) {
      console.error('Cannot remove from watchlist: No target watchlist specified or found.');
      return false;
    }

    const targetWatchlist = getWatchlistById(targetWatchlistId);
    if (!targetWatchlist) {
      console.error('Cannot remove from watchlist: Target watchlist not found in state.');
      return false;
    }

    // Find the company by ID (which could be ISIN)
    const companyToRemove = targetWatchlist.companies.find(c => c.id === companyId || c.isin === companyId);
    if (!companyToRemove) {
      console.warn(`Company with ID ${companyId} not found in watchlist ${targetWatchlist.name}.`);
      return false;
    }

    // Ensure we have an ISIN
    const isin = companyToRemove.isin;
    if (!isin) {
      console.error(`Company with ID ${companyId} is missing ISIN, cannot remove from server.`);
      return false;
    }

    // Optimistic update
    setWatchlists(prev =>
      prev.map(watchlist => {
        if (watchlist.id === targetWatchlistId) {
          return {
            ...watchlist,
            companies: watchlist.companies.filter(c => c.id !== companyId && c.isin !== companyId)
          };
        }
        return watchlist;
      })
    );

    try {
      // Remove from server
      const response = await apiRemoveFromWatchlist(isin, targetWatchlistId);
      logApiOperation('removeFromWatchlist', { isin, watchlist_id: targetWatchlistId }, response);

      // Refresh from server
      await refreshWatchlists();
      return true;
    } catch (error) {
      console.error('Error removing from watchlist:', error);
      // Rollback optimistic update
      setWatchlists(prev =>
        prev.map(watchlist => {
          if (watchlist.id === targetWatchlistId) {
            // Add back only if it's not already back
            if (!watchlist.companies.some(c => c.id === companyToRemove.id)) {
              return {
                ...watchlist,
                companies: [...watchlist.companies, companyToRemove]
              };
            }
          }
          return watchlist;
        })
      );
      return false;
    }
  };

  // Remove multiple companies from a watchlist
  const removeMultipleFromWatchlist = async (companyIds: string[], watchlistId?: string): Promise<boolean> => {
    if (!user) {
      console.error('Cannot remove multiple: User not authenticated');
      return false;
    }

    const targetWatchlistId = watchlistId || activeWatchlistId || getDefaultWatchlist()?.id;
    if (!targetWatchlistId) {
      console.error('Cannot remove multiple: No target watchlist specified or found.');
      return false;
    }

    console.log(`Removing multiple companies (${companyIds.length}) from watchlist ${targetWatchlistId}`);

    // Use Promise.all to wait for all removals
    try {
      const results = await Promise.all(
        companyIds.map(id => removeFromWatchlist(id, targetWatchlistId))
      );
      
      // Consider successful if all operations were successful
      return results.every(Boolean);
    } catch (error) {
      console.error('Error removing multiple companies:', error);
      return false;
    }
  };

  // Clear all companies from a watchlist
  const clearWatchlist = async (watchlistId?: string): Promise<boolean> => {
    if (!user) {
      console.error('Cannot clear watchlist: User not authenticated');
      return false;
    }

    const targetWatchlistId = watchlistId || activeWatchlistId || getDefaultWatchlist()?.id;
    if (!targetWatchlistId) {
      console.error('Cannot clear watchlist: No target watchlist specified or found.');
      return false;
    }

    const watchlistToClear = getWatchlistById(targetWatchlistId);
    if (!watchlistToClear) {
      console.error('Cannot clear watchlist: Target watchlist not found in state.');
      return false;
    }

    // Store current items for potential rollback
    const currentCompanies = [...watchlistToClear.companies];

    // Optimistic update
    setWatchlists(prev =>
      prev.map(watchlist =>
        watchlist.id === targetWatchlistId
          ? { ...watchlist, companies: [] }
          : watchlist
      )
    );

    try {
      // Clear on server
      const response = await apiClearWatchlist(targetWatchlistId);
      logApiOperation('clearWatchlist', { watchlist_id: targetWatchlistId }, response);

      // Refresh from server
      await refreshWatchlists();
      return true;
    } catch (error) {
      console.error('Error clearing watchlist:', error);
      // Rollback optimistic update
      setWatchlists(prev =>
        prev.map(watchlist =>
          watchlist.id === targetWatchlistId
            ? { ...watchlist, companies: currentCompanies }
            : watchlist
        )
      );
      return false;
    }
  };

  // Bulk add companies to a watchlist
  const bulkAddToWatchlist = async (companies: Company[], watchlistId?: string): Promise<number> => {
    if (!companies || companies.length === 0 || !user) {
      console.log('Bulk add skipped: No companies, or user not authenticated.');
      return 0;
    }

    const targetWatchlistId = watchlistId || activeWatchlistId || getDefaultWatchlist()?.id;
    if (!targetWatchlistId) {
      console.error('Cannot bulk add: No target watchlist specified or found.');
      return 0;
    }

    const targetWatchlist = getWatchlistById(targetWatchlistId);
    if (!targetWatchlist) {
      console.error('Cannot bulk add: Target watchlist not found in state.');
      return 0;
    }

    // Filter out companies missing ISINs
    const validCompanies = companies.filter(company => !!company.isin);
    if (validCompanies.length === 0) {
      console.error('No valid ISINs found in companies to bulk add.');
      return 0;
    }

    // Filter out companies that are already in the watchlist
    const companiesToAdd = validCompanies.filter(company =>
      !targetWatchlist.companies.some(c => c.isin === company.isin)
    );

    if (companiesToAdd.length === 0) {
      console.log('Bulk add skipped: All companies already in watchlist.');
      return 0;
    }

    // Extract ISINs for the API call
    const isinsToAdd = companiesToAdd.map(c => c.isin);

    // Optimistic update
    setWatchlists(prev =>
      prev.map(watchlist => {
        if (watchlist.id === targetWatchlistId) {
          // Add the new companies to the watchlist
          const companiesWithId = companiesToAdd.map(company => ({
            ...company,
            id: company.isin
          }));
          return {
            ...watchlist,
            companies: [...watchlist.companies, ...companiesWithId]
          };
        }
        return watchlist;
      })
    );

    try {
      // Bulk add to server - use the dedicated bulk_add endpoint
      const response = await apiBulkAddToWatchlist(targetWatchlistId, isinsToAdd);
      logApiOperation('bulkAddToWatchlist', { watchlist_id: targetWatchlistId, isins: isinsToAdd }, response);

      // Refresh from server to ensure up-to-date data
      await refreshWatchlists();
      
      // Return the number of successfully added companies
      return typeof response === 'number' ? response : companiesToAdd.length;
    } catch (error) {
      console.error('Error in bulk add operation:', error);
      // Rollback optimistic update by removing the added companies
      setWatchlists(prev =>
        prev.map(watchlist => {
          if (watchlist.id === targetWatchlistId) {
            const isinSet = new Set(isinsToAdd);
            return {
              ...watchlist,
              companies: watchlist.companies.filter(c => !isinSet.has(c.isin))
            };
          }
          return watchlist;
        })
      );
      return 0;
    }
  };

  // Check if a company is in a watchlist
  const isWatched = (companyId: string, watchlistId?: string): boolean => {
    if (watchlistId) {
      const watchlist = getWatchlistById(watchlistId);
      return !!watchlist?.companies.some(company => 
        company.id === companyId || company.isin === companyId
      );
    }

    // If no watchlistId is provided, check all watchlists
    return watchlists.some(watchlist =>
      watchlist.companies.some(company => 
        company.id === companyId || company.isin === companyId
      )
    );
  };

  return (
    <WatchlistContext.Provider
      value={{
        watchlists,
        activeWatchlistId,
        setActiveWatchlistId,
        createWatchlist,
        renameWatchlist,
        deleteWatchlist,
        addToWatchlist,
        removeFromWatchlist,
        removeMultipleFromWatchlist,
        clearWatchlist,
        bulkAddToWatchlist,
        isWatched,
        getWatchlistById,
        getDefaultWatchlist,
        isLoading,
        refreshWatchlists
      }}
    >
      {children}
    </WatchlistContext.Provider>
  );
};

export const useWatchlist = () => {
  const context = useContext(WatchlistContext);
  if (context === undefined) {
    throw new Error('useWatchlist must be used within a WatchlistProvider');
  }
  return context;
};