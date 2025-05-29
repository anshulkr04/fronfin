// src/api.ts - Complete API implementation with enhanced date handling, socket management, and watchlist integration
// Updated to match server API response structures as documented in the README

import axios from 'axios';
import { io, Socket } from 'socket.io-client';
import { sortByNewestDate } from './utils/dateUtils';

// Determine the correct API base URL based on environment
const getBaseUrl = () => {
  // In development, use the backend port directly
  if (process.env.NODE_ENV === 'development') {
    return 'http://164.52.192.163/api';
  }
  // In production, use the relative path which will be handled by the server
  return '/api';
};

// Create a reusable axios instance with base configuration
const apiClient = axios.create({
    baseURL: getBaseUrl(),
    headers: {
      'Content-Type': 'application/json',
    },
    // Add timeout to prevent hanging requests
    timeout: 30000,
});

// Fix the auth interceptor
apiClient.interceptors.request.use(
  (config) => {
      const token = localStorage.getItem('authToken');
      
      if (token) {
          // Add token to authorization header
          config.headers['Authorization'] = `Bearer ${token}`;
      }
      
      // Log the request in development
      if (process.env.NODE_ENV === 'development') {
        console.log(`[API] ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`);
      }
      
      return config;
  },
  (error) => {
      return Promise.reject(error);
  }
);

// Add response interceptor for better error debugging and 401 handling
apiClient.interceptors.response.use(
    (response) => {
        return response;
    },
    (error) => {
        if (error.response) {
            console.error(`[API] Error response: ${error.response.status} for ${error.config?.method?.toUpperCase()} ${error.config?.url}`);
            
            // Handle 401 errors specially
            if (error.response.status === 401) {
                console.error('[API] Authentication error - Token might be invalid or expired');
                // Optional: Redirect to login page or trigger a re-authentication flow
                // window.location.href = '/auth/login'; // Example: Redirect to login
                
                // Clear the invalid token
                localStorage.removeItem('authToken');
            }
        } else if (error.request) {
            // The request was made but no response was received
            console.error('[API] No response received from server:', error.request);
        } else {
            // Something happened in setting up the request that triggered an Error
            console.error('[API] Error setting up request:', error.message);
        }
        
        // Reject the promise so the calling code can handle the error
        return Promise.reject(error);
    }
);

// Type definitions matching server API responses
export interface Company {
  newname?: string;
  oldname?: string;
  newnsecode?: string;
  oldnsecode?: string;
  newbsecode?: string;
  oldbsecode?: string;
  isin: string;
  industry?: string;
}

export interface Filing {
  id?: string;
  Symbol?: string;
  symbol?: string;
  ISIN?: string;
  isin?: string;
  Category?: string;
  category?: string;
  summary?: string;
  ai_summary?: string;
  fileurl?: string;
  url?: string;
  date?: string;
  created_at?: string;
  companyname?: string;
  corp_id?: string;
}

export interface ProcessedAnnouncement {
  id: string;
  companyId?: string;
  company: string;
  ticker: string;
  industry?: string;
  category: string;
  sentiment?: string;
  date: string; // Original ISO format date for sorting
  displayDate?: string; // Formatted date for display
  summary: string;
  detailedContent: string;
  url?: string;
  fileType?: string;
  isin?: string;
  receivedAt?: number;
  isNew?: boolean;
}

// Define watchlist interfaces to match the backend structure
export interface Watchlist {
  _id: string;
  watchlistName: string;
  category?: string;
  isin: string[];
}

export interface WatchlistResponse {
  watchlists: Watchlist[];
  message?: string;
}

// API Response interfaces matching server documentation
export interface AuthResponse {
  message: string;
  user_id?: string;
  token: string;
}

export interface CorporateFilingsResponse {
  count: number;
  filings: Filing[];
}

export interface CompanySearchResponse {
  count: number;
  companies: Company[];
}

export interface StockPriceData {
  close: number;
  date: string;
}

export interface BulkAddResponse {
  message: string;
  successful: string[];
  duplicates: string[];
  failed: string[];
  watchlist: Watchlist;
}

// Define interfaces for API data items based on server documentation
interface RawApiDataItem {
  // Primary identifiers
  id?: string;
  corp_id?: string;
  
  // Company and security identifiers
  Symbol?: string;
  symbol?: string;
  ISIN?: string;
  isin?: string;
  companyname?: string;
  
  // Category information
  Category?: string;
  category?: string;
  
  // Content fields
  summary?: string;
  ai_summary?: string;
  
  // Date fields
  date?: string;
  created_at?: string;
  
  // File/URL fields
  fileurl?: string;
  url?: string;
  
  // Real-time and status fields
  receivedAt?: number;
  isNew?: boolean;
  is_fresh?: boolean;
}

// interface IsinsCheckItem {
//   ISIN?: string;
//   isin?: string;
//   sm_isin?: string;
// }

// Date utilities for consistent handling throughout the application

/**
 * Formats a date string into a readable format
 * Handles ISO-format dates like "2025-05-17T13:15:02"
 */
export function formatDate(dateString: string): string {
  try {
    if (!dateString) return "Unknown Date";
    
    // Handle ISO format
    const date = new Date(dateString);
    
    // Check if date is valid
    if (!isNaN(date.getTime())) {
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
    
    // Fallback - return original string if parsing fails
    return dateString;
  } catch (e) {
    console.error(`Error formatting date: ${dateString}`, e);
    return dateString;
  }
}

/**
 * Returns a relative time string (e.g., "2 hours ago")
 */
export function getRelativeTimeString(dateString: string): string {
  try {
    const date = new Date(dateString);
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return "Unknown date";
    }
    
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);
    
    // Return appropriate time string
    if (diffSec < 60) {
      return "Just now";
    } else if (diffMin < 60) {
      return `${diffMin} ${diffMin === 1 ? 'minute' : 'minutes'} ago`;
    } else if (diffHour < 24) {
      return `${diffHour} ${diffHour === 1 ? 'hour' : 'hours'} ago`;
    } else if (diffDay < 7) {
      return `${diffDay} ${diffDay === 1 ? 'day' : 'days'} ago`;
    } else {
      // For older dates, return the formatted date
      return formatDate(dateString);
    }
  } catch (e) {
    console.error(`Error calculating relative time: ${dateString}`, e);
    return "Unknown date";
  }
}

/**
 * Sorts an array of announcements by date (newest first)
 */
export function sortAnnouncementsByDate(announcements: ProcessedAnnouncement[]): ProcessedAnnouncement[] {
  return [...announcements].sort((a, b) => {
    // First sort by receivedAt timestamp if available (for real-time announcements)
    if (a.receivedAt && b.receivedAt) {
      const diff = b.receivedAt - a.receivedAt;
      if (diff !== 0) return diff;
    }
    
    // Then sort by the date field - parse dates properly
    try {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      
      // Handle invalid dates
      if (isNaN(dateA) && isNaN(dateB)) return 0;
      if (isNaN(dateA)) return 1;
      if (isNaN(dateB)) return -1;
      
      return dateB - dateA; // Newest first
    } catch (e) {
      console.error("Error comparing dates:", e);
      return 0;
    }
  });
}

// Extract a headline from summary text
export function extractHeadline(text: string): string {
  if (!text) return '';
  
  // First approach: Look for the first sentence that ends with a period
  const firstSentenceMatch = text.match(/^([^.!?]+[.!?])/);
  if (firstSentenceMatch && firstSentenceMatch[1]) {
    return firstSentenceMatch[1].trim();
  }
  
  // Second approach: Just take the first line if it's not too long
  const firstLineMatch = text.match(/^([^\n]+)/);
  if (firstLineMatch && firstLineMatch[1] && firstLineMatch[1].length < 100) {
    return firstLineMatch[1].trim();
  }
  
  // Third approach: Take up to 100 characters from the beginning
  return text.substring(0, 100).trim() + (text.length > 100 ? '...' : '');
}

// // Extract ISIN from various possible fields
// function extractIsin(item: IsinsCheckItem): string {
//   if (!item) return "";
  
//   if (item.ISIN) return item.ISIN;
//   if (item.isin) return item.isin;
//   if (item.sm_isin) return item.sm_isin;
  
//   return "";
// }

// Enhanced extraction of category, headline, and structured content from announcement text
export const enhanceAnnouncementData = (announcements: ProcessedAnnouncement[]): ProcessedAnnouncement[] => {
  return announcements.map(announcement => {
    let summary = announcement.summary || '';
    let category = announcement.category;
    let detailedContent = announcement.detailedContent || '';
    
    // Use improved regex pattern for category extraction - fixed escape characters
    const categoryMatch = summary.match(/\*\*Category:\*\*\s*([A-Za-z0-9\s&/\-()]+)/i);
    if (categoryMatch && categoryMatch[1]) {
      category = categoryMatch[1].trim();
    } else {
      // Try to determine category based on content if not explicitly marked
      if (!category || category === "Other") {
        if (summary.match(/dividend|payout|distribution/i)) {
          category = "Dividend";
        } else if (summary.match(/financial|results|quarter|profit|revenue|earning/i)) {
          category = "Financial Results";
        } else if (summary.match(/merger|acquisition|acqui|takeover/i)) {
          category = "Mergers & Acquisitions";
        } else if (summary.match(/board|director|appoint|management/i)) {
          category = "Board Meeting";
        } else if (summary.match(/AGM|annual general meeting/i)) {
          category = "AGM";
        }
      }
    }
    
    // Extract and parse headline from content with improved regex - fixed escape characters
    let headline = '';
    const headlineMatch = summary.match(/\*\*Headline:\*\*\s*(.*?)(?=\s*(?:\*\*|##|$))/is);
    if (headlineMatch && headlineMatch[1]) {
      headline = headlineMatch[1].trim().replace(/\n+/g, ' '); // Clean up multi-line headlines
    } else {
      // Fallback method: extract first sentence
      const cleanSummary = summary
        .replace(/\*\*Category:\*\*.*?(?=\*\*|$)/is, '')
        .trim();
      
      const firstSentenceMatch = cleanSummary.match(/^([^.!?]+[.!?])/);
      
      if (firstSentenceMatch && firstSentenceMatch[1]) {
        headline = firstSentenceMatch[1].trim();
      } else {
        headline = cleanSummary.substring(0, 80) + (cleanSummary.length > 80 ? '...' : '');
      }
    }
    
    // Format the summary as structured markdown if it's not already
    if (!summary.includes("**Category:**") && !summary.includes("**Headline:**")) {
      // Restructure the summary into a more standard format
      const structuredSummary = `**Category:** ${category}\n**Headline:** ${headline}\n\n${summary}`;
      summary = structuredSummary;
      
      // Also enhance the detailed content if it's identical to the summary
      if (detailedContent === announcement.summary) {
        detailedContent = structuredSummary;
      }
    }
    
    // Parse out the sentiment more accurately if possible
    let sentiment = announcement.sentiment || "Neutral";
    
    if (summary.match(/increase|growth|higher|positive|improvement|grow|up|rise|benefit|profit|success/i)) {
      sentiment = "Positive";
    } else if (summary.match(/decrease|decline|lower|negative|drop|down|fall|loss|concern|risk|adverse/i)) {
      sentiment = "Negative";
    }
    
    // Format date for display
    const displayDate = announcement.displayDate || formatDate(announcement.date);
    
    return {
      ...announcement,
      category,
      sentiment,
      summary,
      detailedContent,
      displayDate
    };
  });
};

// Process and flatten the announcement data from the API
export const processAnnouncementData = (data: RawApiDataItem[]): ProcessedAnnouncement[] => {
  if (!data || !Array.isArray(data) || data.length === 0) {
    return generateTestData(3);
  }
  
  const processedData: ProcessedAnnouncement[] = [];
  const seenIds = new Set<string>(); // Track IDs to prevent duplicates
  
  data.forEach((item, index) => {
    // Generate a unique ID for deduplication - use server fields
    const id = item.id || item.corp_id || `filing-${index}-${Date.now()}`;
    
    // Skip if we've already processed this ID
    if (seenIds.has(id)) {
      console.log(`Skipping duplicate announcement with ID: ${id}`);
      return;
    }
    
    seenIds.add(id);
    
    // Extract important fields from server API response
    const isin = item.ISIN || item.isin || "";
    const companyName = item.companyname || "Unknown Company";
    
    // Handle both Symbol and symbol fields from API
    const ticker = item.Symbol || item.symbol || "";
    
    // Use the correct category field - prioritize proper casing from API
    const category = item.Category || item.category || "Other";
    
    // Get the summary from available fields - prioritize ai_summary as per API docs
    let summary = "";
    if (item.ai_summary) {
      summary = item.ai_summary;
    } else if (item.summary) {
      summary = item.summary;
    } else {
      summary = `**Category:** ${category}\n**Headline:** New Announcement\n\nAnnouncement for ${companyName}`;
    }
    
    // Get the date from available fields
    const originalDate = item.date || item.created_at || new Date().toISOString();
    
    // Format date for display - handle ISO format properly
    const formattedDate = formatDate(originalDate);
    
    // Determine sentiment based on content analysis
    let sentiment = "Neutral";
    if (summary.match(/increase|growth|higher|positive|improvement|grow|up|rise|benefit|profit|success/i)) {
      sentiment = "Positive";
    } else if (summary.match(/decrease|decline|lower|negative|drop|down|fall|loss|concern|risk|adverse/i)) {
      sentiment = "Negative";
    }
    
    // Get URL for attachments - handle both fileurl and url fields
    const url = item.fileurl || item.url;
    
    processedData.push({
      id: id,
      company: companyName,
      ticker: ticker,
      category: category,
      sentiment: sentiment,
      date: originalDate, // Store original date for sorting
      displayDate: formattedDate, // Add formatted date for display
      summary: summary,
      detailedContent: summary,
      url: url,
      isin: isin,
      receivedAt: item.receivedAt || Date.now(),
      isNew: !!item.isNew || !!item.is_fresh // Ensure isNew is a boolean
    });
  });
  
  // If no data was processed, add test data
  if (processedData.length === 0) {
    return generateTestData(3);
  }
  
  // Sort by date properly
  return sortAnnouncementsByDate(processedData);
};

// Generate test data for development
const generateTestData = (count: number): ProcessedAnnouncement[] => {
  const testData: ProcessedAnnouncement[] = [];
  const categories = ["Financial Results", "Dividend", "Mergers & Acquisitions", "Board Meeting", "AGM"];
  const sentiments = ["Positive", "Negative", "Neutral"];
  
  for (let i = 0; i < count; i++) {
    const categoryIndex = i % categories.length;
    const sentimentIndex = i % sentiments.length;
    const category = categories[categoryIndex];
    
    // Create more realistic test data with formatting
    const headline = `Test Announcement ${i+1} for ${category}`;
    const summary = `**Category:** ${category}\n**Headline:** ${headline}\n\nThis is a test announcement ${i+1} for debugging purposes.`;
    
    const now = new Date();
    const date = new Date(now.getTime() - (i * 3600000)); // Each test item 1 hour apart
    const isoDate = date.toISOString();
    
    testData.push({
      id: `test-${i}-${Date.now()}`,
      company: `Test Company ${i + 1}`,
      ticker: `TC${i+1}`,
      category: categories[categoryIndex],
      sentiment: sentiments[sentimentIndex],
      date: isoDate, // Store ISO date for sorting
      displayDate: formatDate(isoDate), // Format for display
      summary: summary,
      detailedContent: `${summary}\n\n## Additional Details\n\nThis is a detailed content for test announcement ${i+1}.`,
      isin: `TEST${i}1234567890`,
      receivedAt: now.getTime() - (i * 3600000)
    });
  }
  
  return testData;
};

// Fetch announcements from the server with improved error handling
export const fetchAnnouncements = async (fromDate: string = '', toDate: string = '', category: string = '') => {
  // Format dates as YYYY-MM-DD if not already
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  
  if (!dateRegex.test(fromDate)) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    fromDate = thirtyDaysAgo.toISOString().split('T')[0];
  }
  
  if (!dateRegex.test(toDate)) {
    const today = new Date();
    toDate = today.toISOString().split('T')[0];
  }
  
  // Build URL with proper parameters
  let url = `/corporate_filings?start_date=${fromDate}&end_date=${toDate}`;
  if (category) {
    url += `&category=${encodeURIComponent(category)}`;
  }
  
  try {
    console.log(`Fetching announcements: ${url}`);
    
    // Add a timeout to prevent hanging requests
    const response = await apiClient.get<CorporateFilingsResponse>(url, { timeout: 10000 });
    
    console.log(`Announcements response status:`, response.status);
    console.log(`Response data:`, response.data);
    
    let processedData: ProcessedAnnouncement[] = [];
    
    if (response.data && response.data.filings && Array.isArray(response.data.filings)) {
      console.log(`Received ${response.data.filings.length} filings from API`);
      processedData = processAnnouncementData(response.data.filings);
    } else if (Array.isArray(response.data)) {
      // Fallback for direct array response
      console.log(`Received ${response.data.length} filings in array format`);
      processedData = processAnnouncementData(response.data);
    } else {
      console.warn('No filings data found in response, falling back to test data');
      processedData = generateTestData(3);
    }
    
    // Apply the enhancement to ensure all fields are properly formatted
    const enhancedData = enhanceAnnouncementData(processedData);
    
    // Make sure newest are first by sorting again
    return sortByNewestDate(enhancedData);
    
  } catch (error) {
    console.error("Error fetching announcements:", error);
    
    // Try the fallback endpoint if the main one fails
    try {
      console.log("Trying fallback test endpoint...");
      const fallbackResponse = await apiClient.get<CorporateFilingsResponse>('/test_corporate_filings');
      if (fallbackResponse.data && fallbackResponse.data.filings) {
        return enhanceAnnouncementData(processAnnouncementData(fallbackResponse.data.filings));
      }
    } catch (fallbackError) {
      console.error("Fallback also failed:", fallbackError);
    }
    
    // If all else fails, return test data
    console.log("Using generated test data as last resort");
    return enhanceAnnouncementData(generateTestData(3));
  }
};

// Authentication Methods
export const registerUser = async (email: string, password: string) => {
  try {
    const response = await apiClient.post<AuthResponse>('/register', { 
      email, 
      password,
      account_type: 'free' // Default account type as per README
    });
    if (response.data && response.data.token) {
      localStorage.setItem('authToken', response.data.token);
    }
    return response.data;
  } catch (error) {
    console.error("Registration error:", error);
    throw error;
  }
};

export const loginUser = async (email: string, password: string) => {
  try {
    const response = await apiClient.post<AuthResponse>('/login', { email, password });
    if (response.data && response.data.token) {
      localStorage.setItem('authToken', response.data.token);
    }
    return response.data;
  } catch (error) {
    console.error("Login error:", error);
    throw error;
  }
};

export const logoutUser = async () => {
  try {
    await apiClient.post('/logout');
    localStorage.removeItem('authToken');
    return { success: true, message: 'Logged out successfully' };
  } catch (error) {
    console.error("Logout error:", error);
    // Even if logout fails on the server, remove the token locally
    localStorage.removeItem('authToken');
    throw error;
  }
};

export const getCurrentUser = async () => {
  try {
    const response = await apiClient.get('/user');
    return response.data;
  } catch (error) {
    console.error("Error getting current user:", error);
    // Handle 401 errors
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      localStorage.removeItem('authToken');
    }
    throw error;
  }
};

// Watchlist Methods
export const getWatchlist = async () => {
  try {
    const response = await apiClient.get('/watchlist');
    return response.data as WatchlistResponse;
  } catch (error) {
    console.error("Error fetching watchlist:", error);
    throw error;
  }
};

export const createWatchlist = async (watchlistName: string) => {
  try {
    const response = await apiClient.post('/watchlist', {
      operation: 'create',
      watchlistName: watchlistName
    });
    return response.data;
  } catch (error) {
    console.error("Error creating watchlist:", error);
    throw error;
  }
};

export const addToWatchlist = async (isin: string, watchlistId: string) => {
  try {
    const response = await apiClient.post('/watchlist', {
      operation: 'add_isin',
      watchlist_id: watchlistId,
      isin: isin
    });
    return response.data;
  } catch (error) {
    console.error("Error adding to watchlist:", error);
    throw error;
  }
};

export const removeFromWatchlist = async (isin: string, watchlistId: string) => {
  try {
    const response = await apiClient.delete(`/watchlist/${watchlistId}/isin/${isin}`);
    return response.data;
  } catch (error) {
    console.error("Error removing from watchlist:", error);
    throw error;
  }
};

export const clearWatchlist = async (watchlistId: string) => {
  try {
    const response = await apiClient.post(`/watchlist/${watchlistId}/clear`);
    return response.data;
  } catch (error) {
    console.error("Error clearing watchlist:", error);
    throw error;
  }
};

export const deleteWatchlist = async (watchlistId: string) => {
  try {
    const response = await apiClient.delete(`/watchlist/${watchlistId}`);
    return response.data;
  } catch (error) {
    console.error("Error deleting watchlist:", error);
    throw error;
  }
};

// NEW METHOD: Bulk add to watchlist
export const bulkAddToWatchlist = async (watchlistId: string, isins: string[], category?: string) => {
  try {
    const response = await apiClient.post<BulkAddResponse>('/watchlist/bulk_add', {
      watchlist_id: watchlistId,
      isins: isins,
      category: category
    });
    
    console.log("Bulk add response:", response.data);
    
    // Return the response data directly - it includes successful, duplicates, failed arrays
    return response.data;
  } catch (error) {
    console.error("Error bulk adding to watchlist:", error);
    throw error;
  }
};

// NEW METHOD: Filter announcements by watchlist
export const getAnnouncementsByWatchlist = async (
  watchlistId: string, 
  fromDate: string = '', 
  toDate: string = '',
  category: string = ''
): Promise<ProcessedAnnouncement[]> => {
  try {
    // First, get the watchlist to retrieve ISINs
    const watchlistResponse = await getWatchlist();
    const watchlist = watchlistResponse.watchlists.find(wl => wl._id === watchlistId);
    
    if (!watchlist || !watchlist.isin || watchlist.isin.length === 0) {
      console.log(`No ISINs found in watchlist ${watchlistId}`);
      return [];
    }
    
    console.log(`Found ${watchlist.isin.length} ISINs in watchlist ${watchlistId}`);
    
    // Get all announcements for the date range
    const allAnnouncements = await fetchAnnouncements(fromDate, toDate, category);
    
    // Create a Set of ISINs for faster lookup
    const watchlistIsins = new Set(watchlist.isin);
    
    // Filter announcements by the ISINs in the watchlist
    const filteredAnnouncements = allAnnouncements.filter(announcement => 
      announcement.isin && watchlistIsins.has(announcement.isin)
    );
    
    console.log(`Filtered ${filteredAnnouncements.length} announcements out of ${allAnnouncements.length} total for watchlist ${watchlistId}`);
    
    // Apply enhancements and return
    return enhanceAnnouncementData(filteredAnnouncements);
  } catch (error) {
    console.error("Error getting announcements for watchlist:", error);
    return []; // Return empty array on error
  }
};

// NEW METHOD: Filter announcements by multiple watchlists
export const getAnnouncementsByMultipleWatchlists = async (
  watchlistIds: string[],
  fromDate: string = '',
  toDate: string = '',
  category: string = ''
): Promise<ProcessedAnnouncement[]> => {
  try {
    if (!watchlistIds || watchlistIds.length === 0) {
      return [];
    }
    
    // Get all watchlists
    const watchlistResponse = await getWatchlist();
    
    // Create a Set of all ISINs from the specified watchlists
    const watchlistIsins = new Set<string>();
    watchlistResponse.watchlists
      .filter(wl => watchlistIds.includes(wl._id))
      .forEach(wl => {
        if (wl.isin && Array.isArray(wl.isin)) {
          wl.isin.forEach(isin => watchlistIsins.add(isin));
        }
      });
    
    if (watchlistIsins.size === 0) {
      console.log(`No ISINs found in any of the specified watchlists`);
      return [];
    }
    
    console.log(`Found ${watchlistIsins.size} unique ISINs across ${watchlistIds.length} watchlists`);
    
    // Get all announcements for the date range
    const allAnnouncements = await fetchAnnouncements(fromDate, toDate, category);
    
    // Filter announcements by the combined set of ISINs
    const filteredAnnouncements = allAnnouncements.filter(announcement => 
      announcement.isin && watchlistIsins.has(announcement.isin)
    );
    
    console.log(`Filtered ${filteredAnnouncements.length} announcements out of ${allAnnouncements.length} total for multiple watchlists`);
    
    return enhanceAnnouncementData(filteredAnnouncements);
  } catch (error) {
    console.error("Error getting announcements for multiple watchlists:", error);
    return [];
  }
};

export const searchCompanies = async (query: string, limit?: number) => {
  try {
    let url = `/company/search?q=${encodeURIComponent(query)}`;
    if (limit) {
      url += `&limit=${limit}`;
    }
    const response = await apiClient.get<CompanySearchResponse>(url);
    return response.data.companies || [];
  } catch (error) {
    console.error("Error searching companies:", error);
    throw error;
  }
};

// Stock Price Data Methods
export const getStockPrice = async (isin: string): Promise<StockPriceData[]> => {
  try {
    if (!isin) {
      throw new Error('ISIN parameter is required');
    }
    
    const url = `/stock_price?isin=${encodeURIComponent(isin)}`;
    const response = await apiClient.get<StockPriceData[]>(url);
    
    // The API returns an array of stock price data directly
    return response.data || [];
  } catch (error) {
    console.error("Error fetching stock price:", error);
    throw error;
  }
};

// Health Check Methods
export interface HealthCheckResponse {
  status: string;
  timestamp: string;
  server: string;
  supabase_connected: boolean;
  debug_mode: boolean;
  environment: {
    supabase_url_set: boolean;
    supabase_key_set: boolean;
  };
}

export const checkHealth = async (): Promise<HealthCheckResponse> => {
  try {
    const response = await apiClient.get<HealthCheckResponse>('/health');
    return response.data;
  } catch (error) {
    console.error("Error checking server health:", error);
    throw error;
  }
};

// Advanced deduplication class for tracking already processed announcements
class AnnouncementDeduplicationCache {
  private idSet = new Set<string>();
  private contentHashSet = new Set<string>();
  private maxSize: number;

  constructor(maxSize = 1000) {
    this.maxSize = maxSize;
  }

  private generateContentHash(announcement: ProcessedAnnouncement): string {
    // Create a unique identifier based on content
    const contentParts = [
      announcement.company,
      announcement.summary?.substring(0, 100),
      announcement.date
    ].filter(Boolean);
    
    return contentParts.join('||');
  }

  public has(announcement: ProcessedAnnouncement): boolean {
    // Check by ID
    if (this.idSet.has(announcement.id)) {
      return true;
    }
    
    // Check by content hash
    const contentHash = this.generateContentHash(announcement);
    return this.contentHashSet.has(contentHash);
  }

  public add(announcement: ProcessedAnnouncement): void {
    // Add by ID
    this.idSet.add(announcement.id);
    
    // Add by content hash
    const contentHash = this.generateContentHash(announcement);
    this.contentHashSet.add(contentHash);
    
    // Prune if needed
    this.prune();
  }

  private prune(): void {
    // If we exceed max size, remove oldest entries
    // Since Sets don't have a built-in way to remove oldest entries,
    // we'll just clear half the cache if it gets too big
    if (this.idSet.size > this.maxSize) {
      const idArray = Array.from(this.idSet);
      const contentHashArray = Array.from(this.contentHashSet);
      
      // Keep the most recent half
      const keepCount = Math.floor(this.maxSize / 2);
      
      this.idSet = new Set(idArray.slice(-keepCount));
      this.contentHashSet = new Set(contentHashArray.slice(-keepCount));
    }
  }

  public clear(): void {
    this.idSet.clear();
    this.contentHashSet.clear();
  }
}

// Socket.IO connection for real-time updates
export const setupSocketConnection = (onNewAnnouncement: (data: RawApiDataItem) => void) => {
  // Determine the correct WebSocket URL based on environment
  // const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  // const host = window.location.hostname;
  // const port = process.env.NODE_ENV === 'development' ? '5001' : window.location.port;
  
  // Create the WebSocket URL that explicitly points to the backend server
  const socketUrl = "http://164.52.192.163/";
  console.log(`Connecting to WebSocket server at: ${socketUrl}`);
  
  // Create socket connection with proper configuration
  const socket: Socket = io(socketUrl, {
    path: '/socket.io', // Make sure this matches the server path
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000,
    // Force transport options to handle potential WebSocket connection issues
    transports: ['websocket', 'polling']
  });

  // Create deduplication cache
  const deduplicationCache = new AnnouncementDeduplicationCache();

  // Connection event handlers
  socket.on('connect', () => {
    console.log('Connected to WebSocket server for real-time announcements');
    // Reset the deduplication cache on new connection
    deduplicationCache.clear();
    // Dispatch custom event
    window.dispatchEvent(new Event('socket:connect'));
  });

  socket.on('disconnect', (reason) => {
    console.log('Disconnected from WebSocket server:', reason);
    window.dispatchEvent(new Event('socket:disconnect'));
    
    // If the server disconnected us, try to reconnect
    if (reason === 'io server disconnect') {
      socket.connect();
    }
  });

  socket.on('connect_error', (error) => {
    console.error('Socket connection error:', error);
    const errorEvent = new CustomEvent('socket:error', { 
      detail: { message: error.message } 
    });
    window.dispatchEvent(errorEvent);
  });

  socket.on('reconnect_attempt', (attemptNumber) => {
    console.log(`Socket reconnection attempt #${attemptNumber}`);
  });

  // Listen for new announcements with improved deduplication
  socket.on('new_announcement', (data: RawApiDataItem) => {
    console.log('Received new announcement via socket:', data);
    
    try {
      // Basic validation
      if (!data) {
        console.warn("Received empty announcement data");
        return;
      }
      
      // Process the announcement
      const processed = processAnnouncementData([data])[0];
      
      // Check for duplicates using our cache
      if (deduplicationCache.has(processed)) {
        console.log(`Skipping duplicate announcement: ${processed.id}`);
        return;
      }
      
      // Add to deduplication cache
      deduplicationCache.add(processed);
      
      // Mark as new for highlighting
      processed.isNew = true;
      
      // Pass the processed announcement to callback
      onNewAnnouncement(data);
      
      // Also dispatch a custom event
      const announcementEvent = new CustomEvent('new:announcement', { detail: processed });
      window.dispatchEvent(announcementEvent);
    } catch (error) {
      console.error('Error processing socket announcement:', error);
    }
  });

  return {
    joinRoom: (room: string) => {
      if (!room || typeof room !== 'string') {
        console.warn('Invalid room name provided to joinRoom');
        return;
      }
      
      if (socket.connected) {
        console.log(`Joining room: ${room}`);
        socket.emit('join', { room });
      } else {
        console.log(`Socket not connected, queuing room join: ${room}`);
        socket.once('connect', () => {
          console.log(`Socket connected, now joining room: ${room}`);
          socket.emit('join', { room });
        });
      }
    },
    
    leaveRoom: (room: string) => {
      if (!room || typeof room !== 'string') {
        console.warn('Invalid room name provided to leaveRoom');
        return;
      }
      
      if (socket.connected) {
        console.log(`Leaving room: ${room}`);
        socket.emit('leave', { room });
      } else {
        console.warn(`Cannot leave room ${room}: Socket not connected`);
      }
    },
    
    disconnect: () => {
      console.log('Disconnecting socket');
      socket.disconnect();
    },
    
    // Method to manually attempt reconnection
    reconnect: () => {
      if (!socket.connected) {
        console.log('Manually attempting to reconnect socket...');
        socket.connect();
      }
    },
    
    // Method to check connection status
    isConnected: () => socket.connected
  };
};

// NEW METHOD: Socket connection specifically for a watchlist
export const setupWatchlistSocketConnection = (
  watchlistId: string,
  onNewAnnouncement: (data: ProcessedAnnouncement) => void
) => {
  // Get the base socket connection
  const socketConnection = setupSocketConnection(() => {
    // We'll handle announcements via custom event listener below
  });
  
  // Create storage for the watchlist's ISINs
  let watchlistIsins = new Set<string>();
  
  // Function to refresh the ISIN list when watchlist changes
  const refreshWatchlistIsins = async () => {
    try {
      console.log(`Refreshing ISINs for watchlist ${watchlistId}...`);
      const watchlistResponse = await getWatchlist();
      const watchlist = watchlistResponse.watchlists.find(wl => wl._id === watchlistId);
      
      if (watchlist && watchlist.isin) {
        watchlistIsins = new Set(watchlist.isin);
        console.log(`Updated watchlist ISINs: ${watchlistIsins.size} ISINs found`);
      } else {
        console.warn(`Watchlist ${watchlistId} not found or has no ISINs`);
        watchlistIsins.clear();
      }
    } catch (error) {
      console.error("Error refreshing watchlist ISINs:", error);
    }
  };
  
  // Load ISINs initially
  refreshWatchlistIsins();
  
  // Custom event handler for filtering announcements by watchlist ISINs
  const handleNewAnnouncement = (event: Event) => {
    const customEvent = event as CustomEvent;
    const announcement = customEvent.detail as ProcessedAnnouncement;
    
    // Only forward announcements for stocks in this watchlist
    if (announcement.isin && watchlistIsins.has(announcement.isin)) {
      console.log(`Watchlist ${watchlistId} matched announcement for ISIN ${announcement.isin}`);
      onNewAnnouncement(announcement);
    } else if (announcement.isin) {
      console.log(`Watchlist ${watchlistId} ignored announcement for non-matching ISIN ${announcement.isin}`);
    }
  };
  
  // Add our custom event listener
  window.addEventListener('new:announcement', handleNewAnnouncement as EventListener);
  
  // Return enhanced socket connection
  return {
    ...socketConnection,
    refreshWatchlistIsins,
    disconnect: () => {
      // Clean up event listener when disconnecting
      window.removeEventListener('new:announcement', handleNewAnnouncement as EventListener);
      socketConnection.disconnect();
    }
  };
};

// Helper function to filter announcements by watchlist for offline use (client-side filtering)
export const filterAnnouncementsByWatchlist = (
  announcements: ProcessedAnnouncement[],
  watchlist: Watchlist
): ProcessedAnnouncement[] => {
  if (!watchlist || !watchlist.isin || watchlist.isin.length === 0) {
    return [];
  }
  
  const watchlistIsins = new Set(watchlist.isin);
  return announcements.filter(
    announcement => announcement.isin && watchlistIsins.has(announcement.isin)
  );
};

export default apiClient;