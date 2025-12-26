import React, { useState } from 'react';
import { ShoppingCart, FileText, X, Trash2, Loader, Star } from 'lucide-react';
import axios from 'axios';
import { generateMarkdownReport } from '../utils/reportGenerator';
import ProfessionalAnalysisModal from './ProfessionalAnalysisModal';

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
                    // Call backend to analyze business (Orchestration of 4 modules)
                    const response = await axios.post('http://localhost:3001/api/analyze-business', {
                        businessData: item
                    });

                    // Add analyzed data to the list
                    enrichedItems.push(response.data);

                } catch (err) {
                    console.error(`Failed to analyze ${item.nom_complet}`, err);
                    // Fallback: keep original item with empty analysis structure
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
        console.log('🔍 Opening professional analysis for:', business);
        setCurrentAnalysisBusiness(business);
        setAnalysisModalOpen(true);
        console.log('✅ Modal state set to open');
    };

    return (
        <>
            {/* Widget Button (Visible when closed) */}
            <div className={`fixed top-4 right-4 z-[1000] transition-all duration-300 ${isOpen ? 'translate-x-[200%]' : 'translate-x-0'}`}>
                <button
                    onClick={() => setIsOpen(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-full shadow-lg flex items-center justify-center transition-colors relative group"
                >
                    <ShoppingCart size={24} />
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-6 w-6 flex items-center justify-center border-2 border-white dark:border-gray-800 shadow-sm">
                        {cartCount}
                    </span>
                    <span className="absolute right-full mr-3 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                        Voir le panier
                    </span>
                </button>
            </div>

            {/* Cart Panel */}
            <div className={`fixed inset-y-0 right-0 w-96 bg-white dark:bg-gray-900 shadow-2xl transform transition-transform duration-300 ease-in-out z-[1001] flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                {/* Header */}
                <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between bg-gray-50 dark:bg-gray-800">
                    <div className="flex items-center space-x-2 text-gray-800 dark:text-white">
                        <ShoppingCart size={20} className="text-blue-600" />
                        <h2 className="font-bold text-lg">Mon Panier ({cartCount})</h2>
                    </div>
                    <button
                        onClick={() => setIsOpen(false)}
                        className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors text-gray-500 dark:text-gray-400"
                        aria-label="Fermer le panier"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {cartItems.map((item) => (
                        <div key={item.siren || item.siret} className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700 group hover:shadow-md transition-all hover:border-blue-300 dark:hover:border-blue-700">
                            <div className="flex justify-between items-start mb-2">
                                <div className="flex-1 pr-3">
                                    <h3 className="font-semibold text-gray-900 dark:text-white text-sm line-clamp-2">
                                        {item.nom_complet || item.enseigne || "Entreprise sans nom"}
                                    </h3>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center">
                                        <span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-1.5"></span>
                                        {item.adresse_code_postal} {item.adresse_ville}
                                    </p>
                                </div>
                                <button
                                    onClick={() => onRemoveFromCart(item.siren || item.siret)}
                                    className="text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 p-1.5 rounded transition-all"
                                    title="Retirer du panier"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                            <button
                                onClick={() => handleProfessionalAnalysis(item)}
                                className="w-full flex items-center justify-center space-x-2 bg-purple-600 hover:bg-purple-700 text-white py-2 px-3 rounded-lg font-medium text-xs transition-all shadow-sm hover:shadow-md mt-2"
                            >
                                <Star size={14} />
                                <span>Analyse Professionnelle</span>
                            </button>
                        </div>
                    ))}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 space-y-3">
                    <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                        <span>Total entreprises</span>
                        <span className="font-semibold text-gray-900 dark:text-white">{cartCount}</span>
                    </div>
                    <button
                        onClick={handleGenerateReport}
                        disabled={loading}
                        className={`w-full flex items-center justify-center space-x-2 text-white py-3 rounded-lg font-medium transition-colors shadow-md ${loading
                            ? 'bg-blue-400 cursor-not-allowed'
                            : 'bg-blue-600 hover:bg-blue-700 hover:shadow-lg active:transform active:scale-[0.98]'
                            }`}
                    >
                        {loading ? (
                            <>
                                <Loader size={18} className="animate-spin" />
                                <span>{progress}</span>
                            </>
                        ) : (
                            <>
                                <FileText size={18} />
                                <span>Générer le rapport</span>
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Overlay */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/40 z-[1000] backdrop-blur-[2px] transition-opacity"
                    onClick={() => setIsOpen(false)}
                />
            )}

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
