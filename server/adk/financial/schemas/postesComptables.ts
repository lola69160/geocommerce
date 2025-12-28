

/**
 * Référentiel exhaustif des postes comptables français
 * Conforme au Plan Comptable Général (PCG) et formulaires Cerfa 2050-2059
 */

// ============================================================================
// BILAN - ACTIF (Cerfa 2050)
// ============================================================================

export const BILAN_ACTIF = {
  // ACTIF IMMOBILISÉ
  actif_immobilise: {
    immobilisations_incorporelles: {
      label: "Immobilisations incorporelles",
      postes: {
        frais_etablissement: { label: "Frais d'établissement", cerfa: "AA" },
        frais_developpement: { label: "Frais de développement", cerfa: "AB" },
        concessions_brevets: { label: "Concessions, brevets, licences, logiciels", cerfa: "AC" },
        fonds_commercial: { label: "Fonds commercial", cerfa: "AD" },
        autres_immob_incorp: { label: "Autres immobilisations incorporelles", cerfa: "AE" },
        avances_acomptes_immob_incorp: { label: "Avances et acomptes sur immob. incorp.", cerfa: "AF" }
      }
    },
    immobilisations_corporelles: {
      label: "Immobilisations corporelles",
      postes: {
        terrains: { label: "Terrains", cerfa: "AH" },
        constructions: { label: "Constructions", cerfa: "AI" },
        installations_techniques: { label: "Installations techniques, matériel et outillage", cerfa: "AJ" },
        autres_immob_corp: { label: "Autres immobilisations corporelles", cerfa: "AK" },
        immob_en_cours: { label: "Immobilisations en cours", cerfa: "AL" },
        avances_acomptes_immob_corp: { label: "Avances et acomptes sur immob. corp.", cerfa: "AM" }
      }
    },
    immobilisations_financieres: {
      label: "Immobilisations financières",
      postes: {
        participations: { label: "Participations", cerfa: "AN" },
        creances_participations: { label: "Créances rattachées à des participations", cerfa: "AO" },
        autres_titres_immob: { label: "Autres titres immobilisés", cerfa: "AP" },
        prets: { label: "Prêts", cerfa: "AQ" },
        autres_immob_fin: { label: "Autres immobilisations financières", cerfa: "AR" }
      }
    },
    total_actif_immobilise: { label: "TOTAL ACTIF IMMOBILISÉ", cerfa: "AS" }
  },

  // ACTIF CIRCULANT
  actif_circulant: {
    stocks_et_encours: {
      label: "Stocks et en-cours",
      postes: {
        matieres_premieres: { label: "Matières premières et autres approvisionnements", cerfa: "AT" },
        encours_production_biens: { label: "En-cours de production de biens", cerfa: "AU" },
        encours_production_services: { label: "En-cours de production de services", cerfa: "AV" },
        produits_intermediaires: { label: "Produits intermédiaires et finis", cerfa: "AW" },
        marchandises: { label: "Marchandises", cerfa: "AX" }
      }
    },
    avances_acomptes_verses: {
      label: "Avances et acomptes versés sur commandes",
      cerfa: "AY"
    },
    creances: {
      label: "Créances",
      postes: {
        creances_clients: { label: "Créances clients et comptes rattachés", cerfa: "AZ" },
        autres_creances: { label: "Autres créances", cerfa: "BA" },
        capital_souscrit_appele: { label: "Capital souscrit - appelé, non versé", cerfa: "BB" }
      }
    },
    valeurs_mobilieres_placement: {
      label: "Valeurs mobilières de placement",
      cerfa: "BC"
    },
    disponibilites: {
      label: "Disponibilités",
      postes: {
        banques: { label: "Banques", subCerfa: true },
        caisse: { label: "Caisse", subCerfa: true },
        ccp: { label: "CCP", subCerfa: true }
      },
      cerfa: "BD"
    },
    charges_constatees_avance: {
      label: "Charges constatées d'avance",
      cerfa: "BE"
    },
    total_actif_circulant: { label: "TOTAL ACTIF CIRCULANT", cerfa: "BF" }
  },

  // COMPTES DE RÉGULARISATION
  charges_repartir: { label: "Charges à répartir sur plusieurs exercices", cerfa: "BG" },
  primes_remboursement_obligations: { label: "Primes de remboursement des obligations", cerfa: "BH" },
  ecarts_conversion_actif: { label: "Écarts de conversion actif", cerfa: "BI" },

  // TOTAL
  total_general_actif: { label: "TOTAL GÉNÉRAL ACTIF", cerfa: "BJ" }
} as const;

// ============================================================================
// BILAN - PASSIF (Cerfa 2051)
// ============================================================================

export const BILAN_PASSIF = {
  // CAPITAUX PROPRES
  capitaux_propres: {
    label: "Capitaux propres",
    postes: {
      capital_social: { label: "Capital social ou individuel", cerfa: "DA" },
      primes_emission: { label: "Primes d'émission, de fusion, d'apport", cerfa: "DB" },
      ecarts_reevaluation: { label: "Écarts de réévaluation", cerfa: "DC" },
      reserve_legale: { label: "Réserve légale", cerfa: "DD" },
      reserves_statutaires: { label: "Réserves statutaires ou contractuelles", cerfa: "DE" },
      reserves_reglementees: { label: "Réserves réglementées", cerfa: "DF" },
      autres_reserves: { label: "Autres réserves", cerfa: "DG" },
      report_a_nouveau: { label: "Report à nouveau", cerfa: "DH" },
      resultat_exercice: { label: "Résultat de l'exercice", cerfa: "DI" },
      subventions_investissement: { label: "Subventions d'investissement", cerfa: "DJ" },
      provisions_reglementees: { label: "Provisions réglementées", cerfa: "DK" }
    },
    total_capitaux_propres: { label: "TOTAL CAPITAUX PROPRES", cerfa: "DL" }
  },

  // AUTRES FONDS PROPRES
  autres_fonds_propres: {
    label: "Autres fonds propres",
    postes: {
      produits_emissions_titres: { label: "Produits des émissions de titres participatifs", cerfa: "DM" },
      avances_conditionnees: { label: "Avances conditionnées", cerfa: "DN" }
    },
    total_autres_fonds_propres: { label: "TOTAL AUTRES FONDS PROPRES", cerfa: "DO" }
  },

  // PROVISIONS
  provisions: {
    label: "Provisions",
    postes: {
      provisions_risques: { label: "Provisions pour risques", cerfa: "DP" },
      provisions_charges: { label: "Provisions pour charges", cerfa: "DQ" }
    },
    total_provisions: { label: "TOTAL PROVISIONS", cerfa: "DR" }
  },

  // DETTES
  dettes: {
    label: "Dettes",
    postes: {
      emprunts_obligataires: { label: "Emprunts obligataires convertibles", cerfa: "DS" },
      autres_emprunts_obligataires: { label: "Autres emprunts obligataires", cerfa: "DT" },
      emprunts_etablissements_credit: { label: "Emprunts et dettes auprès des établissements de crédit", cerfa: "DU" },
      emprunts_dettes_financieres: { label: "Emprunts et dettes financières diverses", cerfa: "DV" },
      avances_acomptes_recus: { label: "Avances et acomptes reçus sur commandes", cerfa: "DW" },
      dettes_fournisseurs: { label: "Dettes fournisseurs et comptes rattachés", cerfa: "DX" },
      dettes_fiscales_sociales: { label: "Dettes fiscales et sociales", cerfa: "DY" },
      dettes_immobilisations: { label: "Dettes sur immobilisations et comptes rattachés", cerfa: "DZ" },
      autres_dettes: { label: "Autres dettes", cerfa: "EA" },
      produits_constates_avance: { label: "Produits constatés d'avance", cerfa: "EB" }
    },
    total_dettes: { label: "TOTAL DETTES", cerfa: "EC" }
  },

  // ÉCARTS DE CONVERSION
  ecarts_conversion_passif: { label: "Écarts de conversion passif", cerfa: "ED" },

  // TOTAL
  total_general_passif: { label: "TOTAL GÉNÉRAL PASSIF", cerfa: "EE" }
} as const;

// ============================================================================
// COMPTE DE RÉSULTAT (Cerfa 2052 + 2053)
// ============================================================================

export const COMPTE_RESULTAT = {
  // PRODUITS D'EXPLOITATION
  produits_exploitation: {
    label: "Produits d'exploitation",
    postes: {
      ventes_marchandises: { label: "Ventes de marchandises", cerfa: "FA", type: "produit" },
      production_vendue_biens: { label: "Production vendue - Biens", cerfa: "FB", type: "produit" },
      production_vendue_services: { label: "Production vendue - Services", cerfa: "FC", type: "produit" },
      chiffre_affaires_net: { label: "Chiffre d'affaires net", cerfa: "FD", type: "total", computed: true },
      production_stockee: { label: "Production stockée", cerfa: "FE", type: "produit" },
      production_immobilisee: { label: "Production immobilisée", cerfa: "FF", type: "produit" },
      subventions_exploitation: { label: "Subventions d'exploitation", cerfa: "FG", type: "produit" },
      reprises_provisions: { label: "Reprises sur amortissements et provisions", cerfa: "FH", type: "produit" },
      transferts_charges: { label: "Transferts de charges", cerfa: "FI", type: "produit" },
      autres_produits: { label: "Autres produits", cerfa: "FJ", type: "produit" }
    },
    total_produits_exploitation: { label: "TOTAL PRODUITS D'EXPLOITATION (I)", cerfa: "FK" }
  },

  // CHARGES D'EXPLOITATION
  charges_exploitation: {
    label: "Charges d'exploitation",
    postes: {
      achats_marchandises: { label: "Achats de marchandises", cerfa: "FL", type: "charge" },
      variation_stock_marchandises: { label: "Variation de stock (marchandises)", cerfa: "FM", type: "charge" },
      achats_matieres_premieres: { label: "Achats de matières premières", cerfa: "FN", type: "charge" },
      variation_stock_matieres: { label: "Variation de stock (matières premières)", cerfa: "FO", type: "charge" },
      autres_achats_charges_externes: { 
        label: "Autres achats et charges externes", 
        cerfa: "FP", 
        type: "charge",
        detail: {
          loyers_charges_locatives: { label: "Loyers et charges locatives" },
          entretien_reparations: { label: "Entretien et réparations" },
          assurances: { label: "Primes d'assurance" },
          etudes_recherche: { label: "Études et recherches" },
          personnel_exterieur: { label: "Personnel extérieur à l'entreprise" },
          remunerations_intermediaires: { label: "Rémunérations d'intermédiaires et honoraires" },
          publicite: { label: "Publicité, publications, relations publiques" },
          transports: { label: "Transports de biens et collectifs" },
          deplacements: { label: "Déplacements, missions et réceptions" },
          frais_postaux: { label: "Frais postaux et télécommunications" },
          services_bancaires: { label: "Services bancaires" },
          autres_charges_externes: { label: "Autres charges externes" }
        }
      },
      impots_taxes: { label: "Impôts, taxes et versements assimilés", cerfa: "FQ", type: "charge" },
      salaires_traitements: { label: "Salaires et traitements", cerfa: "FR", type: "charge" },
      charges_sociales: { label: "Charges sociales", cerfa: "FS", type: "charge" },
      dotations_amortissements_immob: { label: "Dotations aux amortissements sur immobilisations", cerfa: "FT", type: "charge" },
      dotations_amortissements_charges: { label: "Dotations aux amortissements sur charges à répartir", cerfa: "FU", type: "charge" },
      dotations_provisions_actif: { label: "Dotations aux provisions sur actif circulant", cerfa: "FV", type: "charge" },
      dotations_provisions_risques: { label: "Dotations aux provisions pour risques et charges", cerfa: "FW", type: "charge" },
      autres_charges: { label: "Autres charges", cerfa: "FX", type: "charge" }
    },
    total_charges_exploitation: { label: "TOTAL CHARGES D'EXPLOITATION (II)", cerfa: "FY" }
  },

  // RÉSULTAT D'EXPLOITATION
  resultat_exploitation: { label: "RÉSULTAT D'EXPLOITATION (I - II)", cerfa: "FZ", computed: true },

  // PRODUITS FINANCIERS
  produits_financiers: {
    label: "Produits financiers",
    postes: {
      produits_participations: { label: "Produits financiers de participations", cerfa: "GA" },
      produits_autres_valeurs_mob: { label: "Produits des autres valeurs mobilières", cerfa: "GB" },
      autres_interets: { label: "Autres intérêts et produits assimilés", cerfa: "GC" },
      reprises_provisions_financieres: { label: "Reprises sur provisions financières", cerfa: "GD" },
      transferts_charges_financieres: { label: "Transferts de charges financières", cerfa: "GE" },
      differences_change_positives: { label: "Différences positives de change", cerfa: "GF" },
      produits_nets_cession_vmp: { label: "Produits nets sur cessions de VMP", cerfa: "GG" }
    },
    total_produits_financiers: { label: "TOTAL PRODUITS FINANCIERS (III)", cerfa: "GH" }
  },

  // CHARGES FINANCIÈRES
  charges_financieres: {
    label: "Charges financières",
    postes: {
      dotations_amortissements_financiers: { label: "Dotations aux amortissements financiers", cerfa: "GI" },
      dotations_provisions_financieres: { label: "Dotations aux provisions financières", cerfa: "GJ" },
      interets_charges: { label: "Intérêts et charges assimilées", cerfa: "GK" },
      differences_change_negatives: { label: "Différences négatives de change", cerfa: "GL" },
      charges_nettes_cession_vmp: { label: "Charges nettes sur cessions de VMP", cerfa: "GM" }
    },
    total_charges_financieres: { label: "TOTAL CHARGES FINANCIÈRES (IV)", cerfa: "GN" }
  },

  // RÉSULTAT FINANCIER
  resultat_financier: { label: "RÉSULTAT FINANCIER (III - IV)", cerfa: "GO", computed: true },

  // RÉSULTAT COURANT
  resultat_courant_avant_impots: { label: "RÉSULTAT COURANT AVANT IMPÔTS (I-II+III-IV)", cerfa: "GP", computed: true },

  // PRODUITS EXCEPTIONNELS
  produits_exceptionnels: {
    label: "Produits exceptionnels",
    postes: {
      produits_except_operations_gestion: { label: "Produits exceptionnels sur opérations de gestion", cerfa: "GQ" },
      produits_except_operations_capital: { label: "Produits exceptionnels sur opérations en capital", cerfa: "GR" },
      reprises_provisions_except: { label: "Reprises sur provisions exceptionnelles", cerfa: "GS" },
      transferts_charges_except: { label: "Transferts de charges exceptionnelles", cerfa: "GT" }
    },
    total_produits_exceptionnels: { label: "TOTAL PRODUITS EXCEPTIONNELS (V)", cerfa: "GU" }
  },

  // CHARGES EXCEPTIONNELLES
  charges_exceptionnelles: {
    label: "Charges exceptionnelles",
    postes: {
      charges_except_operations_gestion: { label: "Charges exceptionnelles sur opérations de gestion", cerfa: "GV" },
      charges_except_operations_capital: { label: "Charges exceptionnelles sur opérations en capital", cerfa: "GW" },
      dotations_amortissements_except: { label: "Dotations aux amortissements exceptionnels", cerfa: "GX" },
      dotations_provisions_except: { label: "Dotations aux provisions exceptionnelles", cerfa: "GY" }
    },
    total_charges_exceptionnelles: { label: "TOTAL CHARGES EXCEPTIONNELLES (VI)", cerfa: "GZ" }
  },

  // RÉSULTAT EXCEPTIONNEL
  resultat_exceptionnel: { label: "RÉSULTAT EXCEPTIONNEL (V - VI)", cerfa: "HA", computed: true },

  // PARTICIPATION ET IMPÔTS
  participation_salaries: { label: "Participation des salariés aux résultats (VII)", cerfa: "HB" },
  impots_sur_benefices: { label: "Impôts sur les bénéfices (VIII)", cerfa: "HC" },

  // RÉSULTAT NET
  resultat_net: { label: "RÉSULTAT NET (I-II+III-IV+V-VI-VII-VIII)", cerfa: "HD", computed: true }
} as const;

// ============================================================================
// SOLDES INTERMÉDIAIRES DE GESTION (SIG)
// ============================================================================

export const SIG = {
  marge_commerciale: {
    label: "Marge commerciale",
    formule: "ventes_marchandises - achats_marchandises - variation_stock_marchandises"
  },
  production_exercice: {
    label: "Production de l'exercice",
    formule: "production_vendue_biens + production_vendue_services + production_stockee + production_immobilisee"
  },
  valeur_ajoutee: {
    label: "Valeur ajoutée",
    formule: "marge_commerciale + production_exercice - autres_achats_charges_externes"
  },
  ebe: {
    label: "Excédent Brut d'Exploitation (EBE)",
    formule: "valeur_ajoutee + subventions_exploitation - impots_taxes - salaires_traitements - charges_sociales"
  },
  resultat_exploitation: {
    label: "Résultat d'exploitation",
    formule: "ebe + reprises_provisions + transferts_charges + autres_produits - dotations_amortissements - dotations_provisions - autres_charges"
  },
  resultat_courant: {
    label: "Résultat courant avant impôts",
    formule: "resultat_exploitation + produits_financiers - charges_financieres"
  },
  resultat_exceptionnel: {
    label: "Résultat exceptionnel",
    formule: "produits_exceptionnels - charges_exceptionnelles"
  },
  resultat_net: {
    label: "Résultat net",
    formule: "resultat_courant + resultat_exceptionnel - participation_salaries - impots_sur_benefices"
  },
  caf: {
    label: "Capacité d'Autofinancement (CAF)",
    formule: "resultat_net + dotations_amortissements + dotations_provisions - reprises_provisions - produits_cession_actifs + valeur_comptable_actifs_cedes"
  }
} as const;

// ============================================================================
// ANNEXES (Cerfa 2054, 2055, 2058)
// ============================================================================

export const ANNEXES = {
  // ÉTAT DES IMMOBILISATIONS (2054)
  etat_immobilisations: {
    colonnes: ["valeur_debut", "augmentations", "diminutions", "valeur_fin"],
    lignes: Object.keys(BILAN_ACTIF.actif_immobilise.immobilisations_corporelles.postes)
  },
  
  // ÉTAT DES AMORTISSEMENTS (2055)
  etat_amortissements: {
    colonnes: ["cumul_debut", "dotations", "reprises", "cumul_fin"],
    lignes: Object.keys(BILAN_ACTIF.actif_immobilise.immobilisations_corporelles.postes)
  },
  
  // INFORMATIONS COMPLÉMENTAIRES
  informations_complementaires: {
    effectifs: {
      nombre_salaries: { label: "Nombre moyen de salariés" },
      salaries_cdi: { label: "dont CDI" },
      salaries_cdd: { label: "dont CDD" }
    },
    remuneration_dirigeants: {
      remuneration_brute: { label: "Rémunération brute des dirigeants" },
      avantages_nature: { label: "Avantages en nature" }
    },
    engagements_hors_bilan: {
      credit_bail: { label: "Engagements de crédit-bail" },
      cautions_donnees: { label: "Cautions et garanties données" },
      cautions_recues: { label: "Cautions et garanties reçues" }
    }
  }
} as const;

// ============================================================================
// TYPES TYPESCRIPT
// ============================================================================

export interface ValeurBilan {
  brut?: number;
  amortissements?: number;
  net: number;
  netN1?: number;  // Année précédente
}

export interface ValeurCompteResultat {
  montant: number;
  montantN1?: number;
}

export interface ExtractionComplete {
  // Métadonnées
  annee: number;
  societe?: string;
  siret?: string;
  dateClotureExercice?: string;
  dureeExerciceMois?: number;
  
  // BILAN
  bilan: {
    actif: {
      actif_immobilise: Record<string, ValeurBilan>;
      actif_circulant: Record<string, ValeurBilan>;
      total_actif: number;
      total_actifN1?: number;
    };
    passif: {
      capitaux_propres: Record<string, ValeurCompteResultat>;
      provisions: Record<string, ValeurCompteResultat>;
      dettes: Record<string, ValeurCompteResultat>;
      total_passif: number;
      total_passifN1?: number;
    };
  };
  
  // COMPTE DE RÉSULTAT
  compte_resultat: {
    produits_exploitation: Record<string, ValeurCompteResultat>;
    charges_exploitation: Record<string, ValeurCompteResultat>;
    resultat_exploitation: number;
    produits_financiers: Record<string, ValeurCompteResultat>;
    charges_financieres: Record<string, ValeurCompteResultat>;
    resultat_financier: number;
    produits_exceptionnels: Record<string, ValeurCompteResultat>;
    charges_exceptionnelles: Record<string, ValeurCompteResultat>;
    resultat_exceptionnel: number;
    impots_sur_benefices: number;
    resultat_net: number;
  };
  
  // SIG (calculés ou extraits)
  sig: {
    chiffre_affaires: number;
    marge_commerciale?: number;
    valeur_ajoutee?: number;
    ebe: number;
    resultat_exploitation: number;
    resultat_courant: number;
    resultat_net: number;
    caf?: number;
  };
  
  // DÉTAILS CHARGES EXTERNES (pour analyse loyer)
  detail_charges_externes?: {
    loyers_charges_locatives?: number;
    assurances?: number;
    honoraires?: number;
    entretien_reparations?: number;
    electricite_eau?: number;
    telephone_internet?: number;
    autres?: number;
  };
  
  // ANNEXES
  effectifs?: {
    nombre_salaries: number;
    masse_salariale: number;
    remuneration_dirigeant?: number;
  };
  
  engagements_hors_bilan?: {
    credit_bail?: number;
    cautions?: number;
  };
}

// ============================================================================
// MAPPING LABELS → CLÉS (pour le parser)
// ============================================================================

export const LABEL_TO_KEY_MAPPING: Record<string, string> = {
  // ACTIF
  "immobilisations incorporelles": "immobilisations_incorporelles",
  "fonds commercial": "fonds_commercial",
  "fonds de commerce": "fonds_commercial",
  "immobilisations corporelles": "immobilisations_corporelles",
  "installations techniques": "installations_techniques",
  "matériel et outillage": "installations_techniques",
  "autres immobilisations corporelles": "autres_immob_corp",
  "mobilier": "autres_immob_corp",
  "agencements": "autres_immob_corp",
  "stocks": "stocks",
  "stocks et en-cours": "stocks",
  "marchandises": "marchandises",
  "créances clients": "creances_clients",
  "clients et comptes rattachés": "creances_clients",
  "disponibilités": "disponibilites",
  "banques": "disponibilites",
  "caisse": "disponibilites",
  "charges constatées d'avance": "charges_constatees_avance",
  "total actif": "total_actif",
  
  // PASSIF
  "capital": "capital_social",
  "capital social": "capital_social",
  "réserves": "reserves",
  "réserve légale": "reserve_legale",
  "report à nouveau": "report_a_nouveau",
  "résultat de l'exercice": "resultat_exercice",
  "résultat": "resultat_exercice",
  "provisions pour risques": "provisions_risques",
  "provisions pour charges": "provisions_charges",
  "emprunts": "emprunts_etablissements_credit",
  "emprunts et dettes financières": "emprunts_etablissements_credit",
  "dettes fournisseurs": "dettes_fournisseurs",
  "fournisseurs": "dettes_fournisseurs",
  "dettes fiscales et sociales": "dettes_fiscales_sociales",
  "produits constatés d'avance": "produits_constates_avance",
  "total passif": "total_passif",
  
  // COMPTE DE RÉSULTAT
  "ventes de marchandises": "ventes_marchandises",
  "production vendue": "production_vendue_services",
  "prestations de services": "production_vendue_services",
  "chiffre d'affaires": "chiffre_affaires_net",
  "subventions d'exploitation": "subventions_exploitation",
  "achats de marchandises": "achats_marchandises",
  "variation de stock": "variation_stock_marchandises",
  "autres achats et charges externes": "autres_achats_charges_externes",
  "charges externes": "autres_achats_charges_externes",
  "impôts et taxes": "impots_taxes",
  "impôts, taxes": "impots_taxes",
  "salaires et traitements": "salaires_traitements",
  "salaires": "salaires_traitements",
  "charges sociales": "charges_sociales",
  "charges de personnel": "charges_personnel_total",
  "dotations aux amortissements": "dotations_amortissements_immob",
  "amortissements": "dotations_amortissements_immob",
  "dotations aux provisions": "dotations_provisions_risques",
  "résultat d'exploitation": "resultat_exploitation",
  "produits financiers": "produits_financiers_total",
  "charges financières": "charges_financieres_total",
  "résultat financier": "resultat_financier",
  "résultat courant": "resultat_courant_avant_impots",
  "produits exceptionnels": "produits_exceptionnels_total",
  "charges exceptionnelles": "charges_exceptionnelles_total",
  "résultat exceptionnel": "resultat_exceptionnel",
  "impôts sur les bénéfices": "impots_sur_benefices",
  "impôt sur les sociétés": "impots_sur_benefices",
  "résultat net": "resultat_net",
  
  // SIG
  "marge commerciale": "marge_commerciale",
  "valeur ajoutée": "valeur_ajoutee",
  "excédent brut d'exploitation": "ebe",
  "ebe": "ebe",
  "capacité d'autofinancement": "caf"
};
