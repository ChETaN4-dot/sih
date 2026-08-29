import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { createQaAuditEvent, createScreeningRun, getComponentWithMeasurements, getPeer24hValues, getQaAuditHistory, getRunWithResults, insertMeasurements, listRecentScreeningRuns, saveScreeningResult, upsertComponent } from "./db";
import { evaluateScreening } from "./screening";

const checkpointSchema = z.object({
  timeH: z.number().int().refine((value) => [0, 24, 96, 168].includes(value), "Unsupported burn-in checkpoint"),
  value: z.number().finite(),
  absoluteLimit: z.number().finite().nullable().optional(),
  measurementUncertainty: z.number().finite().nonnegative().nullable().optional(),
});

const nasaTrainingRowSchema = z.object({
  value0h: z.number().finite(),
  value24h: z.number().finite(),
  value168h: z.number().finite(),
  parameterName: z.string().max(128).optional(),
  unit: z.string().max(32).optional(),
});

const screeningInputSchema = z.object({
  componentId: z.string().min(1).max(128),
  lotId: z.string().min(1).max(128),
  partNumber: z.string().min(1).max(128),
  parameterName: z.string().min(1).max(128),
  unit: z.string().min(1).max(32),
  checkpoints: z.array(checkpointSchema).min(2),
  peerValuesAt24h: z.array(z.number().finite()).min(3),
  safetySlope: z.number().finite(),
  holdRobustZ: z.number().finite().positive().optional(),
  nasaTrainingData: z.array(nasaTrainingRowSchema).max(10000).optional(),
});

import { datasetStore } from "./data/datasetStore";
import { validateCSVContent } from "./data/csvValidator";
import { analyzeComponentDrift } from "./ml/driftModels";
import { analyzeLotAnomalies } from "./ml/lotAnomaly";
import { evaluateUnifiedRisk, VERSION_METADATA } from "./ml/riskEngine";
import { getEngineeringCriterionForComponent } from "./data/engineeringCriteria";
import { getEnvironmentalContextForComponent } from "./data/environmentalContext";
import { generateUnifiedExplanation } from "./ml/unifiedExplanation";

import { evaluateModuleA } from "./ml/anomalyEvaluation";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  screening: router({
    evaluate: publicProcedure.input(screeningInputSchema).mutation(({ input }) => evaluateScreening(input)),
    recentRuns: protectedProcedure.query(() => listRecentScreeningRuns()),
    run: protectedProcedure.input(z.object({ runKey: z.string().min(1) })).query(({ input }) => getRunWithResults(input.runKey)),
    auditHistory: protectedProcedure.input(z.object({ runId: z.number().int().positive() })).query(({ input }) => getQaAuditHistory(input.runId)),
    component: publicProcedure.input(z.object({ componentId: z.string().min(1), parameterName: z.string().min(1) })).query(({ input }) => getComponentWithMeasurements(input.componentId, input.parameterName)),
    ingest: protectedProcedure.input(z.object({
      component: z.object({ componentId: z.string().min(1).max(128), lotId: z.string().min(1).max(128), partNumber: z.string().min(1).max(128), testStationId: z.string().max(128).optional(), temperatureC: z.number().finite().optional(), voltageV: z.number().finite().optional() }),
      parameterName: z.string().min(1).max(128),
      unit: z.string().min(1).max(32),
      measurements: z.array(checkpointSchema).min(2),
      absoluteLimit: z.number().finite().optional(),
      safetySlope: z.number().finite(),
    })).mutation(async ({ input, ctx }) => {
      const component = await upsertComponent({ ...input.component, temperatureC: input.component.temperatureC?.toString(), voltageV: input.component.voltageV?.toString() });
      const runKey = `RUN-${Date.now()}-${component.componentId}`;
      const run = await createScreeningRun({ runKey, requestedByUserId: ctx.user.id, parameterName: input.parameterName, status: "complete", completedAt: new Date() });
      await insertMeasurements(input.measurements.map((measurement) => ({ componentId: component.id, timeH: measurement.timeH, parameterName: input.parameterName, value: measurement.value.toString(), unit: input.unit, absoluteLimit: (measurement.absoluteLimit ?? input.absoluteLimit)?.toString(), measurementUncertainty: measurement.measurementUncertainty?.toString(), runId: runKey })));
      const peerValuesAt24h = await getPeer24hValues(component.lotId, component.partNumber, input.parameterName);
      const output = evaluateScreening({ componentId: component.componentId, lotId: component.lotId, partNumber: component.partNumber, parameterName: input.parameterName, unit: input.unit, checkpoints: input.measurements, peerValuesAt24h: peerValuesAt24h.length >= 3 ? peerValuesAt24h : [input.measurements.find((item) => item.timeH === 24)!.value, ...peerValuesAt24h], safetySlope: input.safetySlope });
      const result = await saveScreeningResult({ runId: run.id, componentId: component.id, decision: output.decision, peerMedian24h: output.peerMedian24h.toString(), peerMad24h: output.peerMad24h.toString(), robustZ24h: output.robustZ24h.toString(), predicted168h: output.predicted168h.toString(), upper168h: output.upper168h.toString(), predictedSlope: output.predictedSlope.toString(), safetySlope: output.safetySlope.toString(), absoluteLimitViolated: output.absoluteLimitViolated ? 1 : 0, reasonCode: output.reasonCode, explanation: output.explanation, modelVersion: output.modelVersion });
      await createQaAuditEvent({ runId: run.id, resultId: result.id, actorUserId: ctx.user.id, eventType: output.decision === "ACCEPT" ? "RELEASED" : output.decision === "REJECT" ? "REJECTED" : "HELD", notes: output.explanation });
      return { run, result, output };
    }),
  }),
  analysis: router({
    getComponents: publicProcedure.query(() => {
      return datasetStore.getComponentList();
    }),
    getComponent: publicProcedure.input(z.object({ componentId: z.string().min(1) })).query(({ input }) => {
      return datasetStore.getComponent(input.componentId);
    }),
    getLots: publicProcedure.query(() => {
      return datasetStore.getLotList();
    }),
    analyzeDrift: publicProcedure.input(z.object({ componentId: z.string().min(1) })).query(({ input }) => {
      return analyzeComponentDrift(input.componentId);
    }),
    analyzeLot: publicProcedure.input(z.object({ lotId: z.string().min(1) })).query(({ input }) => {
      return analyzeLotAnomalies(input.lotId);
    }),
    evaluateModel: publicProcedure.query(() => {
      return evaluateModuleA();
    }),
    unifiedAnalysis: publicProcedure.input(z.object({ componentId: z.string().min(1) })).query(({ input }) => {
      const comp = datasetStore.getComponent(input.componentId);
      if (!comp) throw new Error(`Component ${input.componentId} not found`);

      const drift = analyzeComponentDrift(input.componentId);
      const specCriterion = getEngineeringCriterionForComponent(comp.capacitance_uF, comp.rated_voltage_V);
      const envContext = getEnvironmentalContextForComponent(comp.test_temperature_C, comp.test_voltage_V, comp.available_checkpoints[comp.available_checkpoints.length - 1]);

      let moduleAResult: ReturnType<typeof analyzeLotAnomalies> | null = null;
      let lotCompAnomaly: any = null;

      try {
        moduleAResult = analyzeLotAnomalies(comp.lot_id);
        if (moduleAResult.sufficient) {
          lotCompAnomaly = moduleAResult.components.find((c) => c.componentId === input.componentId);
        }
      } catch (e) {
        // Ignored if lot not found or sparse
      }

      const currentDcl = comp.measurements[comp.measurements.length - 1].dcl_uA;
      const verdict = evaluateUnifiedRisk({
        measuredDcl: currentDcl,
        specLimit: specCriterion.value,
        robustZScore: lotCompAnomaly?.robustZScore,
        isolationForestScore: lotCompAnomaly?.isolationForestScore,
        earlySlope: drift.earlySlope,
        predicted168hDcl: drift.predictions?.ridge.predicted168h ?? drift.predictions?.linear.predicted168h,
      });

      const explanation = generateUnifiedExplanation({
        componentId: comp.component_id,
        lotId: comp.lot_id,
        currentDcl,
        latestTimeH: comp.available_checkpoints[comp.available_checkpoints.length - 1],
        dclChange: drift.dclChange ?? 0,
        pctChange: drift.pctChange ?? 0,
        earlySlope: drift.earlySlope ?? 0,
        lotMedianDcl: lotCompAnomaly?.lotMedianDcl,
        lotMadDcl: lotCompAnomaly?.lotMadDcl,
        robustZScore: lotCompAnomaly?.robustZScore,
        isolationForestScore: lotCompAnomaly?.isolationForestScore,
        predicted168hLinear: drift.predictions?.linear.predicted168h,
        predicted168hRidge: drift.predictions?.ridge.predicted168h,
        ridgeMae: drift.predictions?.ridge.mae,
        specCriterion,
        verdict,
      });

      return {
        component: comp,
        drift,
        lotAnomaly: lotCompAnomaly,
        lotSummary: moduleAResult ? {
          totalComponents: moduleAResult.totalComponentsInLot,
          flaggedCount: moduleAResult.flaggedCount,
          medianDcl: moduleAResult.lotBaseline?.medianDcl,
          madDcl: moduleAResult.lotBaseline?.madDcl,
        } : null,
        specCriterion,
        envContext,
        verdict,
        explanation,
        versionMetadata: VERSION_METADATA,
        timestamp: new Date().toISOString(),
      };
    }),
    uploadCSV: publicProcedure.input(z.object({ csvText: z.string() })).mutation(({ input }) => {
      const res = validateCSVContent(input.csvText);
      if (!res.valid) {
        return { success: false, validation: res };
      }
      datasetStore.addRows(res.rows);
      return { success: true, validation: res };
    }),
    addComponent: publicProcedure.input(z.object({
      component_id: z.string().min(1),
      lot_id: z.string().min(1),
      component_type: z.string().default("Solid MnO2 Tantalum Capacitor"),
      capacitance_uF: z.number().positive().default(47),
      rated_voltage_V: z.number().positive().default(25),
      test_voltage_V: z.number().positive().default(25),
      test_temperature_C: z.number().default(125),
      measurements: z.array(z.object({
        time_h: z.number().nonnegative(),
        dcl_uA: z.number().nonnegative(),
      })).min(2),
      data_source: z.string().default("MANUAL_INGESTION"),
      data_type: z.string().default("MANUAL_ENTRY"),
    })).mutation(({ input }) => {
      const rows = input.measurements.map(m => ({
        component_id: input.component_id,
        lot_id: input.lot_id,
        component_type: input.component_type,
        capacitance_uF: input.capacitance_uF,
        rated_voltage_V: input.rated_voltage_V,
        test_voltage_V: input.test_voltage_V,
        test_temperature_C: input.test_temperature_C,
        time_h: m.time_h,
        dcl_uA: m.dcl_uA,
        data_source: input.data_source,
        data_type: input.data_type,
      }));
      datasetStore.addRows(rows);
      return { success: true, component_id: input.component_id };
    }),
  }),
});

export type AppRouter = typeof appRouter;
