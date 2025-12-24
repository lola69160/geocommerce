import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import Legend from './Legend';
import { calculateBusinessAge, getColorByAge } from '../utils/ageUtils';
import { getDisplayName, hasEnseigne, getEstablishmentCreationDate, formatDate } from '../utils/businessDisplayUtils';

// Fix for default marker icon in Leaflet with Webpack/Vite
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

/**
 * Create a colored marker icon based on business age
 * @param {string} color - HSL color string
 * @param {boolean} hasNote - Whether the business has a note
 * @returns {L.Icon} Leaflet icon with custom color
 */
function createColoredIcon(color, hasNote = false) {
    // Create SVG marker with the specified color and optional red dot
    const noteDot = hasNote ? `<circle cx="20" cy="6" r="5" fill="#ef4444" stroke="#fff" stroke-width="1.5"/>` : '';

    const svgIcon = `
        <svg width="25" height="41" viewBox="0 0 25 41" xmlns="http://www.w3.org/2000/svg">
            <path d="M12.5 0C5.596 0 0 5.596 0 12.5c0 9.375 12.5 28.125 12.5 28.125S25 21.875 25 12.5C25 5.596 19.404 0 12.5 0z" 
                  fill="${color}" 
                  stroke="#fff" 
                  stroke-width="2"/>
            <circle cx="12.5" cy="12.5" r="4" fill="#fff"/>
            ${noteDot}
        </svg>
    `;

    return L.icon({
        iconUrl: 'data:image/svg+xml;base64,' + btoa(svgIcon),
        shadowUrl: iconShadow,
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34]
    });
}

import PurchaseHistory from './PurchaseHistory';

// Component for the popup content
function BusinessPopup({ business, notes, onOpenNoteModal, onAddToCart }) {
    const [showDirigeants, setShowDirigeants] = React.useState(false);
    const [showHours, setShowHours] = React.useState(false);
    const filteredDirigeants = (business.dirigeants || []).filter(
        d => d.date_de_naissance || d.annee_de_naissance
    );
    const hasDirigeants = filteredDirigeants.length > 0;
    const age = calculateBusinessAge(business.date_creation);
    // Use geo_adresse (formatted) if available, otherwise fallback to adresse
    const displayAddress = business.geo_adresse || business.adresse;

    return (
        <div style={{ minWidth: showDirigeants ? '300px' : '200px', transition: 'all 0.3s ease' }}>
            <h3 style={{ margin: '0 0 4px 0', color: '#2563eb', fontSize: '1rem' }}>
                {getDisplayName(business)}
            </h3>
            {hasEnseigne(business) && (
                <p style={{ margin: '2px 0 8px 0', fontSize: '0.9rem', fontStyle: 'italic', color: '#666' }}>
                    {business.nom_complet}
                </p>
            )}
            <p style={{ margin: '4px 0', fontSize: '0.85rem' }}>
                <strong>Adresse:</strong> {displayAddress}
            </p>
            {getEstablishmentCreationDate(business) && (
                <p style={{ margin: '4px 0', fontSize: '0.85rem' }}>
                    📅 <strong>Créé:</strong> {formatDate(getEstablishmentCreationDate(business))}
                </p>
            )}
            {business.date_mise_a_jour_insee && (
                <p style={{ margin: '4px 0', fontSize: '0.85rem' }}>
                    🔄 <strong>MAJ:</strong> {formatDate(business.date_mise_a_jour_insee)}
                </p>
            )}
            <p style={{ margin: '4px 0', fontSize: '0.85rem' }}>
                <strong>Âge:</strong> {age} an{age !== 1 ? 's' : ''}
            </p>

            {/* Note and Cart Buttons */}
            <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onOpenNoteModal(business);
                    }}
                    style={{
                        flex: 1,
                        padding: '10px 16px',
                        background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '10px',
                        fontSize: '0.875rem',
                        fontWeight: '600',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        transition: 'all 0.2s',
                        boxShadow: '0 4px 6px -1px rgba(239, 68, 68, 0.3)',
                        fontFamily: 'inherit'
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = '0 6px 8px -1px rgba(239, 68, 68, 0.4)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(239, 68, 68, 0.3)';
                    }}
                >
                    <span style={{ fontSize: '1.1em' }}>📝</span>
                    Note
                </button>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onAddToCart(business);
                    }}
                    style={{
                        flex: 1,
                        padding: '10px 16px',
                        background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '10px',
                        fontSize: '0.875rem',
                        fontWeight: '600',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        transition: 'all 0.2s',
                        boxShadow: '0 4px 6px -1px rgba(59, 130, 246, 0.3)',
                        fontFamily: 'inherit'
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = '0 6px 8px -1px rgba(59, 130, 246, 0.4)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(59, 130, 246, 0.3)';
                    }}
                >
                    <span style={{ fontSize: '1.1em' }}>🛒</span>
                    Panier
                </button>
            </div>

            {/* Purchase History Button */}
            <PurchaseHistory business={business} />

            {/* Opening Hours Section */}
            {business.openingHours && Array.isArray(business.openingHours) && business.openingHours.length > 0 && (
                <div style={{ marginTop: '8px', borderTop: '1px solid #eee', paddingTop: '8px' }}>
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            cursor: 'pointer',
                            color: '#2563eb',
                            padding: '4px 0'
                        }}
                        onClick={(e) => {
                            e.stopPropagation();
                            setShowHours(!showHours);
                        }}
                    >
                        <span style={{ marginRight: '6px', fontSize: '1.1rem' }}>🕐</span>
                        <span style={{ fontSize: '0.85rem', fontWeight: 'bold', textDecoration: 'underline' }}>
                            {showHours ? 'Masquer les horaires' : 'Voir les horaires'}
                        </span>
                    </div>

                    {showHours && (
                        <div style={{
                            marginTop: '8px',
                            backgroundColor: '#f8f9fa',
                            borderRadius: '4px',
                            padding: '6px',
                            fontSize: '0.8rem',
                            border: '1px solid #e5e7eb'
                        }}>
                            {business.openingHours.map((day, index) => (
                                <div key={index} style={{ marginBottom: '2px' }}>
                                    {String(day || '')}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {hasDirigeants && (
                <div style={{ marginTop: '8px', borderTop: '1px solid #eee', paddingTop: '8px' }}>
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            cursor: 'pointer',
                            color: '#2563eb',
                            padding: '4px 0'
                        }}
                        onClick={(e) => {
                            e.stopPropagation();
                            setShowDirigeants(!showDirigeants);
                        }}
                    >
                        <span style={{ marginRight: '6px', fontSize: '1.1rem' }}>👥</span>
                        <span style={{ fontSize: '0.85rem', fontWeight: 'bold', textDecoration: 'underline' }}>
                            {showDirigeants ? 'Masquer les dirigeants' : 'Voir les dirigeants'}
                        </span>
                    </div>

                    {showDirigeants && (
                        <div style={{
                            marginTop: '8px',
                            maxHeight: '200px',
                            overflowY: 'auto',
                            backgroundColor: '#f8f9fa',
                            borderRadius: '4px',
                            padding: '4px'
                        }}>
                            {filteredDirigeants.map((dirigeant, index) => (
                                <div key={index} style={{
                                    marginBottom: '8px',
                                    fontSize: '0.8rem',
                                    padding: '6px',
                                    backgroundColor: '#fff',
                                    borderRadius: '4px',
                                    border: '1px solid #e5e7eb'
                                }}>
                                    <div style={{ fontWeight: 'bold', color: '#1f2937' }}>
                                        {dirigeant.prenoms} {dirigeant.nom}
                                    </div>
                                    {dirigeant.qualite && (
                                        <div style={{ color: '#6b7280', fontStyle: 'italic', marginTop: '2px' }}>
                                            {dirigeant.qualite}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Link to Street View */}
            <a
                href={
                    business.googlePlaceId
                        ? `https://www.google.com/maps/place/?q=place_id:${business.googlePlaceId}`
                        : `https://www.google.com/maps/place/${encodeURIComponent(displayAddress)}`
                }
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: 'inline-block', marginTop: '8px', color: '#0ea5e9', textDecoration: 'none', fontSize: '0.85rem' }}
            >
                Voir sur Street View
            </a>
        </div>
    );
}

// Component to update map view when center changes
function MapController({ center, zoom }) {
    const map = useMap();
    useEffect(() => {
        map.flyTo(center, zoom, {
            duration: 1.5,
            easeLinearity: 0.25
        });
    }, [center, zoom]);
    return null;
}

const Map = ({ businesses, center, zoom, selectedBusiness, onSelectBusiness, notes, onOpenNoteModal, onAddToCart }) => {
    const markerRefs = useRef({});

    useEffect(() => {
        if (selectedBusiness) {
            const id = selectedBusiness.siren || selectedBusiness.siret;
            const marker = markerRefs.current[id];
            if (marker) {
                marker.openPopup();
            }
        }
    }, [selectedBusiness]);

    return (
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            <MapContainer center={center} zoom={zoom} style={{ height: '100%', width: '100%' }}>
                <MapController center={center} zoom={zoom} />
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {businesses
                    .filter(b => b.lat && b.lon && !isNaN(parseFloat(b.lat)) && !isNaN(parseFloat(b.lon)))
                    .map((business) => {
                        const age = calculateBusinessAge(business.date_creation);
                        const color = getColorByAge(age);
                        const businessId = business.siren || business.siret;
                        const hasNote = notes && notes[businessId];
                        const coloredIcon = createColoredIcon(color, hasNote);

                        return (
                            <Marker
                                key={businessId}
                                position={[parseFloat(business.lat), parseFloat(business.lon)]}
                                icon={coloredIcon}
                                ref={el => markerRefs.current[businessId] = el}
                                eventHandlers={{
                                    click: () => onSelectBusiness && onSelectBusiness(business)
                                }}
                            >
                                <Popup autoPan={false}>
                                    <BusinessPopup
                                        business={business}
                                        notes={notes}
                                        onOpenNoteModal={onOpenNoteModal}
                                        onAddToCart={onAddToCart}
                                    />
                                </Popup>
                            </Marker>
                        );
                    })}
            </MapContainer>

            {/* Legend overlay */}
            <Legend />
        </div>
    );
};

export default Map;

