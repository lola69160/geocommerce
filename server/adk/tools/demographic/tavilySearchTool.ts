import { z } from 'zod';
import { FunctionTool } from '@google/adk';
import type { ToolContext } from '@google/adk';
import { zToGen } from '../../utils/schemaHelper.js';
import type { PreparationOutput } from '../../schemas';
import axios from 'axios';

/**
 * Tavily Search Tool
 *
 * Recherche actualités locales, projets urbanisme, dynamisme économique,
 * et saisonnalité via Tavily API pour enrichir l'analyse démographique.
 * Lit commune depuis state.preparation.
 */

const TavilySearchInputSchema = z.object({
  // Aucun paramètre - lit depuis state.preparation.commune
});

export const tavilySearchTool = new FunctionTool({
  name: 'tavilySearch',
  description: 'Recherche actualités locales, projets urbanisme, dynamisme économique, et saisonnalité via Tavily API. Lit commune depuis state.preparation. Retourne contexte enrichi pour analyse démographique.',
  parameters: zToGen(TavilySearchInputSchema),

  execute: async (params, toolContext?: ToolContext) => {
    let preparation = toolContext?.state.get('preparation') as PreparationOutput | undefined | string;
    const TAVILY_API_KEY = process.env.TAVILY_API_KEY;

    // Parser JSON string si nécessaire (ADK peut stocker en string)
    if (typeof preparation === 'string') {
      try {
        preparation = JSON.parse(preparation) as PreparationOutput;
      } catch (e) {
        return {
          searched: false,
          reason: 'Failed to parse preparation state (invalid JSON)',
          news: [],
          urban_projects: [],
          economic_activity: [],
          seasonality: null
        };
      }
    }

    if (!preparation?.commune) {
      return {
        searched: false,
        reason: 'preparation.commune not found in state',
        news: [],
        urban_projects: [],
        economic_activity: [],
        seasonality: null
      };
    }

    if (!TAVILY_API_KEY) {
      console.warn('TAVILY_API_KEY not configured - skipping web enrichment');
      return {
        searched: false,
        reason: 'TAVILY_API_KEY not configured',
        news: [],
        urban_projects: [],
        economic_activity: [],
        seasonality: null
      };
    }

    const commune = preparation.commune.nom;
    const results: any = {
      searched: true,
      news: [],
      urban_projects: [],
      economic_activity: [],
      seasonality: null
    };

    try {
      // 1. News récentes commune (projets, événements)
      console.log(`[Tavily] Searching news for ${commune}...`);
      const newsResponse = await axios.post(
        'https://api.tavily.com/search',
        {
          api_key: TAVILY_API_KEY,
          query: `actualités récentes ${commune} France 2025 projets événements`,
          search_depth: 'basic',
          max_results: 5,
          include_answer: false
        },
        { timeout: 10000 }
      );
      results.news = (newsResponse.data.results || []).map((r: any) => ({
        title: r.title,
        content: r.content,
        url: r.url
      }));

      // 2. Projets urbanisme/aménagement de la mairie
      console.log(`[Tavily] Searching urban projects for ${commune}...`);
      const urbanResponse = await axios.post(
        'https://api.tavily.com/search',
        {
          api_key: TAVILY_API_KEY,
          query: `projets urbanisme aménagement ${commune} mairie PLU`,
          search_depth: 'basic',
          max_results: 5,
          include_answer: false
        },
        { timeout: 10000 }
      );
      results.urban_projects = (urbanResponse.data.results || []).map((r: any) => ({
        title: r.title,
        content: r.content,
        url: r.url
      }));

      // 3. Dynamisme économique local
      console.log(`[Tavily] Searching economic activity for ${commune}...`);
      const economicResponse = await axios.post(
        'https://api.tavily.com/search',
        {
          api_key: TAVILY_API_KEY,
          query: `développement économique commerce activité ${commune}`,
          search_depth: 'basic',
          max_results: 5,
          include_answer: false
        },
        { timeout: 10000 }
      );
      results.economic_activity = (economicResponse.data.results || []).map((r: any) => ({
        title: r.title,
        content: r.content,
        url: r.url
      }));

      // 4. Saisonnalité (tourisme, événements, variation population)
      console.log(`[Tavily] Searching seasonality for ${commune}...`);
      const seasonalityResponse = await axios.post(
        'https://api.tavily.com/search',
        {
          api_key: TAVILY_API_KEY,
          query: `tourisme saisonnalité événements variation population ${commune}`,
          search_depth: 'basic',
          max_results: 3,
          include_answer: false
        },
        { timeout: 10000 }
      );

      // Analyser saisonnalité depuis le contenu
      const seasonalityContent = (seasonalityResponse.data.results || [])
        .map((r: any) => r.content)
        .join(' ')
        .toLowerCase();

      results.seasonality = {
        has_tourism: seasonalityContent.includes('tourisme') || seasonalityContent.includes('touriste'),
        has_events: seasonalityContent.includes('festival') || seasonalityContent.includes('événement'),
        seasonal_variation: 'moderate', // Gemini analysera en détail
        population_increase_estimated: null, // À analyser par Gemini depuis raw_results
        raw_results: (seasonalityResponse.data.results || []).slice(0, 2).map((r: any) => ({
          title: r.title,
          content: r.content
        }))
      };

      console.log(`[Tavily] Search completed for ${commune} - ${results.news.length} news, ${results.urban_projects.length} urban projects, ${results.economic_activity.length} economic articles`);

    } catch (error: any) {
      console.error('Tavily search error:', error.message);
      return {
        searched: false,
        error: true,
        message: error.message,
        news: [],
        urban_projects: [],
        economic_activity: [],
        seasonality: null
      };
    }

    return results;
  }
});
