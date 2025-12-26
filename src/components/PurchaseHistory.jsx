import React, { useState } from 'react';
import { Loader2, History, X, ChevronDown, ChevronUp, Copy, Check, RefreshCw } from 'lucide-react';
import { getPurchaseHistory } from '../services/bodaccService';
import { formatDate } from '../utils/businessDisplayUtils';
import { cacheService } from '../services/cacheService';
import { normalizeAddressKey } from '../services/enrichmentService';

const PurchaseHistory = ({ business }) => {
    const [loading, setLoading] = useState(false);
    const [history, setHistory] = useState(null);
    const [rawData, setRawData] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [error, setError] = useState(null);
    const [showDebug, setShowDebug] = useState(false);
    const [copied, setCopied] = useState(false);

    const handleShowHistory = async (e, forceRefresh = false) => {
        e.stopPropagation();
        setShowModal(true);

        if (history && !forceRefresh) return; // Already loaded in component state

        setLoading(true);
        setError(null);

        try {
            let results = [];
            let raw = [];
            const addressKey = normalizeAddressKey(business.adresse);

            // Strategy 1: Check if data already enriched on the business object (skip if forceRefresh)
            if (!forceRefresh && business.bodaccData && Array.isArray(business.bodaccData) && business.bodaccData.length > 0) {
                console.log('✅ Using pre-enriched BODACC data from business object');
                results = business.bodaccData;
                raw = business.bodaccData; // No separate raw data in this case
            }
            // Strategy 2: Check global cache (skip if forceRefresh)
            else if (!forceRefresh) {
                const cachedData = cacheService.getBodaccData(addressKey);

                if (cachedData && Array.isArray(cachedData)) {
                    console.log('✅ Using cached BODACC data from global cache');
                    results = cachedData;
                    raw = cachedData;
                }
                // Strategy 3: Fetch from API (last resort)
                else {
                    console.log('🔄 Fetching fresh BODACC data from API...');
                    const response = await getPurchaseHistory(
                        business.adresse,
                        business.code_postal,
                        business.libelle_commune,
                        business.activite_principale // Pass NAF code for context-aware validation
                    );

                    results = response.results;
                    raw = response.rawData;

                    // Cache the results (using normalized key)
                    cacheService.setBodaccData(addressKey, results);
                }
            }
            // Force refresh: Always fetch from API
            else {
                console.log('🔄 Force refresh: Fetching fresh BODACC data from API...');
                const response = await getPurchaseHistory(
                    business.adresse,
                    business.code_postal,
                    business.libelle_commune,
                    business.activite_principale
                );

                results = response.results;
                raw = response.rawData;

                // Update cache with fresh data
                cacheService.setBodaccData(addressKey, results);
            }

            setHistory(results);
            setRawData(raw);
        } catch (err) {
            console.error("Failed to load history", err);
            setError("Impossible de charger l'historique.");
        } finally {
            setLoading(false);
        }
    };

    const handleRefresh = (e) => {
        e.stopPropagation();
        const addressKey = normalizeAddressKey(business.adresse);
        // Invalidate cache
        cacheService.invalidate(addressKey);
        // Reset component state
        setHistory(null);
        setRawData(null);
        // Fetch fresh data
        handleShowHistory(e, true);
    };

    const handleClose = (e) => {
        e.stopPropagation();
        setShowModal(false);
    };

    const toggleDebug = (e) => {
        e.stopPropagation();
        setShowDebug(!showDebug);
    };

    const handleCopyJson = async (e) => {
        e.stopPropagation();
        try {
            await navigator.clipboard.writeText(JSON.stringify(rawData, null, 2));
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy JSON:', err);
        }
    };

    return (
        <div style={{ marginTop: '8px', borderTop: '1px solid #eee', paddingTop: '8px' }}>
            <button
                onClick={handleShowHistory}
                style={{
                    background: 'none',
                    border: 'none',
                    color: '#2563eb',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '4px 0',
                    fontSize: '0.85rem',
                    fontWeight: 'bold',
                    textDecoration: 'underline'
                }}
            >
                <span style={{ marginRight: '6px', fontSize: '1.1rem' }}>💰</span>
                Voir historique des rachats
            </button>

            {showModal && (
                <div
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(0,0,0,0.5)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 9999
                    }}
                    onClick={handleClose}
                >
                    <div
                        style={{
                            backgroundColor: 'white',
                            borderRadius: '8px',
                            padding: '20px',
                            width: '90%',
                            maxWidth: '600px',
                            maxHeight: '80vh',
                            overflowY: 'auto',
                            position: 'relative',
                            boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
                        }}
                        onClick={e => e.stopPropagation()}
                    >
                        <button
                            onClick={handleClose}
                            style={{
                                position: 'absolute',
                                top: '10px',
                                right: '10px',
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                color: '#666'
                            }}
                        >
                            <X size={20} />
                        </button>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '15px' }}>
                            <h3 style={{ margin: 0, color: '#1f2937', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <History size={20} />
                                Historique des cessions
                            </h3>
                            <button
                                onClick={handleRefresh}
                                disabled={loading}
                                style={{
                                    background: loading ? '#e5e7eb' : '#3b82f6',
                                    border: 'none',
                                    color: 'white',
                                    cursor: loading ? 'not-allowed' : 'pointer',
                                    padding: '6px 12px',
                                    borderRadius: '6px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    fontSize: '0.85rem',
                                    fontWeight: '500',
                                    transition: 'background 0.2s'
                                }}
                                title="Rafraîchir les données"
                            >
                                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                                Rafraîchir
                            </button>
                        </div>

                        <p style={{ fontSize: '0.9rem', color: '#666', marginBottom: '15px', fontStyle: 'italic' }}>
                            {business.adresse}
                        </p>

                        {loading ? (
                            <div style={{ display: 'flex', justifyContent: 'center', padding: '20px' }}>
                                <Loader2 className="animate-spin" size={30} color="#2563eb" />
                            </div>
                        ) : error ? (
                            <div style={{ color: 'red', padding: '10px', textAlign: 'center' }}>
                                {error}
                            </div>
                        ) : history && history.length > 0 ? (
                            <>
                                {/* Simple table with amounts and dates */}
                                <table style={{
                                    width: '100%',
                                    borderCollapse: 'collapse',
                                    marginBottom: '15px'
                                }}>
                                    <thead>
                                        <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                                            <th style={{
                                                textAlign: 'left',
                                                padding: '10px',
                                                fontWeight: 'bold',
                                                color: '#1f2937'
                                            }}>Montant</th>
                                            <th style={{
                                                textAlign: 'right',
                                                padding: '10px',
                                                fontWeight: 'bold',
                                                color: '#1f2937'
                                            }}>Date</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {history.map((record, index) => (
                                            <tr key={record.id || index} style={{
                                                borderBottom: '1px solid #e5e7eb',
                                                backgroundColor: index % 2 === 0 ? '#f9fafb' : 'white'
                                            }}>
                                                <td style={{
                                                    padding: '12px 10px',
                                                    fontWeight: 'bold',
                                                    color: '#2563eb'
                                                }}>
                                                    {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(record.amount)}
                                                </td>
                                                <td style={{
                                                    padding: '12px 10px',
                                                    textAlign: 'right',
                                                    color: '#6b7280'
                                                }}>
                                                    {formatDate(record.date)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>

                                {/* Debug mode toggle */}
                                {rawData && (
                                    <div style={{ marginTop: '15px', borderTop: '1px solid #e5e7eb', paddingTop: '15px' }}>
                                        <button
                                            onClick={toggleDebug}
                                            style={{
                                                background: 'none',
                                                border: 'none',
                                                color: '#6b7280',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '6px',
                                                fontSize: '0.85rem',
                                                padding: '4px 0',
                                                fontWeight: '500'
                                            }}
                                        >
                                            {showDebug ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                            Mode Debug - JSON BODACC
                                        </button>

                                        {showDebug && (
                                            <div style={{ marginTop: '10px', position: 'relative' }}>
                                                <button
                                                    onClick={handleCopyJson}
                                                    style={{
                                                        position: 'absolute',
                                                        top: '8px',
                                                        right: '8px',
                                                        background: copied ? '#10b981' : '#3b82f6',
                                                        border: 'none',
                                                        color: 'white',
                                                        cursor: 'pointer',
                                                        padding: '6px 10px',
                                                        borderRadius: '4px',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '4px',
                                                        fontSize: '0.75rem',
                                                        fontWeight: '500',
                                                        zIndex: 1
                                                    }}
                                                >
                                                    {copied ? (
                                                        <>
                                                            <Check size={14} />
                                                            Copié
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Copy size={14} />
                                                            Copier
                                                        </>
                                                    )}
                                                </button>
                                                <pre style={{
                                                    backgroundColor: '#1f2937',
                                                    color: '#f9fafb',
                                                    padding: '15px',
                                                    borderRadius: '6px',
                                                    fontSize: '0.75rem',
                                                    maxHeight: '300px',
                                                    overflow: 'auto',
                                                    whiteSpace: 'pre-wrap',
                                                    wordBreak: 'break-word'
                                                }}>
                                                    {JSON.stringify(rawData, null, 2)}
                                                </pre>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </>
                        ) : (
                            <div style={{ textAlign: 'center', padding: '20px', color: '#6b7280' }}>
                                Aucune information de rachat trouvée pour cette adresse.
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default PurchaseHistory;
