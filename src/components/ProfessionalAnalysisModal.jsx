import { useState, useEffect, useRef } from 'react';
import { X, FileText, CheckCircle, Loader, AlertCircle, Download, Play } from 'lucide-react';
import axios from 'axios';
import * as storageService from '../services/storageService';

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

  // Financial report state
  const [financialStage, setFinancialStage] = useState('idle'); // 'idle' | 'running' | 'completed' | 'error'
  const [financialReportHtml, setFinancialReportHtml] = useState('');
  const [financialError, setFinancialError] = useState('');
  const [financialSummary, setFinancialSummary] = useState(null);

  // Active report tab (when both reports are available)
  const [activeReport, setActiveReport] = useState('professional'); // 'professional' | 'financial'

  // Document sidebar state
  const [documents, setDocuments] = useState([]);
  const [selectedDocuments, setSelectedDocuments] = useState([]); // Array of document IDs
  const [additionalInfo, setAdditionalInfo] = useState('');
  const [loadingDocuments, setLoadingDocuments] = useState(false);
  const [documentsError, setDocumentsError] = useState('');

  // Référence pour nettoyer l'interval lors du démontage
  const progressIntervalRef = useRef(null);

  // Nettoyer l'interval lors du démontage ou de la fermeture
  useEffect(() => {
    return () => {
      if (progressIntervalRef.current) {
        console.log('🧹 Cleaning up progress interval on unmount');
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
    };
  }, []);

  // Nettoyer quand la modal se ferme
  useEffect(() => {
    if (!isOpen && progressIntervalRef.current) {
      console.log('🧹 Cleaning up progress interval on modal close');
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  }, [isOpen]);

  // Load documents when modal opens and business changes
  useEffect(() => {
    if (isOpen && (business?.siren || business?.siret)) {
      loadDocuments();
    }
  }, [isOpen, business?.siren, business?.siret]);

  const loadDocuments = async () => {
    setLoadingDocuments(true);
    setDocumentsError('');
    try {
      // Use SIREN or SIRET - backend will extract SIREN automatically
      const businessId = business.siren || business.siret;
      console.log('📁 Loading documents for business ID:', businessId);
      const docs = await storageService.getDocuments(businessId);
      console.log('📄 Documents loaded:', docs.length);
      setDocuments(docs);
    } catch (error) {
      console.error('Error loading documents:', error);
      setDocumentsError('Erreur lors du chargement des documents');
      setDocuments([]);
    } finally {
      setLoadingDocuments(false);
    }
  };

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
    console.log('🚀 Starting professional analysis...');
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

    // Nettoyer tout interval existant
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }

    try {
      // Simuler la progression (mise à jour optimiste)
      let currentAgentIndex = 0;
      progressIntervalRef.current = setInterval(() => {
        if (currentAgentIndex < agents.length) {
          console.log(`📊 Progress: ${agents[currentAgentIndex].label} (${currentAgentIndex + 1}/10)`);
          setProgress(prev => ({
            ...prev,
            [agents[currentAgentIndex].id]: 'running'
          }));
          currentAgentIndex++;
        }
      }, 6000); // Toutes les 6 secondes (10 agents * 6s = 60s)

      console.log('📡 Calling ADK pipeline API...');

      // Appel API backend (nouveau pipeline ADK)
      const response = await axios.post(
        'http://localhost:3001/api/analyze-professional-adk',
        { business: business },
        { timeout: 240000 } // 4 minutes timeout (au lieu de 2 minutes)
      );

      console.log('✅ API response received:', response.status);

      // Nettoyer l'interval
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }

      if (response.data.success) {
        console.log('✅ Analysis completed successfully');

        // Marquer tous les agents comme complétés
        const completedProgress = {};
        agents.forEach(agent => {
          completedProgress[agent.id] = 'completed';
        });
        setProgress(completedProgress);

        // Stocker le rapport et les métadonnées
        if (response.data.report?.html) {
          console.log('📄 Report HTML received, size:', response.data.report.html.length, 'characters');
          setReportHtml(response.data.report.html);
        } else {
          console.warn('⚠️ No HTML in response:', response.data.report);
        }

        setMetadata(response.data.metadata);
        setStage('completed');
      } else {
        throw new Error(response.data.message || 'Analyse échouée');
      }

    } catch (error) {
      console.error('❌ Professional analysis failed:', error);
      console.error('Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        code: error.code
      });

      // Nettoyer l'interval en cas d'erreur
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }

      // Message d'erreur détaillé
      let errorMsg = 'Erreur inconnue';
      if (error.code === 'ECONNABORTED') {
        errorMsg = 'Timeout: L\'analyse prend plus de temps que prévu. Le pipeline ADK peut prendre jusqu\'à 3-4 minutes avec des données complexes.';
      } else if (error.response?.data?.message) {
        errorMsg = error.response.data.message;
      } else if (error.message) {
        errorMsg = error.message;
      }

      console.error('💬 Error message shown to user:', errorMsg);
      setErrorMessage(errorMsg);
      setStage('error');
    }
  };

  /**
   * Télécharge le rapport HTML professionnel
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
   * Télécharge le rapport HTML financier
   */
  const downloadFinancialReport = () => {
    const blob = new Blob([financialReportHtml], { type: 'text/html; charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rapport_financier_${business.siret || 'commerce'}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  /**
   * Format file size for display
   */
  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  /**
   * Format date for display
   */
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  /**
   * Convert file to base64 for API transmission
   */
  const convertFileToBase64 = async (documentId) => {
    try {
      const url = storageService.getDocumentDownloadUrl(business.siren || business.siret, documentId);
      const response = await axios.get(url, { responseType: 'blob' });

      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(response.data);
      });
    } catch (error) {
      console.error('Error converting file to base64:', error);
      throw error;
    }
  };

  /**
   * Handle financial report generation
   */
  const handleFinancialReport = async () => {
    console.log('📊 Financial report requested', {
      selectedDocuments,
      additionalInfo,
      documentCount: selectedDocuments.length
    });

    if (selectedDocuments.length === 0) {
      alert('Veuillez sélectionner au moins un document');
      return;
    }

    setFinancialStage('running');
    setFinancialError('');
    setFinancialReportHtml('');
    setFinancialSummary(null);

    try {
      console.log('📄 Converting documents to base64...');

      // Convert selected documents to base64
      const documentsWithContent = await Promise.all(
        selectedDocuments.map(async (docId) => {
          const doc = documents.find(d => d.id === docId);
          if (!doc) {
            throw new Error(`Document ${docId} not found`);
          }

          const base64Content = await convertFileToBase64(docId);

          return {
            filename: doc.filename,
            content: base64Content,
            type: 'application/pdf'
          };
        })
      );

      console.log('✅ Documents converted, calling Financial Pipeline API...');

      // Call Financial Pipeline
      const response = await axios.post(
        'http://localhost:3001/api/analyze-financial',
        {
          documents: documentsWithContent,
          businessInfo: {
            name: business.nom_complet || business.nom_raison_sociale || 'Commerce',
            siret: business.siret || business.siren,
            nafCode: business.activite_principale || '',
            activity: business.libelle_activite_principale || ''
          },
          userComments: {
            autres: additionalInfo
          },
          options: {
            includeImmobilier: true
          }
        },
        {
          timeout: 300000 // 5 minutes timeout for financial analysis
        }
      );

      console.log('✅ Financial Pipeline completed:', response.data);

      if (response.data.success) {
        setFinancialSummary(response.data.summary);

        // Load the generated HTML report
        if (response.data.reportFilename) {
          try {
            const reportUrl = `http://localhost:3001/data/financial-reports/${response.data.reportFilename}`;
            const reportResponse = await axios.get(reportUrl);
            setFinancialReportHtml(reportResponse.data);
            console.log('📄 Financial report HTML loaded');
          } catch (error) {
            console.error('Error loading report HTML:', error);
            setFinancialError('Rapport généré mais impossible de le charger');
          }
        }

        setFinancialStage('completed');
      } else {
        throw new Error(response.data.message || 'Analyse financière échouée');
      }

    } catch (error) {
      console.error('❌ Financial analysis failed:', error);

      let errorMsg = 'Erreur lors de l\'analyse financière';
      if (error.code === 'ECONNABORTED') {
        errorMsg = 'Timeout: L\'analyse financière prend plus de temps que prévu (maximum 5 minutes)';
      } else if (error.response?.data?.message) {
        errorMsg = error.response.data.message;
      } else if (error.message) {
        errorMsg = error.message;
      }

      setFinancialError(errorMsg);
      setFinancialStage('error');
    }
  };

  /**
   * Réinitialise le modal
   */
  const handleClose = () => {
    // Empêcher la fermeture pendant l'analyse (sauf si erreur)
    if (stage === 'running') {
      const confirmClose = window.confirm(
        'L\'analyse est en cours. Êtes-vous sûr de vouloir fermer ?\n\nLe pipeline sera interrompu et vous devrez recommencer.'
      );
      if (!confirmClose) {
        console.log('⚠️ User cancelled modal close during analysis');
        return;
      }
      console.log('⚠️ User forcefully closed modal during analysis');

      // Nettoyer l'interval
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
    }

    setStage('idle');
    setProgress({});
    setReportHtml('');
    setErrorMessage('');
    setMetadata(null);

    // Reset document sidebar state
    setDocuments([]);
    setSelectedDocuments([]);
    setAdditionalInfo('');
    setLoadingDocuments(false);
    setDocumentsError('');

    // Reset financial report state
    setFinancialStage('idle');
    setFinancialReportHtml('');
    setFinancialError('');
    setFinancialSummary(null);
    setActiveReport('professional');

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
          {/* LEFT SIDEBAR - Documents */}
          <div className="w-72 border-r border-gray-200 p-6 overflow-y-auto bg-white hidden lg:block">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
              <FileText size={20} className="text-blue-600" />
              <span>Documents</span>
            </h3>

            {/* Document List Section */}
            {loadingDocuments ? (
              <div className="flex items-center justify-center py-8">
                <Loader size={24} className="text-blue-600 animate-spin" />
              </div>
            ) : documentsError ? (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {documentsError}
              </div>
            ) : documents.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-sm">
                <FileText size={40} className="mx-auto mb-2 opacity-50" />
                <p>Aucun document uploadé</p>
              </div>
            ) : (
              <div className="space-y-2 mb-6">
                {documents.map((doc) => (
                  <label
                    key={doc.id}
                    className="flex items-start space-x-3 p-3 bg-gray-50 hover:bg-gray-100 rounded-lg cursor-pointer transition border border-gray-200"
                  >
                    <input
                      type="checkbox"
                      checked={selectedDocuments.includes(doc.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedDocuments([...selectedDocuments, doc.id]);
                        } else {
                          setSelectedDocuments(selectedDocuments.filter(id => id !== doc.id));
                        }
                      }}
                      className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate" title={doc.filename}>
                        {doc.filename}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatFileSize(doc.size)} • {formatDate(doc.uploadDate)}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            )}

            {/* Additional Information Section */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Informations complémentaires
              </label>
              <textarea
                value={additionalInfo}
                onChange={(e) => setAdditionalInfo(e.target.value)}
                placeholder="Notes, instructions, contexte..."
                className="w-full h-24 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              />
            </div>

            {/* Rapport Financier Button */}
            <button
              onClick={handleFinancialReport}
              disabled={selectedDocuments.length === 0 || financialStage === 'running'}
              className={`w-full flex items-center justify-center space-x-2 py-3 px-4 rounded-lg font-semibold text-sm transition ${
                selectedDocuments.length === 0 || financialStage === 'running'
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm'
              }`}
            >
              {financialStage === 'running' ? (
                <>
                  <Loader size={18} className="animate-spin" />
                  <span>Analyse en cours...</span>
                </>
              ) : (
                <>
                  <FileText size={18} />
                  <span>Rapport financier</span>
                  {selectedDocuments.length > 0 && (
                    <span className="bg-white text-blue-600 rounded-full px-2 py-0.5 text-xs font-bold">
                      {selectedDocuments.length}
                    </span>
                  )}
                </>
              )}
            </button>

            {/* Financial Report Status */}
            {financialStage === 'completed' && financialSummary && (
              <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm font-semibold text-green-800 mb-2 flex items-center">
                  <CheckCircle size={16} className="mr-1" />
                  Rapport financier généré
                </p>
                <div className="text-xs text-green-700 space-y-1">
                  <p>Verdict: <span className="font-bold">{financialSummary.verdict}</span></p>
                  <p>Score santé: {financialSummary.healthScore}/100</p>
                  <p>Confiance: {financialSummary.confidence}/100</p>
                </div>
              </div>
            )}

            {financialStage === 'error' && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm font-semibold text-red-800 mb-1 flex items-center">
                  <AlertCircle size={16} className="mr-1" />
                  Erreur
                </p>
                <p className="text-xs text-red-700">{financialError}</p>
              </div>
            )}
          </div>

          {/* RIGHT SIDEBAR - Progression */}
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
                    Durée estimée: 60-180 secondes • 10 agents • Coût API: ~$0.20
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

            {(stage === 'completed' || financialStage === 'completed') && (
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Tabs (if both reports are available) */}
                {stage === 'completed' && financialStage === 'completed' && (
                  <div className="flex border-b border-gray-200 bg-gray-50">
                    <button
                      onClick={() => setActiveReport('professional')}
                      className={`flex-1 px-4 py-3 text-sm font-medium transition ${
                        activeReport === 'professional'
                          ? 'border-b-2 border-purple-600 text-purple-600 bg-white'
                          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                      }`}
                    >
                      📊 Rapport Professionnel
                    </button>
                    <button
                      onClick={() => setActiveReport('financial')}
                      className={`flex-1 px-4 py-3 text-sm font-medium transition ${
                        activeReport === 'financial'
                          ? 'border-b-2 border-blue-600 text-blue-600 bg-white'
                          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                      }`}
                    >
                      💰 Rapport Financier
                    </button>
                  </div>
                )}

                {/* Professional Report */}
                {stage === 'completed' && (activeReport === 'professional' || financialStage !== 'completed') && (
                  <>
                    {/* Toolbar */}
                    <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
                      <p className="text-sm text-gray-600 flex items-center space-x-2">
                        <CheckCircle size={16} className="text-green-600" />
                        <span>Rapport professionnel généré</span>
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
                    <div className="flex-1 overflow-hidden bg-gray-100">
                      {reportHtml ? (
                        <iframe
                          srcDoc={reportHtml}
                          className="w-full h-full border-0"
                          title="Rapport Professionnel"
                          sandbox="allow-same-origin"
                          onError={(e) => {
                            console.error('❌ Iframe error:', e);
                          }}
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <div className="text-center">
                            <AlertCircle size={48} className="text-amber-500 mx-auto mb-4" />
                            <p className="text-gray-600">
                              Le rapport a été généré mais le contenu HTML est vide.
                            </p>
                            <button
                              onClick={downloadReport}
                              className="mt-4 flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition mx-auto"
                            >
                              <Download size={18} />
                              <span>Télécharger quand même</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* Financial Report */}
                {financialStage === 'completed' && activeReport === 'financial' && (
                  <>
                    {/* Toolbar */}
                    <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
                      <p className="text-sm text-gray-600 flex items-center space-x-2">
                        <CheckCircle size={16} className="text-green-600" />
                        <span>Rapport financier généré</span>
                        {financialSummary && (
                          <span className={`ml-2 px-2 py-1 rounded text-xs font-semibold ${
                            financialSummary.verdict === 'FAVORABLE'
                              ? 'bg-green-100 text-green-800'
                              : financialSummary.verdict === 'FAVORABLE AVEC RÉSERVES'
                              ? 'bg-orange-100 text-orange-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {financialSummary.verdict}
                          </span>
                        )}
                      </p>
                      <button
                        onClick={downloadFinancialReport}
                        className="flex items-center space-x-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition"
                      >
                        <Download size={18} />
                        <span>Télécharger HTML</span>
                      </button>
                    </div>

                    {/* Report iframe */}
                    <div className="flex-1 overflow-hidden bg-gray-100">
                      {financialReportHtml ? (
                        <iframe
                          srcDoc={financialReportHtml}
                          className="w-full h-full border-0"
                          title="Rapport Financier"
                          sandbox="allow-same-origin allow-scripts"
                          onError={(e) => {
                            console.error('❌ Financial iframe error:', e);
                          }}
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <div className="text-center">
                            <AlertCircle size={48} className="text-amber-500 mx-auto mb-4" />
                            <p className="text-gray-600">
                              Le rapport financier a été généré mais le contenu HTML est vide.
                            </p>
                            <button
                              onClick={downloadFinancialReport}
                              className="mt-4 flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition mx-auto"
                            >
                              <Download size={18} />
                              <span>Télécharger quand même</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
