import { useState } from 'react';
import { X, FileText, CheckCircle, Loader, AlertCircle, Download, Play } from 'lucide-react';
import axios from 'axios';

/**
 * ProfessionalAnalysisModal - Modal d'analyse professionnelle
 *
 * Affiche la progression des agents et le rapport HTML généré
 */
export default function ProfessionalAnalysisModal({ isOpen, onClose, business }) {
  console.log('🎯 ProfessionalAnalysisModal render:', { isOpen, business: business?.nom_complet || business?.siret });

  const [stage, setStage] = useState('idle'); // 'idle' | 'running' | 'completed' | 'error'
  const [progress, setProgress] = useState({});
  const [reportHtml, setReportHtml] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [metadata, setMetadata] = useState(null);

  // Configuration des agents avec icônes (10 agents ADK complets)
  const agents = [
    { id: 'preparation', label: 'Préparation', icon: '📋' },
    { id: 'demographic', label: 'Analyse Démographique', icon: '👥' },
    { id: 'places', label: 'Enrichissement Google', icon: '📍' },
    { id: 'photo', label: 'Analyse Photos IA', icon: '📸' },
    { id: 'competitor', label: 'Cartographie Concurrence', icon: '🗺️' },
    { id: 'validation', label: 'Validation Croisée', icon: '✅' },
    { id: 'gap', label: 'Scoring Global', icon: '📊' },
    { id: 'arbitration', label: 'Arbitrage Conflits', icon: '⚖️' },
    { id: 'strategic', label: 'Recommandations Stratégiques', icon: '🎯' },
    { id: 'report', label: 'Génération Rapport', icon: '📄' }
  ];

  /**
   * Lance l'analyse professionnelle
   */
  const startAnalysis = async () => {
    setStage('running');
    setProgress({});
    setErrorMessage('');
    setReportHtml('');

    // Initialiser le suivi de progression
    const initialProgress = {};
    agents.forEach(agent => {
      initialProgress[agent.id] = 'pending';
    });
    setProgress(initialProgress);

    try {
      // Simuler la progression (mise à jour optimiste)
      let currentAgentIndex = 0;
      const progressInterval = setInterval(() => {
        if (currentAgentIndex < agents.length) {
          setProgress(prev => ({
            ...prev,
            [agents[currentAgentIndex].id]: 'running'
          }));
          currentAgentIndex++;
        }
      }, 2000); // Toutes les 2 secondes

      // Appel API backend (nouveau pipeline ADK)
      const response = await axios.post(
        'http://localhost:3001/api/analyze-professional-adk',
        { business: business },
        { timeout: 120000 } // 2 minutes timeout
      );

      clearInterval(progressInterval);

      if (response.data.success) {
        // Marquer tous les agents comme complétés
        const completedProgress = {};
        agents.forEach(agent => {
          completedProgress[agent.id] = 'completed';
        });
        setProgress(completedProgress);

        // Stocker le rapport et les métadonnées
        setReportHtml(response.data.report.html);
        setMetadata(response.data.metadata);
        setStage('completed');
      } else {
        throw new Error(response.data.message || 'Analyse échouée');
      }

    } catch (error) {
      console.error('Professional analysis failed:', error);
      setErrorMessage(error.response?.data?.message || error.message || 'Erreur inconnue');
      setStage('error');
    }
  };

  /**
   * Télécharge le rapport HTML
   */
  const downloadReport = () => {
    const blob = new Blob([reportHtml], { type: 'text/html; charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rapport_professionnel_${business.siret || 'commerce'}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  /**
   * Réinitialise le modal
   */
  const handleClose = () => {
    setStage('idle');
    setProgress({});
    setReportHtml('');
    setErrorMessage('');
    setMetadata(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[1100] p-4">
      <div className="bg-white rounded-lg shadow-2xl w-[90vw] h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 flex items-center space-x-2">
              <FileText size={28} className="text-purple-600" />
              <span>Analyse Professionnelle</span>
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {business?.nom_complet || business?.nom_raison_sociale || 'Commerce'}
              {business?.siret && <span className="ml-2 text-gray-400">• SIRET: {business.siret}</span>}
            </p>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex">
          {/* Sidebar - Progression */}
          <div className="w-80 border-r border-gray-200 p-6 overflow-y-auto bg-gray-50">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Progression</h3>

            {/* Agents Progress */}
            <div className="space-y-3">
              {agents.map((agent) => {
                const status = progress[agent.id] || 'pending';
                return (
                  <div
                    key={agent.id}
                    className={`p-4 rounded-lg border-2 transition ${
                      status === 'completed'
                        ? 'border-green-500 bg-green-50'
                        : status === 'running'
                        ? 'border-blue-500 bg-blue-50 animate-pulse'
                        : 'border-gray-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <span className="text-2xl">{agent.icon}</span>
                      <div className="flex-1">
                        <p className="font-medium text-sm text-gray-900">{agent.label}</p>
                      </div>
                      {status === 'completed' && <CheckCircle size={20} className="text-green-600" />}
                      {status === 'running' && <Loader size={20} className="text-blue-600 animate-spin" />}
                      {status === 'pending' && <div className="w-5 h-5 rounded-full border-2 border-gray-300" />}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Metadata */}
            {metadata && (
              <div className="mt-6 p-4 bg-white rounded-lg border border-gray-200">
                <p className="text-xs font-semibold text-gray-600 mb-2">Statistiques</p>
                <div className="space-y-1 text-xs text-gray-700">
                  <p>⏱️ Durée: {Math.round(metadata.duration / 1000)}s</p>
                  <p>✅ Agents: {metadata.agents_executed}</p>
                  <p>🕐 {new Date(metadata.timestamp).toLocaleString('fr-FR')}</p>
                </div>
              </div>
            )}
          </div>

          {/* Main Content - Report or Start Screen */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {stage === 'idle' && (
              <div className="flex-1 flex items-center justify-center p-12">
                <div className="text-center max-w-md">
                  <div className="mb-6">
                    <FileText size={64} className="text-purple-600 mx-auto mb-4" />
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">
                      Rapport de Due Diligence
                    </h3>
                    <p className="text-gray-600">
                      Générez une analyse professionnelle complète avec :
                    </p>
                  </div>

                  <ul className="text-left space-y-2 mb-8 text-gray-700">
                    <li className="flex items-start space-x-2">
                      <CheckCircle size={20} className="text-green-600 mt-0.5" />
                      <span>Analyse démographique et zone de chalandise</span>
                    </li>
                    <li className="flex items-start space-x-2">
                      <CheckCircle size={20} className="text-green-600 mt-0.5" />
                      <span>Analyse état physique et estimation travaux (Gemini Vision)</span>
                    </li>
                    <li className="flex items-start space-x-2">
                      <CheckCircle size={20} className="text-green-600 mt-0.5" />
                      <span>Cartographie concurrence et attractivité zone</span>
                    </li>
                    <li className="flex items-start space-x-2">
                      <CheckCircle size={20} className="text-green-600 mt-0.5" />
                      <span>Score global multi-critères (GO/NO-GO)</span>
                    </li>
                    <li className="flex items-start space-x-2">
                      <CheckCircle size={20} className="text-green-600 mt-0.5" />
                      <span>Recommandations stratégiques IA (Gemini Thinking)</span>
                    </li>
                    <li className="flex items-start space-x-2">
                      <CheckCircle size={20} className="text-green-600 mt-0.5" />
                      <span>Rapport HTML professionnel (style McKinsey)</span>
                    </li>
                  </ul>

                  <button
                    onClick={startAnalysis}
                    className="flex items-center space-x-2 bg-purple-600 hover:bg-purple-700 text-white px-8 py-4 rounded-lg font-semibold text-lg transition mx-auto"
                  >
                    <Play size={24} />
                    <span>Lancer l'analyse</span>
                  </button>

                  <p className="mt-4 text-xs text-gray-500">
                    Durée estimée: 45-90 secondes • 8 agents • Coût API: ~$0.20
                  </p>
                </div>
              </div>
            )}

            {stage === 'running' && (
              <div className="flex-1 flex items-center justify-center p-12">
                <div className="text-center">
                  <Loader size={64} className="text-purple-600 mx-auto mb-4 animate-spin" />
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">
                    Analyse en cours...
                  </h3>
                  <p className="text-gray-600">
                    Les agents travaillent sur votre rapport professionnel
                  </p>
                </div>
              </div>
            )}

            {stage === 'error' && (
              <div className="flex-1 flex items-center justify-center p-12">
                <div className="text-center max-w-md">
                  <AlertCircle size={64} className="text-red-600 mx-auto mb-4" />
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">
                    Erreur d'analyse
                  </h3>
                  <p className="text-gray-600 mb-6">
                    {errorMessage || 'Une erreur est survenue lors de l\'analyse'}
                  </p>
                  <button
                    onClick={startAnalysis}
                    className="flex items-center space-x-2 bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg font-medium transition mx-auto"
                  >
                    <Play size={20} />
                    <span>Réessayer</span>
                  </button>
                </div>
              </div>
            )}

            {stage === 'completed' && reportHtml && (
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Toolbar */}
                <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
                  <p className="text-sm text-gray-600 flex items-center space-x-2">
                    <CheckCircle size={16} className="text-green-600" />
                    <span>Rapport généré avec succès</span>
                  </p>
                  <button
                    onClick={downloadReport}
                    className="flex items-center space-x-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition"
                  >
                    <Download size={18} />
                    <span>Télécharger HTML</span>
                  </button>
                </div>

                {/* Report iframe */}
                <div className="flex-1 overflow-hidden">
                  <iframe
                    srcDoc={reportHtml}
                    className="w-full h-full border-0"
                    title="Rapport Professionnel"
                    sandbox="allow-same-origin"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
