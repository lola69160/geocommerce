import React, { useState } from 'react';
import { ShoppingCart, FileText, X, Trash2, Loader2, Sparkles, MapPin, ChevronRight } from 'lucide-react';
import axios from 'axios';
import { generateMarkdownReport } from '../utils/reportGenerator';
import BusinessAnalysisModal from './BusinessAnalysisModal';
import { Button, Card } from './ui';

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
  const [initialAnalysisView, setInitialAnalysisView] = useState('professional');

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
    setInitialAnalysisView('professional');
    setAnalysisModalOpen(true);
  };

  const handleFinancialAnalysis = (business) => {
    console.log('Opening financial analysis for:', business);
    setCurrentAnalysisBusiness(business);
    setInitialAnalysisView('financial');
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
            bg-primary-500
            text-white
            shadow-lg
            hover:shadow-xl
            hover:bg-primary-600
            transition-all duration-fast
            active:scale-95
            group
          `}
        >
          <ShoppingCart size={24} />

          {/* Count Badge */}
          <span className={`
            absolute -top-1 -right-1
            min-w-[24px] h-[24px]
            flex items-center justify-center
            bg-danger-500
            text-white text-xs font-bold
            rounded-full
            border-2 border-white
            shadow-md
            animate-bounce-in
          `}>
            {cartCount}
          </span>

          {/* Tooltip */}
          <span className={`
            absolute left-full ml-3 top-1/2 -translate-y-1/2
            px-4 py-2
            bg-white
            text-text-primary text-sm font-medium
            rounded-xl
            border border-surface-300
            shadow-lg
            whitespace-nowrap
            opacity-0 group-hover:opacity-100
            translate-x-2 group-hover:translate-x-0
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
            bg-surface-900
            animate-fade-in
          `}
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Cart Panel */}
      <div className={`
        fixed inset-y-0 right-0 z-[1002]
        w-96 max-w-[90vw]
        bg-white
        border-l border-surface-300
        shadow-xl
        flex flex-col
        transform transition-transform duration-normal ease-out
        ${isOpen ? 'translate-x-0' : 'translate-x-full'}
      `}>
        {/* Header */}
        <div className="p-5 border-b border-surface-300 bg-surface-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary-100">
                <ShoppingCart size={20} className="text-primary-600" />
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
                text-text-tertiary
                hover:text-text-primary
                hover:bg-surface-200
                transition-all duration-fast
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
                      hover:bg-red-100
                      transition-colors duration-fast
                    `}
                    title="Retirer du panier"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                {/* Professional & Financial Analysis Buttons */}
                <div className="mt-3 flex gap-2">
                  {/* Professional Analysis Button */}
                  <button
                    onClick={() => handleProfessionalAnalysis(item)}
                    className={`
                      flex-1 flex items-center justify-center gap-2
                      px-3 py-2
                      rounded-lg
                      bg-accent-violet-100
                      text-accent-violet-700
                      border border-accent-violet-300
                      font-medium text-xs
                      hover:bg-accent-violet-200
                      hover:border-accent-violet-400
                      transition-all duration-fast
                      active:scale-98
                      group
                    `}
                  >
                    <Sparkles size={14} className="group-hover:animate-pulse" />
                    <span>Analyse Pro</span>
                    <ChevronRight size={14} className="opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                  </button>

                  {/* Financial Analysis Button */}
                  <button
                    onClick={() => handleFinancialAnalysis(item)}
                    className={`
                      flex-1 flex items-center justify-center gap-2
                      px-3 py-2
                      rounded-lg
                      bg-accent-cyan-100
                      text-accent-cyan-700
                      border border-accent-cyan-300
                      font-medium text-xs
                      hover:bg-accent-cyan-200
                      hover:border-accent-cyan-400
                      transition-all duration-fast
                      active:scale-98
                      group
                    `}
                  >
                    <FileText size={14} className="group-hover:animate-pulse" />
                    <span>Finances</span>
                    <ChevronRight size={14} className="opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-surface-300 bg-surface-100 space-y-4">
          {/* Summary */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-text-secondary font-medium">Total entreprises</span>
            <span className="font-mono font-bold text-primary-600 text-lg">
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

      {/* Business Analysis Modal */}
      <BusinessAnalysisModal
        isOpen={analysisModalOpen}
        onClose={() => setAnalysisModalOpen(false)}
        business={currentAnalysisBusiness}
        initialView={initialAnalysisView}
      />
    </>
  );
};

export default CartWidget;
