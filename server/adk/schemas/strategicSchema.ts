import { z } from 'zod';

/**
 * Strategic Agent Output Schema
 *
 * Recommandations stratégiques Gemini Thinking
 */

export const PrioritySchema = z.object({
  title: z.string(),
  budget_estimate: z.string(),
  duration: z.string(),
  justification: z.string(),
  priority: z.number().min(1).max(3)
});

export const StrategySchema = z.object({
  positioning: z.string(),
  pricing: z.object({
    approach: z.enum(['premium', 'aligné', 'discount']),
    justification: z.string()
  }),
  target_segments: z.array(z.string()).min(1).max(3)
});

export const CriticalRiskSchema = z.object({
  risk: z.string(),
  impact: z.enum(['faible', 'moyen', 'élevé', 'critique']),
  probability: z.enum(['faible', 'moyenne', 'élevée']),
  mitigation: z.string()
});

export const ActionPlan90dSchema = z.object({
  month_1: z.array(z.string()).min(2).max(5),
  month_2: z.array(z.string()).min(2).max(5),
  month_3: z.array(z.string()).min(2).max(5)
});

export const FinalDecisionSchema = z.object({
  verdict: z.enum(['GO', 'GO AVEC PRUDENCE', 'NO-GO']),
  justification: z.string(),
  success_conditions: z.array(z.string()).min(2).max(4)
});

export const RecommendationsSchema = z.object({
  executive_summary: z.string(),
  priorities: z.array(PrioritySchema).min(1).max(3),
  strategy: StrategySchema,
  critical_risks: z.array(CriticalRiskSchema).min(1).max(3),
  action_plan_90d: ActionPlan90dSchema,
  final_decision: FinalDecisionSchema
});

export const StrategicOutputSchema = z.object({
  analyzed: z.boolean(),
  recommendations: RecommendationsSchema.optional(),
  context_summary: z.object({
    global_score: z.number(),
    recommendation: z.string(),
    risk_level: z.string()
  }).optional(),
  clarifications_asked: z.array(z.object({
    target_agent: z.string(),
    question: z.string(),
    answer: z.string().optional()
  })).optional(),
  reason: z.string().optional(),
  error: z.boolean().optional(),
  message: z.string().optional()
});

export type StrategicOutput = z.infer<typeof StrategicOutputSchema>;
export type Recommendations = z.infer<typeof RecommendationsSchema>;
export type Priority = z.infer<typeof PrioritySchema>;
export type Strategy = z.infer<typeof StrategySchema>;
export type CriticalRisk = z.infer<typeof CriticalRiskSchema>;
