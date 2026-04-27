import React, { useState, useRef, useEffect } from "react";
import { Search, ChevronDown } from "lucide-react";
import { Button } from "./button";
import { Input } from "./input";

interface CitySearchProps {
  value: string;
  onChange: (value: string) => void;
  onSearch: () => void;
  placeholder?: string;
  disabled?: boolean;
  isLoading?: boolean;
}

const CITIES = [
  { name: "mumbai" },
  { name: "delhi" },
  { name: "bengaluru" },
  { name: "hyderabad" },
  { name: "chennai" },
  { name: "pune" },
  { name: "ahmedabad" },
  { name: "kolkata" },
  { name: "cochin" },
  { name: "bhubaneswar" },
  { name: "chandigarh" },
];

export const CitySearch: React.FC<CitySearchProps> = ({
  value,
  onChange,
  onSearch,
  placeholder = "Search for tech parks in any city or enter a new city",
  disabled = false,
  isLoading = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [filteredCities, setFilteredCities] = useState(CITIES);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Filter cities based on input value
  useEffect(() => {
    if (value.trim() === "") {
      setFilteredCities(CITIES);
    } else {
      const filtered = CITIES.filter(city =>
        city.name.toLowerCase().includes(value.toLowerCase())
      );
      setFilteredCities(filtered);
    }
  }, [value]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleCitySelect = (cityName: string) => {
    // Display with first letter uppercase, but pass lowercase to backend
    const displayName = cityName.charAt(0).toUpperCase() + cityName.slice(1);
    onChange(displayName);
    setIsOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
    setIsOpen(true);
  };

  const handleInputFocus = () => {
    setIsOpen(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      onSearch();
      setIsOpen(false);
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          {isLoading ? (
            <div className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400"></div>
            </div>
          ) : (
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          )}
          <Input
            type="text"
            value={value}
            onChange={handleInputChange}
            onFocus={handleInputFocus}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled || isLoading}
            className={`pl-10 pr-10 ${isLoading ? 'opacity-75' : ''}`}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0"
            onClick={() => setIsOpen(!isOpen)}
            disabled={disabled || isLoading}
          >
            <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </Button>
        </div>
        <Button
          onClick={onSearch}
          disabled={disabled || !value.trim() || isLoading}
          className="px-4"
        >
          {isLoading ? (
            <div className="flex items-center gap-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              Searching...
            </div>
          ) : (
            "Search"
          )}
        </Button>
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-50 max-h-60 overflow-y-auto">
          {filteredCities.length > 0 ? (
            <div className="py-1">
              {filteredCities.map((city, index) => (
                <button
                  key={index}
                  type="button"
                  className="w-full px-4 py-2 text-left hover:bg-gray-50 focus:bg-gray-50 focus:outline-none"
                  onClick={() => handleCitySelect(city.name)}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-900">
                      {city.name.charAt(0).toUpperCase() + city.name.slice(1)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="px-4 py-2 text-gray-500 text-sm">
              No cities found matching "{value}"
            </div>
          )}
        </div>
      )}
    </div>
  );
}; 