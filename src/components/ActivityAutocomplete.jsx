import React, { useState, useEffect, useRef } from 'react';
import { Briefcase } from 'lucide-react';
import { searchNafCodes } from '../data/nafCodes';

/**
 * ActivityAutocomplete Component - Tech Premium Design System
 *
 * Activity/NAF code autocomplete.
 * Features:
 * - Dark mode styling
 * - Glow effects on focus
 * - Smooth dropdown animation
 * - Keyboard navigation
 */
const ActivityAutocomplete = ({ onSelect, placeholder, initialValue = null }) => {
  const [query, setQuery] = useState(initialValue ? initialValue.label : '');
  const [suggestions, setSuggestions] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [selectedNaf, setSelectedNaf] = useState(initialValue);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const wrapperRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e) => {
    const value = e.target.value;
    setQuery(value);
    setHighlightedIndex(-1);

    const results = searchNafCodes(value);
    setSuggestions(results);
    setIsOpen(true);

    if (selectedNaf) {
      setSelectedNaf(null);
      onSelect(null);
    }
  };

  const handleSelect = (naf) => {
    setQuery(naf.label);
    setSelectedNaf(naf);
    setSuggestions([]);
    setIsOpen(false);
    onSelect(naf);
  };

  const handleFocus = () => {
    setIsFocused(true);
    if (!selectedNaf) {
      const results = searchNafCodes(query);
      setSuggestions(results);
      setIsOpen(true);
    }
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
        <Briefcase
          size={18}
          className={`
            absolute left-3 top-1/2 -translate-y-1/2
            transition-colors duration-fast
            pointer-events-none
            ${isFocused ? 'text-violet-500' : 'text-text-muted'}
          `}
        />
        <input
          type="text"
          placeholder={placeholder}
          value={query}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onBlur={() => setIsFocused(false)}
          onKeyDown={handleKeyDown}
          className={`
            w-full
            pl-10 pr-4 py-2.5
            bg-surface-800
            text-text-primary
            placeholder:text-text-muted
            border rounded-xl
            transition-all duration-fast
            focus:outline-none
            focus:bg-surface-700
            ${isFocused
              ? 'border-violet-500 shadow-glow-violet'
              : 'border-[rgba(255,255,255,0.1)] hover:border-[rgba(255,255,255,0.2)]'
            }
          `}
        />
      </div>

      {/* Dropdown */}
      {isOpen && suggestions.length > 0 && (
        <ul className={`
          absolute top-full left-0 right-0
          mt-2
          bg-surface-800
          border border-[rgba(255,255,255,0.1)]
          rounded-xl
          overflow-hidden
          shadow-dark-xl
          z-dropdown
          max-h-72 overflow-y-auto
          animate-fade-in-down
        `}>
          {suggestions.map((naf, index) => (
            <li
              key={naf.code}
              onClick={() => handleSelect(naf)}
              onMouseEnter={() => setHighlightedIndex(index)}
              className={`
                px-4 py-3
                cursor-pointer
                border-b border-[rgba(255,255,255,0.06)] last:border-b-0
                transition-colors duration-fast
                ${highlightedIndex === index
                  ? 'bg-surface-700'
                  : 'hover:bg-surface-700'
                }
              `}
            >
              <div className="text-text-primary text-sm font-medium">
                {naf.label}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className={`
                  px-1.5 py-0.5
                  rounded
                  text-xs font-mono
                  bg-violet-500/15 text-violet-400
                `}>
                  {naf.code}
                </span>
                <span className="text-text-muted text-xs">
                  Code NAF
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default ActivityAutocomplete;
