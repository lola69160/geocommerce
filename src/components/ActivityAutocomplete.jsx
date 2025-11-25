import React, { useState, useEffect, useRef } from 'react';
import { Briefcase } from 'lucide-react';
import { searchNafCodes } from '../data/nafCodes';

const ActivityAutocomplete = ({ onSelect, placeholder, initialValue = null }) => {
    const [query, setQuery] = useState(initialValue ? initialValue.label : '');
    const [suggestions, setSuggestions] = useState([]);
    const [isOpen, setIsOpen] = useState(false);
    const [selectedNaf, setSelectedNaf] = useState(initialValue);
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

        const results = searchNafCodes(value);
        setSuggestions(results);
        setIsOpen(true);

        // Clear selection if user is typing
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
        if (!selectedNaf) {
            const results = searchNafCodes(query);
            setSuggestions(results);
            setIsOpen(true);
        }
    };

    return (
        <div ref={wrapperRef} style={{ position: 'relative', width: '100%' }}>
            <div style={{ position: 'relative' }}>
                <Briefcase size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                <input
                    type="text"
                    placeholder={placeholder}
                    className="input-field"
                    style={{ paddingLeft: '36px' }}
                    value={query}
                    onChange={handleInputChange}
                    onFocus={handleFocus}
                />
            </div>

            {isOpen && suggestions.length > 0 && (
                <ul style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    backgroundColor: 'white',
                    border: '1px solid #cbd5e1',
                    borderRadius: '0 0 8px 8px',
                    listStyle: 'none',
                    padding: 0,
                    margin: '4px 0 0 0',
                    zIndex: 1000,
                    maxHeight: '300px',
                    overflowY: 'auto',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                }}>
                    {suggestions.map((naf) => (
                        <li
                            key={naf.code}
                            onClick={() => handleSelect(naf)}
                            style={{
                                padding: '10px 16px',
                                cursor: 'pointer',
                                borderBottom: '1px solid #f1f5f9',
                                fontSize: '0.95rem',
                                color: 'var(--text-primary)'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                        >
                            <div style={{ fontWeight: '600' }}>{naf.label}</div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>Code NAF: {naf.code}</div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default ActivityAutocomplete;
