import React, { useState, useEffect, useRef } from 'react';
import { Search, Plus, Check, Briefcase, Loader } from 'lucide-react';
import axios from 'axios';
import { Company } from '../../api';
import { useWatchlist } from '../../context/WatchlistContext';

interface CompanySearchProps {
  onCompanySelected?: (company: Company) => void;
  placeholder?: string;
  className?: string;
  watchlistId?: string;
}

// Interface to match the actual API response structure
interface CompanySearchResult {
  ISIN?: string;
  isin?: string;
  NewName?: string;
  newname?: string;
  OldName?: string;
  oldname?: string;
  NewNSEcode?: string;
  newnsecode?: string;
  OldNSEcode?: string;
  oldnsecode?: string;
  industry?: string;
}

const CompanySearch: React.FC<CompanySearchProps> = ({ 
  onCompanySelected, 
  placeholder = "Search companies...",
  className = "",
  watchlistId
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [refreshKey, setRefreshKey] = useState(0);
  
  const { addToWatchlist, isWatched } = useWatchlist();
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Search for companies when the search term changes
  useEffect(() => {
    const searchCompanies = async () => {
      if (searchTerm.length < 2) {
        setSearchResults([]);
        return;
      }
      
      setIsLoading(true);
      try {
        console.log(`Searching for companies with term: ${searchTerm}`);
        
        // Use the correct endpoint from the documentation
        const response = await axios.get(`/api/company/search?q=${encodeURIComponent(searchTerm)}`);
        console.log('Search response:', response.data);
        
        // Check if companies data exists in expected format
        if (!response.data.companies) {
          console.error('Unexpected API response format:', response.data);
          setSearchResults([]);
          return;
        }
        
        // Transform the response data to match Company type - handle both camelCase and PascalCase
        const companies: Company[] = response.data.companies.map((item: CompanySearchResult) => ({
          id: item.ISIN || item.isin || `temp-${Date.now()}-${Math.random()}`,
          symbol: item.NewNSEcode || item.newnsecode || item.OldNSEcode || item.oldnsecode || '',
          name: item.NewName || item.newname || item.OldName || item.oldname || '',
          isin: item.ISIN || item.isin || '',
          industry: item.industry || ''
        }));
        
        console.log('Transformed companies:', companies);
        setSearchResults(companies);
        setHighlightedIndex(-1); // Reset highlighted index when results change
      } catch (error) {
        console.error('Error searching for companies:', error);
        setSearchResults([]);
      } finally {
        setIsLoading(false);
      }
    };
    
    const debounceTimer = setTimeout(searchCompanies, 300);
    return () => clearTimeout(debounceTimer);
  }, [searchTerm, refreshKey]);
  
  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!showResults) return;
      
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setHighlightedIndex(prev => 
            prev < searchResults.length - 1 ? prev + 1 : prev
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setHighlightedIndex(prev => (prev > 0 ? prev - 1 : prev));
          break;
        case 'Enter':
          if (highlightedIndex >= 0 && highlightedIndex < searchResults.length) {
            handleCompanyClick(searchResults[highlightedIndex]);
          }
          break;
        case 'Escape':
          setShowResults(false);
          break;
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showResults, highlightedIndex, searchResults]);
  
  // Update this function in your CompanySearch.tsx
const handleAddToWatchlist = async (company: Company, e: React.MouseEvent) => {
  e.stopPropagation();
  
  console.log('Adding company to watchlist:', company);
  console.log('Target watchlist ID:', watchlistId);
  
  if (!company.isin) {
    console.error('Cannot add company without ISIN');
    return;
  }
  
  if (!watchlistId) {
    console.error('Cannot add company: No watchlist ID provided');
    return;
  }
  
  try {
    // Get the authentication token from localStorage
    const token = localStorage.getItem('authToken');
    
    if (!token) {
      console.error('Authentication token not found - user may need to login again');
      return;
    }
    
    // Use direct API call with the exact format the server expects AND proper authentication
    const requestData = {
      operation: 'add_isin',
      watchlist_id: watchlistId,
      isin: company.isin
    };
    
    console.log('Sending request to add to watchlist:', requestData);
    
    // Include the Authorization header
    const response = await axios.post('/api/watchlist', requestData, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Server response:', response.data);
    
    // Now also call the context method (which should already handle authentication internally)
    try {
      const result = await addToWatchlist(company, watchlistId);
      console.log('Context method result:', result);
    } catch (contextError) {
      console.error('Error calling context method:', contextError);
      // If context method fails but direct API call succeeded, we still consider it a success
    }
    
    // Force component to re-render
    setRefreshKey(prev => prev + 1);
    
    // Show success message to user
    // You can use a toast library or any notification method you prefer
    alert('Company added to watchlist successfully!');
    
    // Also force search results to update
    if (searchTerm) {
      setSearchTerm(prev => {
        const temp = prev + ' ';
        setTimeout(() => setSearchTerm(prev), 10);
        return temp;
      });
    }
  } catch (error) {
    console.error('Error adding company to watchlist:', error);
    
    // Get more detailed error information
    if (axios.isAxiosError(error) && error.response) {
      console.error('Server returned error:', error.response.status, error.response.data);
      
      // Handle specific error cases
      if (error.response.status === 401) {
        alert('Your session has expired. Please login again.');
      } else if (error.response.status === 409) {
        alert('This company is already in your watchlist.');
      } else {
        alert(`Failed to add company: ${error.response.data?.message || 'Unknown error'}`);
      }
    } else {
      alert('Failed to add company to watchlist. Please try again.');
    }
  }
};
  // Check if a company is already in the current watchlist
  const isCompanyInWatchlist = (companyId: string): boolean => {
    return isWatched(companyId, watchlistId);
  };
  
  // Get a color for category/industry
  const getCategoryColor = (industry: string) => {
    const colors = {
      'Technology': 'bg-blue-100 text-blue-800',
      'Automotive': 'bg-green-100 text-green-800',
      'Financial': 'bg-amber-100 text-amber-800',
      'Healthcare': 'bg-rose-100 text-rose-800',
      'Energy': 'bg-purple-100 text-purple-800',
      'Consumer': 'bg-teal-100 text-teal-800',
      'Industrial': 'bg-indigo-100 text-indigo-800',
      'Materials': 'bg-orange-100 text-orange-800',
      'Utilities': 'bg-sky-100 text-sky-800',
      'Real Estate': 'bg-emerald-100 text-emerald-800',
      'Telecommunication': 'bg-violet-100 text-violet-800'
    };
    
    for (const [key, value] of Object.entries(colors)) {
      if (industry.toLowerCase().includes(key.toLowerCase())) {
        return value;
      }
    }
    
    return 'bg-gray-100 text-gray-800';
  };
  
  return (
    <div className={`relative ${className}`} ref={searchRef}>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:bg-white transition-all"
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setShowResults(true);
          }}
          onFocus={() => setShowResults(true)}
        />
        <Search className="absolute left-3.5 top-2.5 text-gray-400" size={16} />
      </div>
      
      {/* Search Results Dropdown */}
      {showResults && (searchTerm.length >= 2) && (
        <div className="absolute mt-2 w-full bg-white rounded-xl shadow-lg border border-gray-100 z-30 overflow-hidden">
          {isLoading ? (
            <div className="p-6 text-center text-sm text-gray-500">
              <Loader size={24} className="animate-spin mx-auto mb-2 text-indigo-500" />
              <p>Searching for companies...</p>
            </div>
          ) : searchResults.length === 0 ? (
            <div className="p-6 text-center text-sm text-gray-500">
              <Briefcase size={24} className="mx-auto mb-2 text-gray-300" />
              <p>No companies found</p>
              <p className="text-xs mt-1 text-gray-400">Try a different search term</p>
            </div>
          ) : (
            <ul className="max-h-72 overflow-y-auto divide-y divide-gray-50">
              {searchResults.map((company, index) => {
                const isInCurrentWatchlist = isCompanyInWatchlist(company.id);
                
                return (
                  <li 
                    key={company.id}
                    className={`hover:bg-gray-50 cursor-pointer transition-colors ${highlightedIndex === index ? 'bg-indigo-50' : ''}`}
                    onClick={() => handleCompanyClick(company)}
                    onMouseEnter={() => setHighlightedIndex(index)}
                  >
                    <div className="p-3.5 flex justify-between items-center">
                      <div className="min-w-0 flex-1 pr-4">
                        <div className="font-medium text-gray-900 truncate">{company.name}</div>
                        <div className="flex items-center space-x-2 mt-0.5">
                          <span className="text-xs font-semibold bg-gray-100 text-gray-800 px-2 py-0.5 rounded-md">{company.symbol}</span>
                          {company.isin && (
                            <span className="text-xs font-medium bg-blue-50 text-blue-800 px-2 py-0.5 rounded-md">
                              ISIN: {company.isin}
                            </span>
                          )}
                          {company.industry && (
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-md truncate ${getCategoryColor(company.industry)}`}>
                              {company.industry}
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        className={`p-1.5 rounded-lg flex-shrink-0 ${
                          isInCurrentWatchlist 
                            ? 'bg-indigo-600 text-white' 
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        } transition-colors`}
                        onClick={(e) => handleAddToWatchlist(company, e)}
                        title={isInCurrentWatchlist ? "Added to watchlist" : "Add to watchlist"}
                      >
                        {isInCurrentWatchlist ? (
                          <Check size={16} />
                        ) : (
                          <Plus size={16} />
                        )}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default CompanySearch;