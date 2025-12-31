import { useState, useEffect, useRef } from 'react';
import { X, FileText, CheckCircle, Loader, AlertCircle, Download, Play } from 'lucide-react';
import axios from 'axios';
import * as storageService from '../services/storageService';
import { FormInput, FormTextarea, RadioCardGroup, Button, Badge, Card } from './ui';

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
  const [fraisPersonnelN1, setFraisPersonnelN1] = useState(''); // Frais personnel N+1 (€/an)
  const [repriseSalaries, setRepriseSalaries] = useState(true); // Reprise des salariés du cédant (oui/non)
  const [loyerActuel, setLoyerActuel] = useState(''); // Loyer actuel (€/mois)
  const [loyerNegocie, setLoyerNegocie] = useState(''); // Loyer négocié (€/mois)
  const [secteurActivite, setSecteurActivite] = useState(''); // Secteur d'activité sélectionné (code NAF)
  const [loadingDocuments, setLoadingDocuments] = useState(false);
  const [documentsError, setDocumentsError] = useState('');
  const [extractionOnly, setExtractionOnly] = useState(false); // Stop after extraction for debugging

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

    // Validate loyer fields
    if (loyerNegocie && !loyerActuel) {
      alert('Veuillez renseigner le loyer actuel pour calculer l\'économie');
      return;
    }

    if (loyerActuel && loyerNegocie && parseFloat(loyerNegocie) > parseFloat(loyerActuel)) {
      const confirmProceed = window.confirm(
        'Le loyer négocié est supérieur au loyer actuel. Voulez-vous continuer ?'
      );
      if (!confirmProceed) return;
    }

    // Validate frais personnel with reprise_salaries
    if (!repriseSalaries && !fraisPersonnelN1) {
      alert('Si vous ne reprenez pas le personnel, veuillez indiquer les frais personnel N+1 prévus');
      return;
    }

    // Validate secteur d'activité (REQUIRED)
    if (!secteurActivite) {
      alert('Veuillez sélectionner un secteur d\'activité');
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
            nafCode: business.activite_principale || '',      // NAF from API (audit trail)
            secteurActivite: secteurActivite,                  // User-selected sector (REQUIRED)
            activity: business.libelle_activite_principale || ''
          },
          userComments: {
            frais_personnel_N1: fraisPersonnelN1 ? parseFloat(fraisPersonnelN1) : undefined,
            reprise_salaries: repriseSalaries,
            loyer: {
              loyer_actuel: loyerActuel ? parseFloat(loyerActuel) : undefined,
              loyer_negocie: loyerNegocie ? parseFloat(loyerNegocie) : undefined
            },
            autres: additionalInfo
          },
          options: {
            includeImmobilier: true,
            extractionOnly: extractionOnly // Stop after DocumentExtractionAgent if true
          }
        },
        {
          timeout: extractionOnly ? 60000 : 300000 // 1 minute for extraction only, 5 minutes for full analysis
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
    setFraisPersonnelN1('');
    setRepriseSalaries(true);
    setLoyerActuel('');
    setLoyerNegocie('');
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
    <div className="fixed inset-0 bg-surface-900 flex items-center justify-center z-[1100] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-[95vw] h-[92vh] flex flex-col">
        {/* Header - Gojiberry Style */}
        <div className="flex items-center justify-between px-8 py-6 border-b border-surface-300">
          <div className="flex-1">
            <h2 className="text-xl font-bold text-text-primary">
              {business?.nom_complet || business?.nom_raison_sociale || 'Commerce'}
            </h2>
            {business?.siret && (
              <p className="text-sm text-text-tertiary mt-1">
                SIRET: {business.siret}
              </p>
            )}
          </div>
          <button
            onClick={handleClose}
            className="flex-shrink-0 ml-4 p-2 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-surface-200 transition-all duration-200"
            aria-label="Fermer"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content - 50/50 Layout */}
        <div className="flex-1 overflow-hidden flex">
          {/* LEFT PANEL - Forms (50%) - Gojiberry Style */}
          <div className="w-1/2 border-r border-surface-300 p-8 overflow-y-auto bg-surface-100 space-y-8">
            {/* Section 1: Documents */}
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-text-primary flex items-center gap-2">
                <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary-500 text-white">
                  <FileText size={18} />
                </span>
                Documents financiers
              </h3>

              {loadingDocuments ? (
                <div className="flex items-center justify-center py-12">
                  <Loader size={28} className="text-primary-500 animate-spin" />
                </div>
              ) : documentsError ? (
                <div className="p-4 bg-danger-50 border-2 border-danger-200 rounded-xl text-sm text-danger-700">
                  {documentsError}
                </div>
              ) : documents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-text-tertiary">
                  <FileText size={48} className="opacity-30 mb-3" />
                  <p className="text-sm">Aucun document uploadé</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {documents.map((doc) => (
                    <Card
                      key={doc.id}
                      padding="none"
                      hover
                      className={`transition-all duration-200 ${
                        selectedDocuments.includes(doc.id)
                          ? 'border-primary-500 bg-primary-50'
                          : 'border-surface-300 bg-white'
                      }`}
                    >
                      <label className="flex items-center gap-4 p-5 cursor-pointer">
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
                          className="w-5 h-5 rounded-md accent-primary-500 cursor-pointer"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-text-primary truncate" title={doc.filename}>
                            {doc.filename}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-text-tertiary">{formatFileSize(doc.size)}</span>
                            <span className="text-text-tertiary">•</span>
                            <span className="text-xs text-text-tertiary">{formatDate(doc.uploadDate)}</span>
                          </div>
                        </div>
                      </label>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {/* Section 2: Additional Information */}
            <FormTextarea
              label="Informations complémentaires"
              icon="📝"
              value={additionalInfo}
              onChange={(e) => setAdditionalInfo(e.target.value)}
              placeholder="Notes, instructions, contexte..."
              rows={5}
              helpText="Ajoutez toute information utile pour l'analyse"
            />

            {/* Section 3: Frais Personnel N+1 */}
            <FormInput
              type="number"
              label="Frais personnel N+1"
              icon="€"
              value={fraisPersonnelN1}
              onChange={(e) => setFraisPersonnelN1(e.target.value)}
              placeholder="76 900"
              prefix="€"
              min="0"
              step="1000"
              helpText="Frais personnel prévus après reprise (TNS + salariés + charges sociales)"
            />

            {/* Section 4: Reprise des Salariés - Radio Cards */}
            <RadioCardGroup
              label="Reprise des salariés"
              icon="👥"
              value={repriseSalaries}
              onChange={setRepriseSalaries}
              options={[
                {
                  value: true,
                  emoji: "✓",
                  label: "Oui",
                  description: "Conservation"
                },
                {
                  value: false,
                  emoji: "✗",
                  label: "Non",
                  description: "Suppression"
                }
              ]}
              columns={2}
              helpText="Si 'Non', les charges de personnel actuelles seront retraitées dans le pont EBE"
            />

            {/* Section 5: Loyer Commercial */}
            <div className="space-y-4">
              <label className="flex items-center gap-2 text-sm font-medium text-text-primary">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-accent-pink-200 text-text-primary text-xs">
                  🏠
                </span>
                Loyer commercial
              </label>
              <div className="grid grid-cols-2 gap-3">
                <FormInput
                  type="number"
                  label="Actuel (€/mois)"
                  value={loyerActuel}
                  onChange={(e) => setLoyerActuel(e.target.value)}
                  placeholder="2 600"
                  prefix="€"
                  min="0"
                  step="100"
                  className="text-sm"
                />
                <FormInput
                  type="number"
                  label="Négocié (€/mois)"
                  value={loyerNegocie}
                  onChange={(e) => setLoyerNegocie(e.target.value)}
                  placeholder="1 800"
                  prefix="€"
                  min="0"
                  step="100"
                  className="text-sm"
                />
              </div>
              <p className="text-xs text-text-tertiary leading-relaxed">
                Si négocié &lt; actuel, l'économie sera affichée dans le pont EBE
              </p>
            </div>

            {/* Section 6: Secteur d'activité - REQUIRED */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-text-primary">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-accent-orange-200 text-text-primary text-xs">
                  🏪
                </span>
                Secteur d'activité
                <span className="text-error-600 ml-1">*</span>
              </label>
              <select
                value={secteurActivite}
                onChange={(e) => setSecteurActivite(e.target.value)}
                className="w-full px-3 py-2.5 text-sm bg-white border-2 border-surface-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
                required
              >
                <option value="">-- Sélectionner un secteur --</option>
                <option value="47.11">Commerce non spécialisé (Superette, Alimentation)</option>
                <option value="47.26">Tabac / Presse / Loto</option>
                <option value="10.71">Boulangerie-Pâtisserie</option>
                <option value="56.10">Restauration traditionnelle</option>
                <option value="56.30">Débits de boissons (Bar, Café)</option>
                <option value="96.02">Coiffure</option>
                <option value="47.7">Commerce spécialisé habillement</option>
                <option value="47.73">Pharmacie</option>
                <option value="55.10">Hôtellerie</option>
              </select>
              <p className="text-xs text-text-tertiary leading-relaxed">
                Sélectionnez le secteur pour obtenir des benchmarks sectoriels pertinents
              </p>
            </div>

            {/* Extraction Only Checkbox */}
            <div className="flex items-center gap-3 p-4 bg-white rounded-xl border-2 border-surface-300">
              <input
                type="checkbox"
                checked={extractionOnly}
                onChange={(e) => setExtractionOnly(e.target.checked)}
                className="w-5 h-5 rounded-md accent-primary-500 cursor-pointer"
                id="extraction-only"
              />
              <label htmlFor="extraction-only" className="flex-1 cursor-pointer">
                <span className="text-sm font-medium text-text-primary block">
                  Extraction seulement (debug)
                </span>
                {extractionOnly && (
                  <span className="text-xs text-warning-600 block mt-1">
                    Le pipeline s'arrêtera après l'extraction Gemini Vision
                  </span>
                )}
              </label>
            </div>

            {/* Rapport Financier Button - Gojiberry Style */}
            <Button
              onClick={handleFinancialReport}
              disabled={selectedDocuments.length === 0 || financialStage === 'running'}
              loading={financialStage === 'running'}
              icon={<FileText size={20} />}
              badge={selectedDocuments.length > 0 ? selectedDocuments.length : null}
              size="md"
              variant="primary"
              className="w-full"
            >
              {extractionOnly ? 'Test extraction' : 'Générer le rapport financier'}
            </Button>

            {/* Financial Report Status - Gojiberry Style */}
            {financialStage === 'completed' && financialSummary && (
              <Card padding="md" className="bg-success-50 border-success-500">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-success-500 flex items-center justify-center">
                    <CheckCircle size={18} className="text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-success-800 mb-2">
                      Rapport financier généré
                    </p>
                    <div className="space-y-1 text-sm text-success-700">
                      <p>Verdict: <span className="font-bold">{financialSummary.verdict}</span></p>
                      <p>Score santé: <span className="font-bold">{financialSummary.healthScore}/100</span></p>
                      <p>Confiance: <span className="font-bold">{financialSummary.confidence}/100</span></p>
                    </div>
                  </div>
                </div>
              </Card>
            )}

            {financialStage === 'error' && (
              <Card padding="md" className="bg-danger-50 border-danger-500">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-danger-500 flex items-center justify-center">
                    <AlertCircle size={18} className="text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-danger-800 mb-1">Erreur</p>
                    <p className="text-sm text-danger-700">{financialError}</p>
                  </div>
                </div>
              </Card>
            )}
          </div>

          {/* RIGHT PANEL - Report/Progress (50%) - Gojiberry Style */}
          <div className="w-1/2 flex flex-col overflow-hidden bg-white">
            {/* État: IDLE - Écran de démarrage Gojiberry */}
            {stage === 'idle' && financialStage !== 'completed' && (
              <div className="flex-1 flex flex-col items-center justify-center p-12 bg-gradient-to-br from-surface-100 to-white">
                <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center mb-6 shadow-2xl">
                  <Play className="w-12 h-12 text-white" />
                </div>
                <h3 className="text-3xl font-bold text-text-primary mb-3">
                  Prêt à analyser
                </h3>
                <p className="text-text-secondary text-center max-w-md leading-relaxed mb-8">
                  Remplissez les informations à gauche et générez le rapport financier pour démarrer l'analyse professionnelle complète.
                </p>
                <div className="flex flex-wrap gap-2 justify-center mb-8">
                  <Badge variant="cyan">10 agents IA</Badge>
                  <Badge variant="yellow">~2 min</Badge>
                  <Badge variant="violet">Analyse complète</Badge>
                </div>
                <Button
                  onClick={startAnalysis}
                  icon={<Play size={20} />}
                  size="lg"
                  variant="secondary"
                >
                  Lancer l'analyse professionnelle
                </Button>
              </div>
            )}

            {/* État: RUNNING - Progression des agents Gojiberry */}
            {stage === 'running' && (
              <div className="flex-1 p-8 overflow-y-auto bg-surface-50">
                <div className="mb-8">
                  <h3 className="text-xl font-bold text-text-primary mb-4">
                    Analyse en cours
                  </h3>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex-1 h-3 bg-surface-300 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-primary-400 to-primary-600 transition-all duration-500 rounded-full"
                        style={{ width: `${(Object.values(progress).filter(s => s === 'completed').length / agents.length) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium text-text-secondary">
                      {Object.values(progress).filter(s => s === 'completed').length}/{agents.length}
                    </span>
                  </div>
                </div>

                <div className="space-y-3">
                  {agents.map((agent) => {
                    const status = progress[agent.id] || 'pending';
                    const isCompleted = status === 'completed';
                    const isRunning = status === 'running';

                    return (
                      <Card
                        key={agent.id}
                        padding="none"
                        className={`transition-all duration-300 ${
                          isCompleted
                            ? 'border-success-500 bg-success-50'
                            : isRunning
                              ? 'border-primary-500 bg-primary-50 animate-pulse'
                              : 'border-surface-400 bg-surface-100'
                        }`}
                      >
                        <div className="flex items-center gap-4 p-5">
                          <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-xl ${
                            isCompleted ? 'bg-success-500' : isRunning ? 'bg-primary-500' : 'bg-surface-400'
                          }`}>
                            {isCompleted ? (
                              <CheckCircle className="w-5 h-5 text-white" />
                            ) : isRunning ? (
                              <Loader className="w-5 h-5 text-white animate-spin" />
                            ) : (
                              <span className="opacity-50">{agent.icon}</span>
                            )}
                          </div>
                          <div className="flex-1">
                            <p className="font-semibold text-text-primary">{agent.label}</p>
                          </div>
                          {isCompleted && <Badge variant="success">Terminé</Badge>}
                          {isRunning && <Badge variant="primary">En cours</Badge>}
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}

            {/* État: ERROR - Affichage d'erreur Gojiberry */}
            {stage === 'error' && (
              <div className="flex-1 flex flex-col items-center justify-center p-12">
                <div className="w-24 h-24 rounded-3xl bg-danger-500 flex items-center justify-center mb-6 shadow-xl">
                  <AlertCircle className="w-12 h-12 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-text-primary mb-3">
                  Erreur d'analyse
                </h3>
                <p className="text-text-secondary text-center max-w-md mb-8">
                  {errorMessage || 'Une erreur est survenue lors de l\'analyse'}
                </p>
                <Button
                  onClick={startAnalysis}
                  icon={<Play size={20} />}
                  size="md"
                  variant="primary"
                >
                  Réessayer
                </Button>
              </div>
            )}

            {/* État: COMPLETED - Affichage des rapports Gojiberry */}
            {(stage === 'completed' || financialStage === 'completed') && (
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Tabs (if both reports are available) - Gojiberry Style */}
                {stage === 'completed' && financialStage === 'completed' && (
                  <div className="flex gap-2 p-4 border-b border-surface-300 bg-surface-100">
                    <button
                      onClick={() => setActiveReport('professional')}
                      className={`flex-1 px-6 py-3 rounded-xl font-semibold text-sm transition-all duration-200 ${
                        activeReport === 'professional'
                          ? 'bg-white text-primary-600 shadow-md border-2 border-primary-500'
                          : 'bg-transparent text-text-secondary hover:bg-surface-100'
                      }`}
                    >
                      📊 Analyse Professionnelle
                    </button>
                    <button
                      onClick={() => setActiveReport('financial')}
                      className={`flex-1 px-6 py-3 rounded-xl font-semibold text-sm transition-all duration-200 ${
                        activeReport === 'financial'
                          ? 'bg-white text-primary-600 shadow-md border-2 border-primary-500'
                          : 'bg-transparent text-text-secondary hover:bg-surface-100'
                      }`}
                    >
                      💰 Analyse Financière
                    </button>
                  </div>
                )}

                {/* Professional Report */}
                {stage === 'completed' && (activeReport === 'professional' || financialStage !== 'completed') && (
                  <>
                    {/* Toolbar - Gojiberry Style */}
                    <div className="px-6 py-4 border-b border-surface-300 flex items-center justify-between bg-white">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-success-500 flex items-center justify-center">
                          <CheckCircle size={18} className="text-white" />
                        </div>
                        <span className="font-medium text-text-primary">Rapport professionnel généré</span>
                      </div>
                      <Button
                        onClick={downloadReport}
                        icon={<Download size={18} />}
                        variant="secondary"
                        size="sm"
                      >
                        Télécharger HTML
                      </Button>
                    </div>

                    {/* Report iframe */}
                    <div className="flex-1 overflow-hidden bg-surface-200">
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
                            <p className="text-text-secondary">
                              Le rapport a été généré mais le contenu HTML est vide.
                            </p>
                            <button
                              onClick={downloadReport}
                              className="mt-4 flex items-center space-x-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-xl font-medium transition mx-auto"
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
                    <div className="p-4 border-b border-surface-300 flex items-center justify-between bg-surface-100">
                      <p className="text-sm text-text-secondary flex items-center space-x-2">
                        <CheckCircle size={16} className="text-success-600" />
                        <span>Rapport financier généré</span>
                        {financialSummary && (
                          <span className={`ml-2 px-2 py-1 rounded text-xs font-semibold ${
                            financialSummary.verdict === 'FAVORABLE'
                              ? 'bg-success-100 text-success-800'
                              : financialSummary.verdict === 'FAVORABLE AVEC RÉSERVES'
                              ? 'bg-warning-100 text-warning-800'
                              : 'bg-danger-100 text-danger-800'
                          }`}>
                            {financialSummary.verdict}
                          </span>
                        )}
                      </p>
                      <button
                        onClick={downloadFinancialReport}
                        className="flex items-center space-x-2 bg-success-600 hover:bg-success-700 text-white px-4 py-2 rounded-lg font-medium transition"
                      >
                        <Download size={18} />
                        <span>Télécharger HTML</span>
                      </button>
                    </div>

                    {/* Report iframe */}
                    <div className="flex-1 overflow-hidden bg-surface-200">
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
                            <p className="text-text-secondary">
                              Le rapport financier a été généré mais le contenu HTML est vide.
                            </p>
                            <button
                              onClick={downloadFinancialReport}
                              className="mt-4 flex items-center space-x-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-xl font-medium transition mx-auto"
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
