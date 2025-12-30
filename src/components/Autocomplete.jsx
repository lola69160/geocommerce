import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { MapPin } from 'lucide-react';

const GEO_API_URL = 'https://api-adresse.data.gouv.fr/search/';

/**
 * Autocomplete Component - Tech Premium Design System
 *
 * Location autocomplete using French government API.
 * Features:
 * - Dark mode styling
 * - Glow effects on focus
 * - Smooth dropdown animation
 */
const Autocomplete = ({ onSelect, placeholder, initialValue = '' }) => {
  const [query, setQuery] = useState(initialValue);
  const [suggestions, setSuggestions] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const wrapperRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = async (e) => {
    const value = e.target.value;
    setQuery(value);
    setHighlightedIndex(-1);

    if (value.length > 2) {
      try {
        const response = await axios.get(GEO_API_URL, {
          params: { q: value, limit: 5, type: 'municipality' }
        });
        setSuggestions(response.data.features);
        setIsOpen(true);
      } catch (error) {
        console.error("Autocomplete error:", error);
      }
    } else {
      setSuggestions([]);
      setIsOpen(false);
    }
  };

  const handleSelect = (feature) => {
    setQuery(feature.properties.label);
    setSuggestions([]);
    setIsOpen(false);
    onSelect(feature);
  };

  const handleKeyDown = (e) => {
    if (!isOpen || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev =>
          prev < suggestions.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev =>
          prev > 0 ? prev - 1 : suggestions.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0) {
          handleSelect(suggestions[highlightedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        break;
    }
  };

  return (
    <div ref={wrapperRef} className="relative w-full">
      {/* Input with icon */}
      <div className="relative">
        <MapPin
          size={18}
          className={`
            absolute left-3 top-1/2 -translate-y-1/2
            transition-colors duration-fast
            pointer-events-none
            ${isFocused ? 'text-cyan-500' : 'text-text-muted'}
          `}
        />
        <input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={query}
          onChange={handleInputChange}
          onFocus={() => {
            setIsFocused(true);
            if (query.length > 2) setIsOpen(true);
          }}
          onBlur={() => setIsFocused(false)}
          onKeyDown={handleKeyDown}
          className={`
            w-full
            pl-10 pr-4 py-2.5
            bg-surface-300
            text-text-primary
            placeholder:text-text-muted
            border rounded-xl
            transition-all duration-fast
            focus:outline-none
            focus:bg-surface-200
            ${isFocused
              ? 'border-primary-500 shadow-glow-sm'
              : 'border-surface-400 hover:border-surface-500'
            }
          `}
        />
      </div>

      {/* Dropdown */}
      {isOpen && suggestions.length > 0 && (
        <ul className={`
          absolute top-full left-0 right-0
          mt-2
          bg-surface-300
          border border-surface-400
          rounded-xl
          overflow-hidden
          shadow-dark-xl
          z-dropdown
          animate-fade-in-down
        `}>
          {suggestions.map((feature, index) => (
            <li
              key={feature.properties.id}
              onClick={() => handleSelect(feature)}
              onMouseEnter={() => setHighlightedIndex(index)}
              className={`
                px-4 py-3
                cursor-pointer
                border-b border-surface-500 last:border-b-0
                transition-colors duration-fast
                ${highlightedIndex === index
                  ? 'bg-surface-200'
                  : 'hover:bg-surface-200'
                }
              `}
            >
              <span className="text-text-primary text-sm">
                {feature.properties.label}
              </span>
              <span className="text-text-muted text-xs ml-2">
                ({feature.properties.context})
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default Autocomplete;
