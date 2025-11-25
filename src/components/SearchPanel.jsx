import React, { useState, useEffect, useRef } from 'react';
import { Search, Loader2, Bug, Copy, Check } from 'lucide-react';
import Autocomplete from './Autocomplete';
import ActivityAutocomplete from './ActivityAutocomplete';
import { getDisplayName, hasEnseigne, getEstablishmentCreationDate, formatDate } from '../utils/businessDisplayUtils';

const SearchPanel = ({
    onSearch,
    loading,
    results,
    onSelectBusiness,
    debugMode,
    onToggleDebug,
    selectedBusiness,
    filterClosedDays,
    onToggleFilterClosedDays,
    notes,
    cart,
    onOpenNoteModal,
    onAddToCart
}) => {
    const [selectedActivity, setSelectedActivity] = useState(null);
    const [selectedLocation, setSelectedLocation] = useState(null);
    const [radius, setRadius] = useState(5);
    const [expandedCards, setExpandedCards] = useState(new Set());
    const [copiedId, setCopiedId] = useState(null);
    const cardRefs = useRef({});

    useEffect(() => {
        if (selectedBusiness) {
            const id = selectedBusiness.siren || selectedBusiness.siret;
            const element = cardRefs.current[id];
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    }, [selectedBusiness]);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!selectedActivity) {
            alert("Veuillez sélectionner une activité");
            return;
        }
        if (!selectedLocation) {
            alert("Veuillez sélectionner un lieu");
            return;
        }
        onSearch(selectedActivity, selectedLocation, radius);
    };

    const toggleCardExpansion = (businessId) => {
        const newExpanded = new Set(expandedCards);
        if (newExpanded.has(businessId)) {
            newExpanded.delete(businessId);
        } else {
            newExpanded.add(businessId);
        }
        setExpandedCards(newExpanded);
    };

    const handleCopy = (text, id) => {
        navigator.clipboard.writeText(text).then(() => {
            setCopiedId(id);
            setTimeout(() => setCopiedId(null), 2000);
        });
    };

    return (
        <div className="glass-panel" style={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            padding: '20px',
            maxWidth: '400px',
            width: '100%',
            zIndex: 1000
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h1 style={{ fontSize: '1.5rem', margin: 0, color: 'var(--primary-color)' }}>
                    Commerce Finder
                </h1>

                {/* Debug Mode Toggle */}
                <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    color: debugMode ? 'var(--primary-color)' : 'var(--text-secondary)',
                    transition: 'color 0.2s'
                }}>
                    <Bug size={18} />
                    <input
                        type="checkbox"
                        checked={debugMode}
                        onChange={(e) => onToggleDebug(e.target.checked)}
                        style={{ cursor: 'pointer' }}
                    />
                    Debug
                </label>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <ActivityAutocomplete
                    placeholder="Activité (ex: Boulangerie)"
                    onSelect={setSelectedActivity}
                />

                <Autocomplete
                    placeholder="Lieu (ex: La Rochelle)"
                    onSelect={setSelectedLocation}
                />

                <div>
                    <label style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>
                        Rayon de recherche: {radius} km
                    </label>
                    <input
                        type="range"
                        min="1"
                        max="50"
                        value={radius}
                        onChange={(e) => setRadius(parseInt(e.target.value))}
                        style={{ width: '100%' }}
                    />
                </div>

                <button type="submit" className="btn btn-primary" disabled={loading} style={{ justifyContent: 'center' }}>
                    {loading ? <Loader2 className="animate-spin" size={20} /> : 'Rechercher'}
                </button>
            </form>

            {/* Filters Section */}
            <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200 mt-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Filtres</h3>
                <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={filterClosedDays}
                        onChange={(e) => onToggleFilterClosedDays(e.target.checked)}
                        className="form-checkbox h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">Au moins un jour de fermeture</span>
                </label>
            </div>

            <div style={{ marginTop: '20px', flex: 1, overflowY: 'auto' }}>
                <h2 style={{ fontSize: '1rem', marginBottom: '10px', color: 'var(--text-secondary)' }}>
                    Résultats ({results.length})
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {results.map((business) => {
                        const businessId = business.siren || business.siret;
                        const isExpanded = expandedCards.has(businessId);
                        const isSelected = selectedBusiness && (
                            (selectedBusiness.siren && business.siren && selectedBusiness.siren === business.siren) ||
                            (selectedBusiness.siret && business.siret && selectedBusiness.siret === business.siret)
                        );

                        return (
                            <div
                                key={businessId}
                                ref={el => cardRefs.current[businessId] = el}
                                style={{
                                    padding: '12px',
                                    background: isSelected ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.5)',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    border: isSelected ? '2px solid var(--primary-color)' : '1px solid transparent',
                                    transition: 'all 0.2s',
                                    boxShadow: isSelected ? '0 4px 12px rgba(37, 99, 235, 0.2)' : 'none'
                                }}
                                onMouseEnter={(e) => {
                                    if (!isSelected) e.currentTarget.style.borderColor = 'var(--primary-color)';
                                }}
                                onMouseLeave={(e) => {
                                    if (!isSelected) e.currentTarget.style.borderColor = 'transparent';
                                }}
                            >
                                <div onClick={() => onSelectBusiness(business)}>
                                    <h3 style={{ fontSize: '0.95rem', fontWeight: '600', color: 'var(--text-primary)', margin: 0 }}>
                                        {getDisplayName(business)}
                                    </h3>
                                    {hasEnseigne(business) && (
                                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '2px 0', fontStyle: 'italic' }}>
                                            {business.nom_complet}
                                        </p>
                                    )}
                                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
                                        {business.adresse}
                                    </p>

                                    {/* BODACC Badge */}
                                    {business.hasBodacc && (
                                        <span style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            padding: '2px 6px',
                                            borderRadius: '4px',
                                            fontSize: '0.7rem',
                                            fontWeight: '500',
                                            backgroundColor: '#dcfce7',
                                            color: '#166534',
                                            marginTop: '4px'
                                        }}>
                                            Ventes validées
                                        </span>
                                    )}

                                    {/* Closed Days Badge */}
                                    {business.closedDays && business.closedDays.length > 0 && (
                                        <div style={{ marginTop: '4px', fontSize: '0.75rem', color: '#dc2626' }}>
                                            Fermé le : {business.closedDays.join(', ')}
                                        </div>
                                    )}

                                    {/* Dates */}
                                    <div style={{ marginTop: '6px', fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                        {getEstablishmentCreationDate(business) && (
                                            <span>📅 Créé: {formatDate(getEstablishmentCreationDate(business))}</span>
                                        )}
                                        {business.date_mise_a_jour_insee && (
                                            <span>🔄 MAJ: {formatDate(business.date_mise_a_jour_insee)}</span>
                                        )}
                                    </div>

                                    {/* Note and Cart Buttons */}
                                    <div style={{ marginTop: '10px', display: 'flex', gap: '8px' }}>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onOpenNoteModal(business);
                                            }}
                                            style={{
                                                flex: 1,
                                                padding: '8px 12px',
                                                background: notes[businessId]
                                                    ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
                                                    : 'linear-gradient(135deg, #94a3b8 0%, #64748b 100%)',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: '8px',
                                                fontSize: '0.8125rem',
                                                fontWeight: '600',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '5px',
                                                transition: 'all 0.2s',
                                                boxShadow: notes[businessId]
                                                    ? '0 2px 4px rgba(239, 68, 68, 0.25)'
                                                    : '0 2px 4px rgba(148, 163, 184, 0.25)',
                                                fontFamily: 'inherit'
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.transform = 'translateY(-1px)';
                                                e.currentTarget.style.boxShadow = notes[businessId]
                                                    ? '0 4px 6px rgba(239, 68, 68, 0.35)'
                                                    : '0 4px 6px rgba(148, 163, 184, 0.35)';
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.transform = 'translateY(0)';
                                                e.currentTarget.style.boxShadow = notes[businessId]
                                                    ? '0 2px 4px rgba(239, 68, 68, 0.25)'
                                                    : '0 2px 4px rgba(148, 163, 184, 0.25)';
                                            }}
                                        >
                                            <span style={{ fontSize: '1.05em' }}>📝</span>
                                            {notes[businessId] ? 'Modifier' : 'Note'}
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onAddToCart(business);
                                            }}
                                            style={{
                                                flex: 1,
                                                padding: '8px 12px',
                                                background: cart[businessId]
                                                    ? 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)'
                                                    : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: '8px',
                                                fontSize: '0.8125rem',
                                                fontWeight: '600',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '5px',
                                                transition: 'all 0.2s',
                                                boxShadow: cart[businessId]
                                                    ? '0 2px 4px rgba(34, 197, 94, 0.25)'
                                                    : '0 2px 4px rgba(59, 130, 246, 0.25)',
                                                fontFamily: 'inherit'
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.transform = 'translateY(-1px)';
                                                e.currentTarget.style.boxShadow = cart[businessId]
                                                    ? '0 4px 6px rgba(34, 197, 94, 0.35)'
                                                    : '0 4px 6px rgba(59, 130, 246, 0.35)';
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.transform = 'translateY(0)';
                                                e.currentTarget.style.boxShadow = cart[businessId]
                                                    ? '0 2px 4px rgba(34, 197, 94, 0.25)'
                                                    : '0 2px 4px rgba(59, 130, 246, 0.25)';
                                            }}
                                        >
                                            <span style={{ fontSize: '1.05em' }}>🛒</span>
                                            {cart[businessId] ? '✓' : 'Panier'}
                                        </button>
                                    </div>
                                </div>

                                {/* Debug Mode View */}
                                {debugMode && (
                                    <div style={{ marginTop: '8px', borderTop: '1px solid rgba(0,0,0,0.1)', paddingTop: '8px' }}>
                                        <div
                                            onClick={() => toggleCardExpansion(businessId)}
                                            style={{
                                                fontSize: '0.8rem',
                                                color: 'var(--primary-color)',
                                                cursor: 'pointer',
                                                fontWeight: '600',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '4px'
                                            }}
                                        >
                                            <span>{isExpanded ? '▼' : '▶'}</span>
                                            <span>API: recherche-entreprises.api.gouv.fr (near_point)</span>
                                        </div>

                                        {isExpanded && (
                                            <div style={{ position: 'relative' }}>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleCopy(JSON.stringify(business, null, 2), businessId);
                                                    }}
                                                    style={{
                                                        position: 'absolute',
                                                        top: '12px',
                                                        right: '12px',
                                                        background: 'rgba(255,255,255,0.9)',
                                                        border: '1px solid rgba(0,0,0,0.1)',
                                                        borderRadius: '4px',
                                                        padding: '4px',
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        zIndex: 10,
                                                        boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                                                    }}
                                                    title="Copier le JSON"
                                                >
                                                    {copiedId === businessId ? <Check size={14} color="green" /> : <Copy size={14} color="var(--text-secondary)" />}
                                                </button>
                                                <pre style={{
                                                    marginTop: '8px',
                                                    padding: '8px',
                                                    background: 'rgba(0,0,0,0.05)',
                                                    borderRadius: '4px',
                                                    fontSize: '0.7rem',
                                                    fontFamily: 'monospace',
                                                    overflowX: 'auto',
                                                    maxHeight: '300px',
                                                    overflowY: 'auto',
                                                    whiteSpace: 'pre-wrap',
                                                    wordBreak: 'break-word'
                                                }}>
                                                    {JSON.stringify(business, null, 2)}
                                                </pre>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default SearchPanel;
