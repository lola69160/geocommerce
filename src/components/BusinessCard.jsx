import React, { useState, forwardRef } from 'react';
import { Copy, Check, ChevronDown, ChevronRight, FileText, FolderOpen, ShoppingCart, CheckCircle } from 'lucide-react';
import { Card } from './ui';
import { getDisplayName, hasEnseigne, getEstablishmentCreationDate, formatDate } from '../utils/businessDisplayUtils';

/**
 * BusinessCard Component - Tech Premium Design System
 *
 * Displays a single business result with actions.
 */
const BusinessCard = forwardRef(({
  business,
  isSelected,
  isExpanded,
  debugMode,
  hasNote,
  isInCart,
  onSelect,
  onToggleExpand,
  onOpenNote,
  onOpenDocuments,
  onAddToCart,
  style,
}, ref) => {
  const [copiedId, setCopiedId] = useState(null);
  const businessId = business.siren || business.siret;

  const handleCopy = (text, id, e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  return (
    <Card
      ref={ref}
      variant={isSelected ? 'elevated' : 'default'}
      hover={!isSelected}
      glow={isSelected}
      interactive
      padding="none"
      style={style}
      className={`
        transition-all duration-normal
        ${isSelected
          ? 'border-primary-500/50 ring-1 ring-primary-500/20'
          : 'hover:border-primary-500/30'
        }
      `}
    >
      {/* Main content area */}
      <div
        onClick={() => onSelect(business)}
        className="p-4 cursor-pointer"
      >
        {/* Header: Name + Badges */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-display font-semibold text-text-primary truncate">
              {getDisplayName(business)}
            </h3>
            {hasEnseigne(business) && (
              <p className="text-sm text-text-muted italic truncate">
                {business.nom_complet}
              </p>
            )}
          </div>

          {/* Note indicator dot */}
          {hasNote && (
            <span
              className="w-2 h-2 rounded-full bg-red-500 animate-pulse flex-shrink-0 mt-2"
              title="Note enregistrée"
            />
          )}
        </div>

        {/* Address */}
        <p className="text-sm text-text-secondary mt-1 line-clamp-2">
          {business.adresse}
        </p>

        {/* Badges row */}
        <div className="flex flex-wrap gap-2 mt-3">
          {/* BODACC Badge */}
          {business.hasBodacc && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              Ventes BODACC
            </span>
          )}

          {/* Closed Days Badge */}
          {business.closedDays && business.closedDays.length > 0 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/15 text-amber-400 border border-amber-500/30">
              Fermé: {business.closedDays.join(', ')}
            </span>
          )}

          {/* In Cart Badge */}
          {isInCart && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-700 border border-primary-300">
              <CheckCircle size={10} className="mr-1" />
              Panier
            </span>
          )}
        </div>

        {/* Dates */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-xs text-text-muted">
          {getEstablishmentCreationDate(business) && (
            <span className="flex items-center gap-1">
              <span className="text-primary-600">Créé:</span>
              {formatDate(getEstablishmentCreationDate(business))}
            </span>
          )}
          {business.date_mise_a_jour_insee && (
            <span className="flex items-center gap-1">
              <span className="text-violet-500">MAJ:</span>
              {formatDate(business.date_mise_a_jour_insee)}
            </span>
          )}
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-3 gap-2 mt-4">
          {/* Note Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenNote(business);
            }}
            className={`
              flex items-center justify-center gap-1.5
              px-3 py-2
              rounded-lg
              text-xs font-medium
              transition-all duration-fast
              active:scale-95
              ${hasNote
                ? 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30'
                : 'bg-surface-200 text-text-secondary border border-transparent hover:border-primary-500/30 hover:text-primary-600'
              }
            `}
          >
            <FileText size={14} />
            <span>{hasNote ? 'Modifier' : 'Note'}</span>
          </button>

          {/* Documents Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenDocuments(business);
            }}
            className={`
              flex items-center justify-center gap-1.5
              px-3 py-2
              rounded-lg
              text-xs font-medium
              bg-violet-500/20 text-violet-400 border border-violet-500/30
              hover:bg-violet-500/30
              transition-all duration-fast
              active:scale-95
            `}
          >
            <FolderOpen size={14} />
            <span>Docs</span>
          </button>

          {/* Cart Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAddToCart(business);
            }}
            className={`
              flex items-center justify-center gap-1.5
              px-3 py-2
              rounded-lg
              text-xs font-medium
              transition-all duration-fast
              active:scale-95
              ${isInCart
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30'
                : 'bg-primary-100 text-primary-700 border border-primary-300 hover:bg-primary-200'
              }
            `}
          >
            {isInCart ? <CheckCircle size={14} /> : <ShoppingCart size={14} />}
            <span>{isInCart ? 'Ajouté' : 'Panier'}</span>
          </button>
        </div>
      </div>

      {/* Debug Mode Section */}
      {debugMode && (
        <div className="px-4 pb-4 pt-2 border-t border-surface-500">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand(businessId);
            }}
            className="flex items-center gap-2 text-xs font-medium text-primary-600 hover:text-primary-700 transition-colors"
          >
            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            <span>API: recherche-entreprises.api.gouv.fr</span>
          </button>

          {isExpanded && (
            <div className="relative mt-3">
              <button
                onClick={(e) => handleCopy(JSON.stringify(business, null, 2), businessId, e)}
                className={`
                  absolute top-2 right-2 z-10
                  p-1.5 rounded-md
                  bg-surface-200 border border-surface-300
                  text-text-muted hover:text-primary-600
                  transition-colors duration-fast
                `}
                title="Copier le JSON"
              >
                {copiedId === businessId
                  ? <Check size={12} className="text-emerald-400" />
                  : <Copy size={12} />
                }
              </button>

              <pre className={`
                p-3 pt-8
                bg-surface-900
                border border-surface-500
                rounded-lg
                text-xs font-mono
                text-text-secondary
                max-h-64 overflow-auto
                whitespace-pre-wrap break-words
              `}>
                {JSON.stringify(business, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </Card>
  );
});

BusinessCard.displayName = 'BusinessCard';

export default BusinessCard;
