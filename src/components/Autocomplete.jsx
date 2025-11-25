import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { MapPin } from 'lucide-react';

const GEO_API_URL = 'https://api-adresse.data.gouv.fr/search/';

const Autocomplete = ({ onSelect, placeholder, initialValue = '' }) => {
    const [query, setQuery] = useState(initialValue);
    const [suggestions, setSuggestions] = useState([]);
    const [isOpen, setIsOpen] = useState(false);
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

    const handleInputChange = async (e) => {
        const value = e.target.value;
        setQuery(value);

        if (value.length > 2) {
            try {
                // Prefer municipalities (cities) but allow others
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

    return (
        <div ref={wrapperRef} style={{ position: 'relative', width: '100%' }}>
            <div style={{ position: 'relative' }}>
                <MapPin size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                <input
                    type="text"
                    placeholder={placeholder}
                    className="input-field"
                    style={{ paddingLeft: '36px' }}
                    value={query}
                    onChange={handleInputChange}
                    onFocus={() => query.length > 2 && setIsOpen(true)}
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
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                }}>
                    {suggestions.map((feature) => (
                        <li
                            key={feature.properties.id}
                            onClick={() => handleSelect(feature)}
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
                            {feature.properties.label} <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>({feature.properties.context})</span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default Autocomplete;
