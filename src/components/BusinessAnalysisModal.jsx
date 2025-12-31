import { useState, useEffect, useRef } from 'react';
import { X, FileText, CheckCircle, Loader, AlertCircle, Download, Play } from 'lucide-react';
import axios from 'axios';
import * as storageService from '../services/storageService';
import { FormInput, FormTextarea, RadioCardGroup, Button, Badge, Card } from './ui';

/**
 * BusinessAnalysisModal - Unified modal for professional & financial analysis
 *
 * Supports two analysis modes:
 * - Professional: 10-agent ADK pipeline for comprehensive business analysis
 * - Financial: Document-based financial analysis with benchmarking
 *
 * @prop {boolean} isOpen - Modal visibility
 * @prop {function} onClose - Close handler
 * @prop {object} business - Business data
 * @prop {string} initialView - Initial view: 'professional' | 'financial' (default: 'professional')
 */
export default function BusinessAnalysisModal({ isOpen, onClose, business, initialView = 'professional' }) {
  console.log('🎯 BusinessAnalysisModal render:', { isOpen, business: business?.nom_complet || business?.siret, initialView });

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
  const [activeReport, setActiveReport] = useState(initialView); // 'professional' | 'financial'

  // Document sidebar state
  const [documents, setDocuments] = useState([]);
  const [selectedDocuments, setSelectedDocuments] = useState([]); // Array of document IDs
  const [additionalInfo, setAdditionalInfo] = useState('');
  const [fraisPersonnelN1, setFraisPersonnelN1] = useState(''); // Frais personnel N+1 (€/an)
  const [repriseSalaries, setRepriseSalaries] = useState(true); // Reprise des salariés du cédant (oui/non)
  const [loyerActuel, setLoyerActuel] = useState(''); // Loyer actuel (€/mois)
  const [loyerNegocie, setLoyerNegocie] = useState(''); // Loyer négocié (€/mois)
  const [secteurActivite, setSecteurActivite] = useState(''); // Secteur d'activité sélectionné (code NAF)
  const [secteurActiviteLabel, setSecteurActiviteLabel] = useState(''); // Label exact du secteur pour affichage
  const [loadingDocuments, setLoadingDocuments] = useState(false);
  const [documentsError, setDocumentsError] = useState('');
  const [extractionOnly, setExtractionOnly] = useState(false); // Stop after extraction for debugging

  // ========================================
  // FINANCING DATA: State Variables (44 total)
  // ========================================

  // Section 7: Investment Data (12 input variables)
  const [prixFondsInitial, setPrixFondsInitial] = useState('');
  const [honorairesHtInitial, setHonorairesHtInitial] = useState('');
  const [fraisActeHtInitial, setFraisActeHtInitial] = useState('');
  const [deboursInitial, setDeboursInitial] = useState('');
  const [stockFondsRoulementInitial, setStockFondsRoulementInitial] = useState('');
  const [loyerAvanceInitial, setLoyerAvanceInitial] = useState('');

  const [prixFondsNegocie, setPrixFondsNegocie] = useState('');
  const [honorairesHtNegocie, setHonorairesHtNegocie] = useState('');
  const [fraisActeHtNegocie, setFraisActeHtNegocie] = useState('');
  const [deboursNegocie, setDeboursNegocie] = useState('');
  const [stockFondsRoulementNegocie, setStockFondsRoulementNegocie] = useState('');
  const [loyerAvanceNegocie, setLoyerAvanceNegocie] = useState('');

  // Section 8: Financing Sources (6 input variables)
  const [apportInitial, setApportInitial] = useState('');
  const [pretRelaisTvaInitial, setPretRelaisTvaInitial] = useState('');
  const [creditVendeurInitial, setCreditVendeurInitial] = useState('');

  const [apportNegocie, setApportNegocie] = useState('');
  const [pretRelaisTvaNegocie, setPretRelaisTvaNegocie] = useState('');
  const [creditVendeurNegocie, setCreditVendeurNegocie] = useState('');

  // Section 9: Loan Parameters (6 input variables)
  const [dureeInitial, setDureeInitial] = useState('');
  const [tauxInteretInitial, setTauxInteretInitial] = useState('');
  const [tauxAssuranceInitial, setTauxAssuranceInitial] = useState('');

  const [dureeNegocie, setDureeNegocie] = useState('');
  const [tauxInteretNegocie, setTauxInteretNegocie] = useState('');
  const [tauxAssuranceNegocie, setTauxAssuranceNegocie] = useState('');

  // Auto-calculated fields (8 total)
  const [tvaSurHonorairesInitial, setTvaSurHonorairesInitial] = useState(0);
  const [totalInvestissementInitial, setTotalInvestissementInitial] = useState(0);
  const [tvaSurHonorairesNegocie, setTvaSurHonorairesNegocie] = useState(0);
  const [totalInvestissementNegocie, setTotalInvestissementNegocie] = useState(0);

  const [pretPrincipalInitial, setPretPrincipalInitial] = useState(0);
  const [pretPrincipalNegocie, setPretPrincipalNegocie] = useState(0);

  const [estimationAnnuelleInitial, setEstimationAnnuelleInitial] = useState(0);
  const [estimationAnnuelleNegocie, setEstimationAnnuelleNegocie] = useState(0);

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

  // Synchronize activeReport with initialView when it changes
  useEffect(() => {
    setActiveReport(initialView);
  }, [initialView]);

  // ========================================
  // FINANCING DATA: Auto-Calculation Logic
  // ========================================

  // Helper function: Calculate loan annual payment
  const calculateLoanPayment = (principal, tauxInteret, tauxAssurance, dureeAnnees) => {
    if (principal <= 0 || dureeAnnees <= 0) return 0;

    const tauxTotal = (parseFloat(tauxInteret) || 0) + (parseFloat(tauxAssurance) || 0);

    if (tauxTotal === 0) {
      // No interest - simple division
      return (principal / (dureeAnnees * 12)) * 12;
    }

    const r = tauxTotal / 100 / 12; // Monthly rate
    const n = dureeAnnees * 12; // Total months

    const mensualite = principal * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
    return Math.round(mensualite * 12);
  };

  // Auto-calc 1: TVA sur honoraires - Initial
  useEffect(() => {
    const honoraires = parseFloat(honorairesHtInitial) || 0;
    const fraisActe = parseFloat(fraisActeHtInitial) || 0;
    const tva = (honoraires + fraisActe) * 0.206;
    setTvaSurHonorairesInitial(Math.round(tva));
  }, [honorairesHtInitial, fraisActeHtInitial]);

  // Auto-calc 2: TVA sur honoraires - Négocié
  useEffect(() => {
    const honoraires = parseFloat(honorairesHtNegocie) || 0;
    const fraisActe = parseFloat(fraisActeHtNegocie) || 0;
    const tva = (honoraires + fraisActe) * 0.206;
    setTvaSurHonorairesNegocie(Math.round(tva));
  }, [honorairesHtNegocie, fraisActeHtNegocie]);

  // Auto-calc 3: Total investissement - Initial
  useEffect(() => {
    const prixFonds = parseFloat(prixFondsInitial) || 0;
    const honoraires = parseFloat(honorairesHtInitial) || 0;
    const fraisActe = parseFloat(fraisActeHtInitial) || 0;
    const tva = tvaSurHonorairesInitial;
    const debours = parseFloat(deboursInitial) || 0;
    const stock = parseFloat(stockFondsRoulementInitial) || 0;
    const loyerAvance = parseFloat(loyerAvanceInitial) || 0;

    const total = prixFonds + honoraires + fraisActe + tva + debours + stock + loyerAvance;
    setTotalInvestissementInitial(Math.round(total));
  }, [prixFondsInitial, honorairesHtInitial, fraisActeHtInitial, tvaSurHonorairesInitial,
    deboursInitial, stockFondsRoulementInitial, loyerAvanceInitial]);

  // Auto-calc 4: Total investissement - Négocié
  useEffect(() => {
    const prixFonds = parseFloat(prixFondsNegocie) || 0;
    const honoraires = parseFloat(honorairesHtNegocie) || 0;
    const fraisActe = parseFloat(fraisActeHtNegocie) || 0;
    const tva = tvaSurHonorairesNegocie;
    const debours = parseFloat(deboursNegocie) || 0;
    const stock = parseFloat(stockFondsRoulementNegocie) || 0;
    const loyerAvance = parseFloat(loyerAvanceNegocie) || 0;

    const total = prixFonds + honoraires + fraisActe + tva + debours + stock + loyerAvance;
    setTotalInvestissementNegocie(Math.round(total));
  }, [prixFondsNegocie, honorairesHtNegocie, fraisActeHtNegocie, tvaSurHonorairesNegocie,
    deboursNegocie, stockFondsRoulementNegocie, loyerAvanceNegocie]);

  // Auto-calc 5: Prêt principal - Initial
  useEffect(() => {
    const total = totalInvestissementInitial;
    const apport = parseFloat(apportInitial) || 0;
    const pretRelais = parseFloat(pretRelaisTvaInitial) || 0;
    const creditVendeur = parseFloat(creditVendeurInitial) || 0;

    const pretPrincipal = total - apport - pretRelais - creditVendeur;
    setPretPrincipalInitial(Math.max(0, Math.round(pretPrincipal))); // Never negative
  }, [totalInvestissementInitial, apportInitial, pretRelaisTvaInitial, creditVendeurInitial]);

  // Auto-calc 6: Prêt principal - Négocié
  useEffect(() => {
    const total = totalInvestissementNegocie;
    const apport = parseFloat(apportNegocie) || 0;
    const pretRelais = parseFloat(pretRelaisTvaNegocie) || 0;
    const creditVendeur = parseFloat(creditVendeurNegocie) || 0;

    const pretPrincipal = total - apport - pretRelais - creditVendeur;
    setPretPrincipalNegocie(Math.max(0, Math.round(pretPrincipal))); // Never negative
  }, [totalInvestissementNegocie, apportNegocie, pretRelaisTvaNegocie, creditVendeurNegocie]);

  // Auto-calc 7: Estimation annuelle - Initial
  useEffect(() => {
    const estimation = calculateLoanPayment(
      pretPrincipalInitial,
      tauxInteretInitial,
      tauxAssuranceInitial,
      dureeInitial
    );
    setEstimationAnnuelleInitial(estimation);
  }, [pretPrincipalInitial, tauxInteretInitial, tauxAssuranceInitial, dureeInitial]);

  // Auto-calc 8: Estimation annuelle - Négocié
  useEffect(() => {
    const estimation = calculateLoanPayment(
      pretPrincipalNegocie,
      tauxInteretNegocie,
      tauxAssuranceNegocie,
      dureeNegocie
    );
    setEstimationAnnuelleNegocie(estimation);
  }, [pretPrincipalNegocie, tauxInteretNegocie, tauxAssuranceNegocie, dureeNegocie]);

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

    // ========================================
    // FINANCING DATA: Validation Rules (6 total)
    // ========================================

    // Rule 1: Scénario incomplet (warning)
    const hasFilledInitial = prixFondsInitial || honorairesHtInitial || apportInitial || dureeInitial;
    const hasFilledNegocie = prixFondsNegocie || honorairesHtNegocie || apportNegocie || dureeNegocie;

    if (hasFilledInitial && !hasFilledNegocie) {
      const confirmProceed = window.confirm(
        'Vous avez rempli le scénario Initial mais pas le scénario Négocié.\n\n' +
        'Voulez-vous continuer sans scénario de comparaison ?'
      );
      if (!confirmProceed) return;
    }

    // Rule 2: Prix négocié > Prix initial (warning)
    if (prixFondsNegocie && prixFondsInitial &&
        parseFloat(prixFondsNegocie) > parseFloat(prixFondsInitial)) {
      const confirmProceed = window.confirm(
        'Le prix du fonds négocié est supérieur au prix initial.\n\nCela est inhabituel. Voulez-vous continuer ?'
      );
      if (!confirmProceed) return;
    }

    // Rule 3: Apport > Total investissement (error)
    if (apportInitial && totalInvestissementInitial &&
        parseFloat(apportInitial) > totalInvestissementInitial) {
      alert('Erreur: L\'apport personnel initial ne peut pas dépasser le total de l\'investissement.');
      return;
    }

    if (apportNegocie && totalInvestissementNegocie &&
        parseFloat(apportNegocie) > totalInvestissementNegocie) {
      alert('Erreur: L\'apport personnel négocié ne peut pas dépasser le total de l\'investissement.');
      return;
    }

    // Rule 4: Durée = 0 mais prêt > 0 (error)
    if (dureeInitial && parseFloat(dureeInitial) === 0 && pretPrincipalInitial > 0) {
      alert('Erreur: La durée du prêt ne peut pas être de 0 année si un prêt est sollicité.');
      return;
    }

    if (dureeNegocie && parseFloat(dureeNegocie) === 0 && pretPrincipalNegocie > 0) {
      alert('Erreur: La durée du prêt négocié ne peut pas être de 0 année si un prêt est sollicité.');
      return;
    }

    // Rule 5: Taux intérêt > 15% (warning)
    if (tauxInteretInitial && parseFloat(tauxInteretInitial) > 15) {
      const confirmProceed = window.confirm(
        `Le taux d'intérêt initial (${tauxInteretInitial}%) est très élevé.\n\nÊtes-vous sûr de cette valeur ?`
      );
      if (!confirmProceed) return;
    }

    if (tauxInteretNegocie && parseFloat(tauxInteretNegocie) > 15) {
      const confirmProceed = window.confirm(
        `Le taux d'intérêt négocié (${tauxInteretNegocie}%) est très élevé.\n\nÊtes-vous sûr de cette valeur ?`
      );
      if (!confirmProceed) return;
    }

    // Rule 6: Prêt principal négatif (error - should not happen due to Math.max(0, ...) but check anyway)
    if (pretPrincipalInitial < 0 || pretPrincipalNegocie < 0) {
      alert(
        'Erreur: Le montant du prêt principal est négatif.\n\n' +
        'Vérifiez que la somme (Apport + Prêt Relais TVA + Crédit Vendeur) ne dépasse pas le Total de l\'Investissement.'
      );
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
            secteurActivite: secteurActivite,                  // User-selected sector code (REQUIRED)
            secteurActiviteLabel: secteurActiviteLabel,        // User-selected sector label (for display)
            activity: business.libelle_activite_principale || ''
          },
          userComments: {
            frais_personnel_N1: fraisPersonnelN1 ? parseFloat(fraisPersonnelN1) : undefined,
            reprise_salaries: repriseSalaries,
            loyer: {
              loyer_actuel: loyerActuel ? parseFloat(loyerActuel) : undefined,
              loyer_negocie: loyerNegocie ? parseFloat(loyerNegocie) : undefined
            },
            autres: additionalInfo,

            // ===== NOUVEAU: Transaction Financing Data =====
            transactionFinancing: {
              initial: {
                // Investment Data
                prix_fonds: prixFondsInitial ? parseFloat(prixFondsInitial) : undefined,
                honoraires_ht: honorairesHtInitial ? parseFloat(honorairesHtInitial) : undefined,
                frais_acte_ht: fraisActeHtInitial ? parseFloat(fraisActeHtInitial) : undefined,
                tva_sur_honoraires: tvaSurHonorairesInitial || undefined,
                debours: deboursInitial ? parseFloat(deboursInitial) : undefined,
                stock_fonds_roulement: stockFondsRoulementInitial ? parseFloat(stockFondsRoulementInitial) : undefined,
                loyer_avance: loyerAvanceInitial ? parseFloat(loyerAvanceInitial) : undefined,
                total_investissement: totalInvestissementInitial || undefined,

                // Financing Sources
                apport_personnel: apportInitial ? parseFloat(apportInitial) : undefined,
                pret_relais_tva: pretRelaisTvaInitial ? parseFloat(pretRelaisTvaInitial) : undefined,
                credit_vendeur: creditVendeurInitial ? parseFloat(creditVendeurInitial) : undefined,
                pret_principal: pretPrincipalInitial || undefined,

                // Loan Parameters
                duree_annees: dureeInitial ? parseFloat(dureeInitial) : undefined,
                taux_interet: tauxInteretInitial ? parseFloat(tauxInteretInitial) : undefined,
                taux_assurance: tauxAssuranceInitial ? parseFloat(tauxAssuranceInitial) : undefined,
                estimation_annuelle: estimationAnnuelleInitial || undefined
              },

              negocie: {
                // Investment Data
                prix_fonds: prixFondsNegocie ? parseFloat(prixFondsNegocie) : undefined,
                honoraires_ht: honorairesHtNegocie ? parseFloat(honorairesHtNegocie) : undefined,
                frais_acte_ht: fraisActeHtNegocie ? parseFloat(fraisActeHtNegocie) : undefined,
                tva_sur_honoraires: tvaSurHonorairesNegocie || undefined,
                debours: deboursNegocie ? parseFloat(deboursNegocie) : undefined,
                stock_fonds_roulement: stockFondsRoulementNegocie ? parseFloat(stockFondsRoulementNegocie) : undefined,
                loyer_avance: loyerAvanceNegocie ? parseFloat(loyerAvanceNegocie) : undefined,
                total_investissement: totalInvestissementNegocie || undefined,

                // Financing Sources
                apport_personnel: apportNegocie ? parseFloat(apportNegocie) : undefined,
                pret_relais_tva: pretRelaisTvaNegocie ? parseFloat(pretRelaisTvaNegocie) : undefined,
                credit_vendeur: creditVendeurNegocie ? parseFloat(creditVendeurNegocie) : undefined,
                pret_principal: pretPrincipalNegocie || undefined,

                // Loan Parameters
                duree_annees: dureeNegocie ? parseFloat(dureeNegocie) : undefined,
                taux_interet: tauxInteretNegocie ? parseFloat(tauxInteretNegocie) : undefined,
                taux_assurance: tauxAssuranceNegocie ? parseFloat(tauxAssuranceNegocie) : undefined,
                estimation_annuelle: estimationAnnuelleNegocie || undefined
              }
            }
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

    // ========================================
    // FINANCING DATA: Reset state variables
    // ========================================
    // Section 7: Investment Data
    setPrixFondsInitial('');
    setHonorairesHtInitial('');
    setFraisActeHtInitial('');
    setDeboursInitial('');
    setStockFondsRoulementInitial('');
    setLoyerAvanceInitial('');
    setPrixFondsNegocie('');
    setHonorairesHtNegocie('');
    setFraisActeHtNegocie('');
    setDeboursNegocie('');
    setStockFondsRoulementNegocie('');
    setLoyerAvanceNegocie('');

    // Section 8: Financing Sources
    setApportInitial('');
    setPretRelaisTvaInitial('');
    setCreditVendeurInitial('');
    setApportNegocie('');
    setPretRelaisTvaNegocie('');
    setCreditVendeurNegocie('');

    // Section 9: Loan Parameters
    setDureeInitial('');
    setTauxInteretInitial('');
    setTauxAssuranceInitial('');
    setDureeNegocie('');
    setTauxInteretNegocie('');
    setTauxAssuranceNegocie('');

    // Auto-calculated fields
    setTvaSurHonorairesInitial(0);
    setTotalInvestissementInitial(0);
    setTvaSurHonorairesNegocie(0);
    setTotalInvestissementNegocie(0);
    setPretPrincipalInitial(0);
    setPretPrincipalNegocie(0);
    setEstimationAnnuelleInitial(0);
    setEstimationAnnuelleNegocie(0);

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

        {/* Content - Full Width */}
        <div className="flex-1 overflow-hidden flex">
          {/* MAIN PANEL - Full width for both workflows */}
          <div className="w-full flex flex-col overflow-hidden bg-white">

            {/* FINANCIAL WORKFLOW - Full width form */}
            {initialView === 'financial' && (
              <div className="flex-1 p-8 overflow-y-auto bg-surface-100 space-y-8">
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
                onChange={(e) => {
                  const code = e.target.value;
                  const label = code ? e.target.options[e.target.selectedIndex].text : '';
                  setSecteurActivite(code);
                  setSecteurActiviteLabel(label);
                }}
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

            {/* ===== SECTION 7: DONNÉES DU PROJET ===== */}
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-text-primary flex items-center gap-2">
                <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-accent-cyan-500 text-white">
                  💰
                </span>
                Données du Projet
              </h3>

              {/* Column headers */}
              <div className="grid grid-cols-2 gap-3">
                <div className="px-3 py-2 bg-surface-100 rounded-lg text-center">
                  <span className="text-xs font-semibold text-text-tertiary uppercase tracking-wider">
                    Scénario Initial
                  </span>
                </div>
                <div className="px-3 py-2 bg-surface-100 rounded-lg text-center">
                  <span className="text-xs font-semibold text-text-tertiary uppercase tracking-wider">
                    Scénario Négocié
                  </span>
                </div>
              </div>

              {/* Row 1: Prix du fonds de commerce */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-text-primary">
                  Prix du fonds de commerce
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <FormInput
                    type="number"
                    value={prixFondsInitial}
                    onChange={(e) => setPrixFondsInitial(e.target.value)}
                    placeholder="320 000"
                    prefix="€"
                    min="0"
                    step="1000"
                    className="text-sm"
                  />
                  <FormInput
                    type="number"
                    value={prixFondsNegocie}
                    onChange={(e) => setPrixFondsNegocie(e.target.value)}
                    placeholder="300 000"
                    prefix="€"
                    min="0"
                    step="1000"
                    className="text-sm"
                  />
                </div>
              </div>

              {/* Row 2: Honoraires HT */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-text-primary">
                  Honoraires HT
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <FormInput
                    type="number"
                    value={honorairesHtInitial}
                    onChange={(e) => setHonorairesHtInitial(e.target.value)}
                    placeholder="25 600"
                    prefix="€"
                    min="0"
                    step="100"
                    className="text-sm"
                  />
                  <FormInput
                    type="number"
                    value={honorairesHtNegocie}
                    onChange={(e) => setHonorairesHtNegocie(e.target.value)}
                    placeholder="24 000"
                    prefix="€"
                    min="0"
                    step="100"
                    className="text-sm"
                  />
                </div>
              </div>

              {/* Row 3: Frais d'actes HT */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-text-primary">
                  Frais d'actes HT
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <FormInput
                    type="number"
                    value={fraisActeHtInitial}
                    onChange={(e) => setFraisActeHtInitial(e.target.value)}
                    placeholder="2 000"
                    prefix="€"
                    min="0"
                    step="100"
                    className="text-sm"
                  />
                  <FormInput
                    type="number"
                    value={fraisActeHtNegocie}
                    onChange={(e) => setFraisActeHtNegocie(e.target.value)}
                    placeholder="2 000"
                    prefix="€"
                    min="0"
                    step="100"
                    className="text-sm"
                  />
                </div>
              </div>

              {/* Row 4: TVA sur honoraires (AUTO-CALCULATED) */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-text-primary">
                  TVA sur honoraires
                  <span className="px-2 py-0.5 bg-warning-100 text-warning-800 text-xs rounded-full font-semibold">
                    Auto
                  </span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="relative">
                    <input
                      type="text"
                      value={tvaSurHonorairesInitial.toLocaleString('fr-FR')}
                      readOnly
                      className="w-full px-5 py-4 pl-12 border-2 border-surface-300 rounded-xl bg-surface-100 text-text-secondary font-medium text-sm cursor-not-allowed"
                    />
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-tertiary font-medium">
                      €
                    </span>
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      value={tvaSurHonorairesNegocie.toLocaleString('fr-FR')}
                      readOnly
                      className="w-full px-5 py-4 pl-12 border-2 border-surface-300 rounded-xl bg-surface-100 text-text-secondary font-medium text-sm cursor-not-allowed"
                    />
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-tertiary font-medium">
                      €
                    </span>
                  </div>
                </div>
                <p className="text-xs text-text-tertiary">
                  Calcul auto: (Honoraires HT + Frais actes HT) × 20,6%
                </p>
              </div>

              {/* Row 5: Droits d'enregistrement et débours */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-text-primary">
                  Droits d'enregistrement et débours
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <FormInput
                    type="number"
                    value={deboursInitial}
                    onChange={(e) => setDeboursInitial(e.target.value)}
                    placeholder="1 500"
                    prefix="€"
                    min="0"
                    step="100"
                    className="text-sm"
                  />
                  <FormInput
                    type="number"
                    value={deboursNegocie}
                    onChange={(e) => setDeboursNegocie(e.target.value)}
                    placeholder="1 500"
                    prefix="€"
                    min="0"
                    step="100"
                    className="text-sm"
                  />
                </div>
              </div>

              {/* Row 6: Stock et Fonds de roulement */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-text-primary">
                  Stock et Fonds de roulement
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <FormInput
                    type="number"
                    value={stockFondsRoulementInitial}
                    onChange={(e) => setStockFondsRoulementInitial(e.target.value)}
                    placeholder="15 000"
                    prefix="€"
                    min="0"
                    step="1000"
                    className="text-sm"
                  />
                  <FormInput
                    type="number"
                    value={stockFondsRoulementNegocie}
                    onChange={(e) => setStockFondsRoulementNegocie(e.target.value)}
                    placeholder="15 000"
                    prefix="€"
                    min="0"
                    step="1000"
                    className="text-sm"
                  />
                </div>
              </div>

              {/* Row 7: Loyer d'avance */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-text-primary">
                  Loyer d'avance (caution/dépôt)
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <FormInput
                    type="number"
                    value={loyerAvanceInitial}
                    onChange={(e) => setLoyerAvanceInitial(e.target.value)}
                    placeholder="5 200"
                    prefix="€"
                    min="0"
                    step="100"
                    className="text-sm"
                  />
                  <FormInput
                    type="number"
                    value={loyerAvanceNegocie}
                    onChange={(e) => setLoyerAvanceNegocie(e.target.value)}
                    placeholder="3 600"
                    prefix="€"
                    min="0"
                    step="100"
                    className="text-sm"
                  />
                </div>
                <p className="text-xs text-text-tertiary">
                  Garantie locative (généralement 2-3 mois de loyer)
                </p>
              </div>

              {/* Row 8: TOTAL INVESTISSEMENT (AUTO-CALCULATED - HIGHLIGHTED) */}
              <div className="space-y-2 pt-4 border-t-2 border-surface-300">
                <label className="flex items-center gap-2 text-sm font-bold text-text-primary">
                  TOTAL DE L'INVESTISSEMENT
                  <span className="px-2 py-0.5 bg-success-100 text-success-800 text-xs rounded-full font-semibold">
                    Auto
                  </span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="relative">
                    <input
                      type="text"
                      value={totalInvestissementInitial.toLocaleString('fr-FR')}
                      readOnly
                      className="w-full px-5 py-4 pl-12 border-2 border-success-500 rounded-xl bg-success-50 text-success-800 font-bold text-base cursor-not-allowed"
                    />
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-success-700 font-bold">
                      €
                    </span>
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      value={totalInvestissementNegocie.toLocaleString('fr-FR')}
                      readOnly
                      className="w-full px-5 py-4 pl-12 border-2 border-success-500 rounded-xl bg-success-50 text-success-800 font-bold text-base cursor-not-allowed"
                    />
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-success-700 font-bold">
                      €
                    </span>
                  </div>
                </div>
                <p className="text-xs text-text-tertiary">
                  Somme de tous les coûts ci-dessus
                </p>
              </div>
            </div>

            {/* ===== SECTION 8: DONNÉES DU FINANCEMENT ===== */}
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-text-primary flex items-center gap-2">
                <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-accent-orange-500 text-white">
                  🏦
                </span>
                Données du Financement
              </h3>

              {/* Row 1: Apport personnel */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-text-primary">
                  Apport personnel
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <FormInput
                    type="number"
                    value={apportInitial}
                    onChange={(e) => setApportInitial(e.target.value)}
                    placeholder="100 000"
                    prefix="€"
                    min="0"
                    step="1000"
                    className="text-sm"
                  />
                  <FormInput
                    type="number"
                    value={apportNegocie}
                    onChange={(e) => setApportNegocie(e.target.value)}
                    placeholder="100 000"
                    prefix="€"
                    min="0"
                    step="1000"
                    className="text-sm"
                  />
                </div>
              </div>

              {/* Row 2: Prêt Relais TVA */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-text-primary">
                  Prêt Relais TVA
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <FormInput
                    type="number"
                    value={pretRelaisTvaInitial}
                    onChange={(e) => setPretRelaisTvaInitial(e.target.value)}
                    placeholder="5 690"
                    prefix="€"
                    min="0"
                    step="100"
                    className="text-sm"
                  />
                  <FormInput
                    type="number"
                    value={pretRelaisTvaNegocie}
                    onChange={(e) => setPretRelaisTvaNegocie(e.target.value)}
                    placeholder="5 380"
                    prefix="€"
                    min="0"
                    step="100"
                    className="text-sm"
                  />
                </div>
                <p className="text-xs text-text-tertiary">
                  Prêt court-terme (taux ~4%) pour couvrir la TVA en attendant remboursement
                </p>
              </div>

              {/* Row 3: Crédit Vendeur */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-text-primary">
                  Crédit Vendeur
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <FormInput
                    type="number"
                    value={creditVendeurInitial}
                    onChange={(e) => setCreditVendeurInitial(e.target.value)}
                    placeholder="15 000"
                    prefix="€"
                    min="0"
                    step="1000"
                    className="text-sm"
                  />
                  <FormInput
                    type="number"
                    value={creditVendeurNegocie}
                    onChange={(e) => setCreditVendeurNegocie(e.target.value)}
                    placeholder="15 000"
                    prefix="€"
                    min="0"
                    step="1000"
                    className="text-sm"
                  />
                </div>
                <p className="text-xs text-text-tertiary">
                  Crédit vendeur pour stock/équipement (facilite négociation)
                </p>
              </div>

              {/* Row 4: MONTANT DU PRÊT PRINCIPAL (AUTO-CALCULATED) */}
              <div className="space-y-2 pt-4 border-t-2 border-surface-300">
                <label className="flex items-center gap-2 text-sm font-bold text-text-primary">
                  MONTANT DU PRÊT PRINCIPAL
                  <span className="px-2 py-0.5 bg-primary-100 text-primary-800 text-xs rounded-full font-semibold">
                    Auto
                  </span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="relative">
                    <input
                      type="text"
                      value={pretPrincipalInitial.toLocaleString('fr-FR')}
                      readOnly
                      className="w-full px-5 py-4 pl-12 border-2 border-primary-500 rounded-xl bg-primary-50 text-primary-800 font-bold text-base cursor-not-allowed"
                    />
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-primary-700 font-bold">
                      €
                    </span>
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      value={pretPrincipalNegocie.toLocaleString('fr-FR')}
                      readOnly
                      className="w-full px-5 py-4 pl-12 border-2 border-primary-500 rounded-xl bg-primary-50 text-primary-800 font-bold text-base cursor-not-allowed"
                    />
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-primary-700 font-bold">
                      €
                    </span>
                  </div>
                </div>
                <p className="text-xs text-text-tertiary">
                  Calcul auto: Total investissement - Apport - Prêt relais TVA - Crédit vendeur
                </p>
              </div>
            </div>

            {/* ===== SECTION 9: PARAMÈTRES DE L'EMPRUNT ===== */}
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-text-primary flex items-center gap-2">
                <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-accent-violet-500 text-white">
                  📊
                </span>
                Paramètres de l'Emprunt
              </h3>

              {/* Row 1: Durée du prêt */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-text-primary">
                  Durée du prêt (années)
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <FormInput
                    type="number"
                    value={dureeInitial}
                    onChange={(e) => setDureeInitial(e.target.value)}
                    placeholder="7"
                    min="1"
                    max="25"
                    step="1"
                    className="text-sm"
                  />
                  <FormInput
                    type="number"
                    value={dureeNegocie}
                    onChange={(e) => setDureeNegocie(e.target.value)}
                    placeholder="7"
                    min="1"
                    max="25"
                    step="1"
                    className="text-sm"
                  />
                </div>
                <p className="text-xs text-text-tertiary">
                  Durée typique: 5-10 ans pour fonds de commerce
                </p>
              </div>

              {/* Row 2: Taux d'intérêt nominal */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-text-primary">
                  Taux d'intérêt nominal
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="relative">
                    <input
                      type="number"
                      value={tauxInteretInitial}
                      onChange={(e) => setTauxInteretInitial(e.target.value)}
                      placeholder="3.20"
                      min="0"
                      max="15"
                      step="0.1"
                      className="w-full px-5 py-4 pr-12 border-2 border-surface-400 rounded-xl focus:ring-4 focus:outline-none focus:border-primary-500 focus:ring-primary-100 transition-all duration-200 text-sm"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-text-tertiary font-medium">
                      %
                    </span>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      value={tauxInteretNegocie}
                      onChange={(e) => setTauxInteretNegocie(e.target.value)}
                      placeholder="3.00"
                      min="0"
                      max="15"
                      step="0.1"
                      className="w-full px-5 py-4 pr-12 border-2 border-surface-400 rounded-xl focus:ring-4 focus:outline-none focus:border-primary-500 focus:ring-primary-100 transition-all duration-200 text-sm"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-text-tertiary font-medium">
                      %
                    </span>
                  </div>
                </div>
                <p className="text-xs text-text-tertiary">
                  Taux bancaire actuel (ex: 3,20%)
                </p>
              </div>

              {/* Row 3: Taux d'assurance ADI */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-text-primary">
                  Taux d'assurance ADI (Décès-Invalidité)
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="relative">
                    <input
                      type="number"
                      value={tauxAssuranceInitial}
                      onChange={(e) => setTauxAssuranceInitial(e.target.value)}
                      placeholder="0.40"
                      min="0"
                      max="2"
                      step="0.05"
                      className="w-full px-5 py-4 pr-12 border-2 border-surface-400 rounded-xl focus:ring-4 focus:outline-none focus:border-primary-500 focus:ring-primary-100 transition-all duration-200 text-sm"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-text-tertiary font-medium">
                      %
                    </span>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      value={tauxAssuranceNegocie}
                      onChange={(e) => setTauxAssuranceNegocie(e.target.value)}
                      placeholder="0.35"
                      min="0"
                      max="2"
                      step="0.05"
                      className="w-full px-5 py-4 pr-12 border-2 border-surface-400 rounded-xl focus:ring-4 focus:outline-none focus:border-primary-500 focus:ring-primary-100 transition-all duration-200 text-sm"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-text-tertiary font-medium">
                      %
                    </span>
                  </div>
                </div>
                <p className="text-xs text-text-tertiary">
                  Assurance emprunteur (typique: 0,35-0,50%)
                </p>
              </div>

              {/* Row 4: ESTIMATION ANNUELLE (AUTO-CALCULATED) */}
              <div className="space-y-2 pt-4 border-t-2 border-surface-300">
                <label className="flex items-center gap-2 text-sm font-bold text-text-primary">
                  ESTIMATION ANNUELLE (remboursement)
                  <span className="px-2 py-0.5 bg-violet-100 text-violet-800 text-xs rounded-full font-semibold">
                    Auto
                  </span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="relative">
                    <input
                      type="text"
                      value={estimationAnnuelleInitial.toLocaleString('fr-FR')}
                      readOnly
                      className="w-full px-5 py-4 pl-12 border-2 border-violet-500 rounded-xl bg-violet-50 text-violet-800 font-bold text-base cursor-not-allowed"
                    />
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-violet-700 font-bold">
                      €
                    </span>
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      value={estimationAnnuelleNegocie.toLocaleString('fr-FR')}
                      readOnly
                      className="w-full px-5 py-4 pl-12 border-2 border-violet-500 rounded-xl bg-violet-50 text-violet-800 font-bold text-base cursor-not-allowed"
                    />
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-violet-700 font-bold">
                      €
                    </span>
                  </div>
                </div>
                <p className="text-xs text-text-tertiary">
                  Calcul auto: Formule d'annuité (capital + intérêts + assurance) × 12 mois
                </p>
              </div>
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
            )}

            {/* PROFESSIONAL WORKFLOW - Full width */}
            {initialView === 'professional' && (
              <>
            {/* État: IDLE - Écran de démarrage */}
            {stage === 'idle' && (
              <div className="flex-1 flex flex-col items-center justify-center p-12 bg-gradient-to-br from-surface-100 to-white">
                <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center mb-6 shadow-2xl">
                  <Play className="w-12 h-12 text-white" />
                </div>
                <h3 className="text-3xl font-bold text-text-primary mb-3">
                  Prêt à analyser
                </h3>
                <p className="text-text-secondary text-center max-w-md leading-relaxed mb-8">
                  Lancez l'analyse professionnelle complète avec 10 agents IA spécialisés.
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

            {/* État: COMPLETED - Professional Report */}
            {stage === 'completed' && (
              <div className="flex-1 flex flex-col overflow-hidden">
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
              </div>
            )}
              </>
            )}

            {/* FINANCIAL REPORT - Shown after financial analysis completes */}
            {financialStage === 'completed' && initialView === 'financial' && (
              <div className="flex-1 flex flex-col overflow-hidden">
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
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
