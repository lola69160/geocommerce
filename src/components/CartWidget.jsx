import React, { useState } from 'react';
import { ShoppingCart, FileText, X, Trash2, Loader2, Sparkles, MapPin, ChevronRight } from 'lucide-react';
import axios from 'axios';
import { generateMarkdownReport } from '../utils/reportGenerator';
import ProfessionalAnalysisModal from './ProfessionalAnalysisModal';
import { Button, Card, CountBadge } from './ui';

/**
 * CartWidget Component - Tech Premium Design System
 *
 * Floating cart panel with slide-out animation.
 * Features:
 * - Floating button with count badge
 * - Slide-out panel with glass effect
 * - Cart items with professional analysis button
 * - Report generation with progress
 */
const CartWidget = ({ cart, notes, onRemoveFromCart }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');
  const [analysisModalOpen, setAnalysisModalOpen] = useState(false);
  const [currentAnalysisBusiness, setCurrentAnalysisBusiness] = useState(null);

  const cartItems = Object.values(cart);
  const cartCount = cartItems.length;

  if (cartCount === 0) return null;

  const handleGenerateReport = async () => {
    setLoading(true);
    setProgress('Préparation...');

    try {
      const enrichedItems = [];
      let count = 0;

      for (const item of cartItems) {
        count++;
        setProgress(`Analyse ${count}/${cartCount}...`);

        try {
          const response = await axios.post('http://localhost:3001/api/analyze-business', {
            businessData: item
          });
          enrichedItems.push(response.data);
        } catch (err) {
          console.error(`Failed to analyze ${item.nom_complet}`, err);
          enrichedItems.push({
            identity: {
              legal_name: item.nom_complet || item.nom_raison_sociale || 'Nom Inconnu',
              commercial_name: item.enseigne || item.nom_complet || 'Nom Inconnu',
              siret: item.siret
            },
            assets: { photos: [], reviews: [], rating: null, user_rating_total: 0 },
            intelligence: "Analyse échouée.",
            openData: item
          });
        }
      }

      setProgress('Génération du PDF...');
      generateMarkdownReport(enrichedItems);

    } catch (error) {
      console.error('Error generating report:', error);
      alert('Une erreur est survenue lors de la génération du rapport.');
    } finally {
      setLoading(false);
      setProgress('');
    }
  };

  const handleProfessionalAnalysis = (business) => {
    console.log('Opening professional analysis for:', business);
    setCurrentAnalysisBusiness(business);
    setAnalysisModalOpen(true);
  };

  return (
    <>
      {/* Floating Cart Button */}
      <div className={`
        fixed top-4 right-4 z-[1000]
        transition-all duration-normal ease-out
        ${isOpen ? 'translate-x-[200%] opacity-0' : 'translate-x-0 opacity-100'}
      `}>
        <button
          onClick={() => setIsOpen(true)}
          className={`
            relative
            p-4
            rounded-2xl
            bg-gradient-to-r from-cyan-500 to-cyan-600
            text-white
            shadow-dark-xl
            hover:shadow-glow-cyan
            hover:from-cyan-400 hover:to-cyan-500
            transition-all duration-fast
            active:scale-95
            group
          `}
        >
          <ShoppingCart size={24} />

          {/* Count Badge */}
          <span className={`
            absolute -top-1 -right-1
            min-w-[22px] h-[22px]
            flex items-center justify-center
            bg-red-500
            text-white text-xs font-bold
            rounded-full
            border-2 border-surface-900
            shadow-dark-sm
            animate-bounce-in
          `}>
            {cartCount}
          </span>

          {/* Tooltip */}
          <span className={`
            absolute right-full mr-3 top-1/2 -translate-y-1/2
            px-3 py-1.5
            bg-surface-800
            text-text-primary text-xs font-medium
            rounded-lg
            border border-[rgba(255,255,255,0.1)]
            shadow-dark-lg
            whitespace-nowrap
            opacity-0 group-hover:opacity-100
            -translate-x-2 group-hover:translate-x-0
            transition-all duration-fast
            pointer-events-none
          `}>
            Voir le panier
          </span>
        </button>
      </div>

      {/* Backdrop */}
      {isOpen && (
        <div
          className={`
            fixed inset-0 z-[1001]
            bg-black/60
            backdrop-blur-sm
            animate-fade-in
          `}
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Cart Panel */}
      <div className={`
        fixed inset-y-0 right-0 z-[1002]
        w-96 max-w-[90vw]
        bg-surface-800
        border-l border-[rgba(255,255,255,0.06)]
        shadow-dark-2xl
        flex flex-col
        transform transition-transform duration-normal ease-out
        ${isOpen ? 'translate-x-0' : 'translate-x-full'}
      `}>
        {/* Header */}
        <div className="p-4 border-b border-[rgba(255,255,255,0.06)] bg-surface-900/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-cyan-500/15">
                <ShoppingCart size={20} className="text-cyan-400" />
              </div>
              <div>
                <h2 className="font-display font-bold text-lg text-text-primary">
                  Mon Panier
                </h2>
                <p className="text-xs text-text-muted">
                  {cartCount} entreprise{cartCount > 1 ? 's' : ''} sélectionnée{cartCount > 1 ? 's' : ''}
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsOpen(false)}
              className={`
                p-2
                rounded-lg
                text-text-muted
                hover:text-text-primary
                hover:bg-surface-700
                transition-colors duration-fast
              `}
              aria-label="Fermer le panier"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {cartItems.map((item, index) => (
            <Card
              key={item.siren || item.siret}
              variant="default"
              hover
              glow
              padding="none"
              className="animate-fade-in-up"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="p-3">
                {/* Item Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-sm text-text-primary line-clamp-2">
                      {item.nom_complet || item.enseigne || "Entreprise sans nom"}
                    </h3>
                    <div className="flex items-center gap-1.5 mt-1 text-xs text-text-muted">
                      <MapPin size={12} className="text-cyan-500" />
                      <span>{item.adresse_code_postal} {item.adresse_ville}</span>
                    </div>
                  </div>

                  {/* Remove Button */}
                  <button
                    onClick={() => onRemoveFromCart(item.siren || item.siret)}
                    className={`
                      p-1.5
                      rounded-lg
                      text-text-muted
                      hover:text-red-400
                      hover:bg-red-500/15
                      transition-colors duration-fast
                    `}
                    title="Retirer du panier"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                {/* Professional Analysis Button */}
                <button
                  onClick={() => handleProfessionalAnalysis(item)}
                  className={`
                    w-full mt-3
                    flex items-center justify-center gap-2
                    px-3 py-2
                    rounded-lg
                    bg-gradient-to-r from-violet-500/20 to-violet-600/20
                    text-violet-400
                    border border-violet-500/30
                    font-medium text-xs
                    hover:from-violet-500/30 hover:to-violet-600/30
                    hover:border-violet-500/50
                    transition-all duration-fast
                    active:scale-98
                    group
                  `}
                >
                  <Sparkles size={14} className="group-hover:animate-pulse" />
                  <span>Analyse Professionnelle</span>
                  <ChevronRight size={14} className="opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                </button>
              </div>
            </Card>
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[rgba(255,255,255,0.06)] bg-surface-900/50 space-y-4">
          {/* Summary */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-text-muted">Total entreprises</span>
            <span className="font-mono font-bold text-cyan-400">
              {cartCount}
            </span>
          </div>

          {/* Generate Report Button */}
          <Button
            onClick={handleGenerateReport}
            disabled={loading}
            variant="primary"
            size="lg"
            fullWidth
            glow={!loading}
            icon={loading ? <Loader2 size={18} className="animate-spin" /> : <FileText size={18} />}
          >
            {loading ? progress : 'Générer le rapport'}
          </Button>
        </div>
      </div>

      {/* Professional Analysis Modal */}
      <ProfessionalAnalysisModal
        isOpen={analysisModalOpen}
        onClose={() => setAnalysisModalOpen(false)}
        business={currentAnalysisBusiness}
      />
    </>
  );
};

export default CartWidget;
