import { z } from 'zod';

/**
 * Business Input Schema - Données entreprise OpenData API
 *
 * Schema complet pour valider les données business entrantes
 * depuis l'API recherche-entreprises.api.gouv.fr
 */

// Schema pour siege social
export const SiegeSchema = z.object({
  siret: z.string().optional(),
  adresse: z.string().optional(),
  code_postal: z.string().optional(),
  libelle_commune: z.string().optional(),
  code_commune: z.string().optional(),
  latitude: z.union([z.string(), z.number()]).optional(),
  longitude: z.union([z.string(), z.number()]).optional(),
  googlePlaceId: z.string().optional()
}).optional();

// Schema pour établissement matching
export const MatchingEtablissementSchema = z.object({
  siret: z.string().optional(),
  latitude: z.union([z.string(), z.number()]).optional(),
  longitude: z.union([z.string(), z.number()]).optional(),
  adresse: z.string().optional(),
}).optional();

// Schema principal pour business input
export const BusinessInputSchema = z.object({
  // Identifiants
  siren: z.string().optional(),
  siret: z.string(),

  // Dénominations
  nom_complet: z.string().optional(),
  nom_raison_sociale: z.string().optional(),
  enseigne: z.string().optional(),
  denomination: z.string().optional(),

  // Activité
  activite_principale: z.string().optional(),
  activite_principale_libelle: z.string().optional(),
  libelle_activite_principale: z.string().optional(),
  code_naf: z.string().optional(),

  // Adresse principale
  adresse: z.string().optional(),
  adresse_ligne_1: z.string().optional(),
  adresse_ligne_2: z.string().optional(),
  adresse_code_postal: z.string().optional(),
  adresse_ville: z.string().optional(),
  code_postal: z.string().optional(),
  libelle_commune: z.string().optional(),

  // Coordonnées GPS (plusieurs formats possibles)
  lat: z.union([z.string(), z.number()]).optional(),
  lon: z.union([z.string(), z.number()]).optional(),
  latitude: z.union([z.string(), z.number()]).optional(),
  longitude: z.union([z.string(), z.number()]).optional(),

  // Siege et établissements
  siege: SiegeSchema,
  matching_etablissements: z.array(MatchingEtablissementSchema).optional(),

  // Statut juridique
  nature_juridique: z.string().optional(),
  forme_juridique: z.string().optional(),

  // Dates
  date_creation: z.string().optional(),
  date_debut_activite: z.string().optional(),

  // État
  etat_administratif: z.string().optional(),
  statut_diffusion: z.string().optional(),

  // Dirigeants
  dirigeants: z.array(z.any()).optional(),

  // Données supplémentaires enrichies
  bodaccData: z.array(z.any()).optional(),
  places: z.any().optional(),

  // Métadonnées
  score: z.number().optional(),
  matching_score: z.number().optional(),
});

export type BusinessInput = z.infer<typeof BusinessInputSchema>;

// Schema pour adresse normalisée (output PreparationAgent)
export const NormalizedAddressSchema = z.object({
  full: z.string(),
  street: z.string(),
  zipCode: z.string(),
  city: z.string()
});

export type NormalizedAddress = z.infer<typeof NormalizedAddressSchema>;

// Schema pour coordonnées GPS
export const CoordinatesSchema = z.object({
  lat: z.number(),
  lon: z.number()
}).nullable();

export type Coordinates = z.infer<typeof CoordinatesSchema>;

// Schema pour informations commune
export const CommuneInfoSchema = z.object({
  nom: z.string(),
  codePostal: z.string(),
  codeInsee: z.string()
});

export type CommuneInfo = z.infer<typeof CommuneInfoSchema>;
