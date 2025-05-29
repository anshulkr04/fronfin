import React, { useEffect, useState } from 'react';
import { X, ChevronDown } from 'lucide-react';

interface FilterModalProps {
  onClose: () => void;
  onApplyFilters?: (filters: {
    categories: string[];
    sentiments: string[];
    industries: string[];
  }) => void;
  initialFilters?: {
    categories: string[];
    sentiments: string[];
    industries: string[];
  };
  focusTab?: 'categories' | 'sentiments' | 'industries';
}

const FilterModal: React.FC<FilterModalProps> = ({
  onClose,
  onApplyFilters,
  initialFilters = {
    categories: [],
    sentiments: [],
    industries: []
  },
  focusTab
}) => {
  const [selectedCategories, setSelectedCategories] = useState<string[]>(initialFilters.categories || []);
  const [selectedSentiments, setSelectedSentiments] = useState<string[]>(initialFilters.sentiments || []);
  const [selectedIndustries, setSelectedIndustries] = useState<string[]>(initialFilters.industries || []);
  const [availableIndustries, setAvailableIndustries] = useState<string[]>([]);
  const [showAllIndustries, setShowAllIndustries] = useState(false);
  const [activeTab, setActiveTab] = useState<'categories' | 'sentiments' | 'industries'>(
    focusTab || 'sentiments' // Default to sentiments tab since categories are now in sidebar
  );
  
  // Set active tab based on focusTab prop
  useEffect(() => {
    if (focusTab) {
      setActiveTab(focusTab);
    }
  }, [focusTab]);
  
  // Updated categories list (same as in sidebar)
  const categories = [
    "Annual Report", "Agreements/MoUs", "Anti-dumping Duty", "Buyback",
    "Bonus/Stock Split", "Change in Address", "Change in MOA",
    "Clarifications/Confirmations", "Closure of Factory", "Concall Transcript",
    "Consolidation of Shares", "Credit Rating", "Debt Reduction",
    "Debt & Financing", "Delisting", "Demerger", "Change in KMP",
    "Demise of KMP", "Disruption of Operations", "Divestitures", "DRHP",
    "Expansion", "Financial Results", "Fundraise - Preferential Issue",
    "Fundraise - QIP", "Fundraise - Rights Issue", "Global Pharma Regulation",
    "Incorporation/Cessation of Subsidiary", "Increase in Share Capital",
    "Insolvency and Bankruptcy", "Interest Rates Updates", "Investor Presentation",
    "Investor/Analyst Meet", "Joint Ventures", "Litigation & Notices",
    "Mergers/Acquisitions", "Name Change", "New Order", "New Product",
    "One Time Settlement (OTS)", "Open Offer", "Operational Update", "PLI Scheme",
    "Procedural/Administrative", "Reduction in Share Capital",
    "Regulatory Approvals/Orders", "Trading Suspension", "USFDA", "Board Meeting",
    "AGM/EGM", "Dividend", "Corporate Action", "Management Changes",
    "Strategic Update", "Other"
  ];
  
  const sentiments = ["Positive", "Neutral", "Negative"];
  
  // Use predefined industry list instead of fetching
  useEffect(() => {
    // Complete list of industries
    const industries = [
      "Abrasives", "Air Conditioning", "Aluminum", "Appliances", "Aquaculture", 
      "Auto & Auto Parts", "Automobiles", "Banks", "Batteries", "Bearings", 
      "Breweries & Distilleries", "Cables", "Cement", "Cement Products", "Chemicals", 
      "Chlor Alkali", "Cigarettes", "Compressors & Drilling", "Computer Education", 
      "Computer Hardware", "Computer Software", "Construction", "Couriers", 
      "Cycles & Accessories", "Detergents", "Diamond & Jewelry", "Diversified", 
      "Dyes & Pigments", "Electrical Equipment", "Electrodes & Welding", "Electronics", 
      "Engineering", "Engines", "Entertainment & Media", "Fasteners", 
      "Fertilizers & Pesticides", "Finance & Investments", "Finance - Housing", 
      "Food Processing", "Glass & Ceramics", "Healthcare", "Hotels", "Leather Goods", 
      "Luggage", "Mining & Metals", "Oil & Gas", "Packaging", "Paints & Varnishes", 
      "Paper", "Personal Care", "Petrochemicals", "Pharmaceuticals", "Photographic Products", 
      "Plastics", "Power Generation", "Printing & Stationery", "Pumps", 
      "Recreation & Amusement", "Refineries", "Refractories", "Solvent Extraction", 
      "Steel", "Sugar", "Tea", "Telecommunications", "Textile Machinery", "Textiles", 
      "Trading", "Transmission Towers", "Transport & Airlines", "Travel", "Tyres"
    ];
    
    setAvailableIndustries(industries.sort());
  }, []);
  
  const toggleCategory = (category: string) => {
    if (selectedCategories.includes(category)) {
      setSelectedCategories(selectedCategories.filter(c => c !== category));
    } else {
      setSelectedCategories([...selectedCategories, category]);
    }
  };
  
  const toggleSentiment = (sentiment: string) => {
    if (selectedSentiments.includes(sentiment)) {
      setSelectedSentiments(selectedSentiments.filter(s => s !== sentiment));
    } else {
      setSelectedSentiments([...selectedSentiments, sentiment]);
    }
  };
  
  const toggleIndustry = (industry: string) => {
    if (selectedIndustries.includes(industry)) {
      setSelectedIndustries(selectedIndustries.filter(i => i !== industry));
    } else {
      setSelectedIndustries([...selectedIndustries, industry]);
    }
  };
  
  const handleApply = () => {
    if (onApplyFilters) {
      // Pass the selected filters to the parent component
      onApplyFilters({
        categories: selectedCategories,
        sentiments: selectedSentiments,
        industries: selectedIndustries
      });
    } else {
      // Just close the modal if no callback is provided
      onClose();
    }
  };
  
  const handleClearAll = () => {
    // Clear all selected filters
    setSelectedCategories([]);
    setSelectedSentiments([]);
    setSelectedIndustries([]);
  };
  
  const displayedIndustries = showAllIndustries 
    ? availableIndustries 
    : availableIndustries.slice(0, 15);
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-20 z-50 flex items-center justify-center backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-float max-w-4xl w-full max-h-[90vh] overflow-hidden animate-fade-in">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-semibold text-gray-900">Advanced Filters</h3>
            <button 
              className="p-2 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-900 transition-colors"
              onClick={onClose}
            >
              <X size={20} />
            </button>
          </div>
          
          {/* Tab Navigation */}
          <div className="flex border-b border-gray-200 mb-6">
            <button
              className={`px-4 py-2 text-sm font-medium border-b-2 ${
                activeTab === 'categories' 
                  ? 'text-indigo-600 border-indigo-600' 
                  : 'text-gray-500 border-transparent hover:text-gray-700 hover:border-gray-300'
              }`}
              onClick={() => setActiveTab('categories')}
            >
              Categories
              {selectedCategories.length > 0 && (
                <span className="ml-2 bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full text-xs">
                  {selectedCategories.length}
                </span>
              )}
            </button>
            <button
              className={`px-4 py-2 text-sm font-medium border-b-2 ${
                activeTab === 'sentiments' 
                  ? 'text-indigo-600 border-indigo-600' 
                  : 'text-gray-500 border-transparent hover:text-gray-700 hover:border-gray-300'
              }`}
              onClick={() => setActiveTab('sentiments')}
            >
              Sentiments
              {selectedSentiments.length > 0 && (
                <span className="ml-2 bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full text-xs">
                  {selectedSentiments.length}
                </span>
              )}
            </button>
            <button
              className={`px-4 py-2 text-sm font-medium border-b-2 ${
                activeTab === 'industries' 
                  ? 'text-indigo-600 border-indigo-600' 
                  : 'text-gray-500 border-transparent hover:text-gray-700 hover:border-gray-300'
              }`}
              onClick={() => setActiveTab('industries')}
            >
              Industries
              {selectedIndustries.length > 0 && (
                <span className="ml-2 bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full text-xs">
                  {selectedIndustries.length}
                </span>
              )}
            </button>
          </div>
          
          {/* Tab Content */}
          <div className="mb-6">
            {activeTab === 'categories' && (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h4 className="text-sm font-medium text-gray-900">Categories</h4>
                  <p className="text-xs text-gray-500">
                    Categories can also be quickly filtered from the sidebar
                  </p>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-60 overflow-y-auto pr-2">
                  {categories.map((category) => (
                    <label key={category} className="flex items-center space-x-3 group cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={selectedCategories.includes(category)}
                        onChange={() => toggleCategory(category)}
                        className="w-4 h-4 rounded border-gray-300 text-black focus:ring-black"
                      />
                      <span className="text-sm text-gray-600 group-hover:text-gray-900">
                        {category}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}
            
            {activeTab === 'sentiments' && (
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-4">Sentiment</h4>
                <div className="space-y-3">
                  {sentiments.map((sentiment) => (
                    <label key={sentiment} className="flex items-center space-x-3 group cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={selectedSentiments.includes(sentiment)}
                        onChange={() => toggleSentiment(sentiment)}
                        className="w-4 h-4 rounded border-gray-300 text-black focus:ring-black"
                      />
                      <span className="text-sm text-gray-600 group-hover:text-gray-900">
                        {sentiment}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}
            
            {activeTab === 'industries' && (
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-4">Industries</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-60 overflow-y-auto pr-2">
                  {displayedIndustries.map((industry) => (
                    <label key={industry} className="flex items-center space-x-3 group cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={selectedIndustries.includes(industry)}
                        onChange={() => toggleIndustry(industry)}
                        className="w-4 h-4 rounded border-gray-300 text-black focus:ring-black"
                      />
                      <span className="text-sm text-gray-600 group-hover:text-gray-900">
                        {industry}
                      </span>
                    </label>
                  ))}
                </div>
                
                {availableIndustries.length > 15 && (
                  <button 
                    className="text-sm font-medium text-black hover:text-gray-600 flex items-center mt-4"
                    onClick={() => setShowAllIndustries(!showAllIndustries)}
                  >
                    <span>{showAllIndustries ? 'Show less' : 'Show more industries'}</span>
                    <ChevronDown size={14} className={`ml-1 transition-transform ${showAllIndustries ? 'rotate-180' : ''}`} />
                  </button>
                )}
              </div>
            )}
          </div>
          
          <div className="mt-8 pt-4 border-t border-gray-100 flex justify-between">
            <button 
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-black focus:outline-none"
              onClick={handleClearAll}
            >
              Clear all
            </button>
            
            <div className="space-x-3">
              <button 
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 focus:outline-none"
                onClick={onClose}
              >
                Cancel
              </button>
              
              <button 
                className="px-4 py-2 text-sm font-medium text-white bg-black rounded-lg hover:bg-gray-900 focus:outline-none"
                onClick={handleApply}
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FilterModal;