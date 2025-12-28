import React, { useState, useEffect, useRef } from 'react';
import { Search, Loader2, Bug, SlidersHorizontal } from 'lucide-react';
import Autocomplete from './Autocomplete';
import ActivityAutocomplete from './ActivityAutocomplete';
import BusinessCard from './BusinessCard';
import { Button } from './ui';

/**
 * SearchPanel Component - Tech Premium Design System
 *
 * Main search interface for finding French businesses.
 * Features:
 * - Activity and location autocomplete
 * - Radius slider
 * - Results list with stagger animation
 * - Debug mode toggle
 * - Filter controls
 */
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
  onOpenDocumentModal,
  onAddToCart
}) => {
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [radius, setRadius] = useState(5);
  const [expandedCards, setExpandedCards] = useState(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const cardRefs = useRef({});

  // Scroll to selected business card
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

  return (
    <div className="h-full flex flex-col p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display font-bold text-2xl text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-violet-400">
            Commerce
          </h1>
          <p className="font-display font-light text-lg text-text-muted -mt-1 tracking-wider">
            FINDER
          </p>
        </div>

        {/* Debug Toggle */}
        <label className={`
          flex items-center gap-2
          px-3 py-1.5
          rounded-lg
          cursor-pointer
          text-sm font-medium
          transition-all duration-fast
          ${debugMode
            ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
            : 'bg-surface-700 text-text-muted border border-transparent hover:border-cyan-500/20'
          }
        `}>
          <Bug size={16} />
          <input
            type="checkbox"
            checked={debugMode}
            onChange={(e) => onToggleDebug(e.target.checked)}
            className="sr-only"
          />
          <span>Debug</span>
        </label>
      </div>

      {/* Search Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Activity Input */}
        <ActivityAutocomplete
          placeholder="Activité (ex: Boulangerie)"
          onSelect={setSelectedActivity}
        />

        {/* Location Input */}
        <Autocomplete
          placeholder="Lieu (ex: La Rochelle)"
          onSelect={setSelectedLocation}
        />

        {/* Radius Slider */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-text-secondary">
              Rayon de recherche
            </label>
            <span className="text-sm font-mono font-bold text-cyan-400">
              {radius} km
            </span>
          </div>
          <div className="relative">
            <input
              type="range"
              min="1"
              max="50"
              value={radius}
              onChange={(e) => setRadius(parseInt(e.target.value))}
              className={`
                w-full h-2
                appearance-none
                bg-surface-700
                rounded-full
                cursor-pointer
                [&::-webkit-slider-thumb]:appearance-none
                [&::-webkit-slider-thumb]:w-4
                [&::-webkit-slider-thumb]:h-4
                [&::-webkit-slider-thumb]:rounded-full
                [&::-webkit-slider-thumb]:bg-cyan-500
                [&::-webkit-slider-thumb]:shadow-glow-sm
                [&::-webkit-slider-thumb]:cursor-grab
                [&::-webkit-slider-thumb]:transition-all
                [&::-webkit-slider-thumb]:hover:bg-cyan-400
                [&::-webkit-slider-thumb]:hover:shadow-glow-md
                [&::-moz-range-thumb]:w-4
                [&::-moz-range-thumb]:h-4
                [&::-moz-range-thumb]:rounded-full
                [&::-moz-range-thumb]:bg-cyan-500
                [&::-moz-range-thumb]:border-none
                [&::-moz-range-thumb]:cursor-grab
              `}
              style={{
                background: `linear-gradient(to right, #00d4ff 0%, #00d4ff ${(radius / 50) * 100}%, #1a1a24 ${(radius / 50) * 100}%, #1a1a24 100%)`
              }}
            />
          </div>
        </div>

        {/* Search Button */}
        <Button
          type="submit"
          variant="primary"
          size="lg"
          fullWidth
          loading={loading}
          glow={!loading}
          icon={loading ? null : <Search size={18} />}
        >
          {loading ? 'Recherche...' : 'Rechercher'}
        </Button>
      </form>

      {/* Filters Section */}
      <div className="mt-4">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`
            flex items-center gap-2 w-full
            px-3 py-2
            rounded-lg
            text-sm font-medium
            transition-all duration-fast
            ${showFilters
              ? 'bg-surface-700 text-text-primary'
              : 'text-text-muted hover:text-text-secondary hover:bg-surface-800'
            }
          `}
        >
          <SlidersHorizontal size={16} />
          <span>Filtres</span>
          {filterClosedDays && (
            <span className="ml-auto px-1.5 py-0.5 rounded-full text-xs bg-cyan-500/20 text-cyan-400">
              1
            </span>
          )}
        </button>

        {showFilters && (
          <div className="mt-2 p-3 bg-surface-800 rounded-lg border border-[rgba(255,255,255,0.06)] animate-fade-in-down">
            <label className="flex items-center gap-3 cursor-pointer group">
              <div className={`
                relative w-5 h-5
                rounded-md
                border-2
                transition-all duration-fast
                ${filterClosedDays
                  ? 'bg-cyan-500 border-cyan-500'
                  : 'bg-transparent border-text-muted group-hover:border-cyan-500/50'
                }
              `}>
                <input
                  type="checkbox"
                  checked={filterClosedDays}
                  onChange={(e) => onToggleFilterClosedDays(e.target.checked)}
                  className="sr-only"
                />
                {filterClosedDays && (
                  <svg
                    className="absolute inset-0 w-full h-full p-0.5 text-white"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </div>
              <span className="text-sm text-text-secondary group-hover:text-text-primary transition-colors">
                Au moins un jour de fermeture
              </span>
            </label>
          </div>
        )}
      </div>

      {/* Results Section */}
      <div className="mt-6 flex-1 overflow-hidden flex flex-col min-h-0">
        {/* Results header */}
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">
            Résultats
          </h2>
          <span className={`
            px-2 py-0.5
            rounded-full
            text-xs font-mono font-bold
            ${results.length > 0
              ? 'bg-cyan-500/15 text-cyan-400'
              : 'bg-surface-700 text-text-muted'
            }
          `}>
            {results.length}
          </span>
        </div>

        {/* Results list */}
        <div className="flex-1 overflow-y-auto pr-1 -mr-1 space-y-3">
          {results.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 mb-4 rounded-full bg-surface-700 flex items-center justify-center">
                <Search size={24} className="text-text-muted" />
              </div>
              <p className="text-text-muted text-sm">
                Aucun résultat. Lancez une recherche pour commencer.
              </p>
            </div>
          ) : (
            <div className="stagger">
              {results.map((business, index) => {
                const businessId = business.siren || business.siret;
                const isExpanded = expandedCards.has(businessId);
                const isSelected = selectedBusiness && (
                  (selectedBusiness.siren && business.siren && selectedBusiness.siren === business.siren) ||
                  (selectedBusiness.siret && business.siret && selectedBusiness.siret === business.siret)
                );

                return (
                  <BusinessCard
                    key={businessId}
                    ref={el => cardRefs.current[businessId] = el}
                    business={business}
                    isSelected={isSelected}
                    isExpanded={isExpanded}
                    debugMode={debugMode}
                    hasNote={!!notes[businessId]}
                    isInCart={!!cart[businessId]}
                    onSelect={onSelectBusiness}
                    onToggleExpand={toggleCardExpansion}
                    onOpenNote={onOpenNoteModal}
                    onOpenDocuments={onOpenDocumentModal}
                    onAddToCart={onAddToCart}
                    style={{ animationDelay: `${index * 50}ms` }}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SearchPanel;
