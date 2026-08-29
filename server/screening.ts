import { fitNASARidge, type NASATrainingRow } from "./nasaBatteryModel";

export type Checkpoint = { timeH: number; value: number; absoluteLimit?: number | null; measurementUncertainty?: number | null };

export type ScreeningInput = {
  componentId: string;
  lotId: string;
  partNumber: string;
  parameterName: string;
  unit: string;
  checkpoints: Checkpoint[];
  peerValuesAt24h: number[];
  safetySlope: number;
  holdRobustZ?: number;
  nasaTrainingData?: NASATrainingRow[];
};

export type ScreeningDecision = "ACCEPT" | "HOLD" | "REJECT";

export type ScreeningOutput = {
  decision: ScreeningDecision;
  componentId: string;
  parameterName: string;
  unit: string;
  value24h: number;
  peerMedian24h: number;
  peerMad24h: number;
  robustZ24h: number;
  predicted168h: number;
  upper168h: number;
  predictedSlope: number;
  safetySlope: number;
  absoluteLimitViolated: boolean;
  reasonCode: string;
  explanation: string;
  modelVersion: string;
  qualifiedLimit: number | null;
  checkpoints: { timeH: number; value: number }[];
};

const MODEL_VERSION = "robust-linear-v1";

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 0) return 0;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function mad(values: number[], center: number) {
  return median(values.map((value) => Math.abs(value - center)));
}

function requiredCheckpoint(checkpoints: Checkpoint[], timeH: number) {
  const checkpoint = checkpoints.find((item) => item.timeH === timeH);
  if (!checkpoint || !Number.isFinite(checkpoint.value)) throw new Error(`Missing valid ${timeH}h checkpoint`);
  return checkpoint;
}

export function evaluateScreening(input: ScreeningInput): ScreeningOutput {
  const at0 = requiredCheckpoint(input.checkpoints, 0);
  const at24 = requiredCheckpoint(input.checkpoints, 24);
  const peerValues = input.peerValuesAt24h.filter(Number.isFinite);
  const hasPeerBaseline = peerValues.length >= 3;
  const baselineValues = hasPeerBaseline ? peerValues : [at24.value];
  const peerMedian24h = median(baselineValues);
  const peerMad24h = hasPeerBaseline ? mad(baselineValues, peerMedian24h) : 0;
  const robustZ24h = !hasPeerBaseline ? 0 : peerMad24h === 0 ? (at24.value === peerMedian24h ? 0 : Math.sign(at24.value - peerMedian24h) * Number.POSITIVE_INFINITY) : (at24.value - peerMedian24h) / (1.4826 * peerMad24h);
  const earlySlope = (at24.value - at0.value) / 24;
  const nasaModel = fitNASARidge(input.nasaTrainingData ?? [], input.parameterName, input.unit);
  const predicted168h = nasaModel?.predict(at0.value, at24.value) ?? at24.value + earlySlope * 144;
  const uncertainty = Math.max(at24.measurementUncertainty ?? 0, peerMad24h * 1.4826, Math.abs(earlySlope) * 12, 0.01);
  const upper168h = predicted168h + 1.645 * uncertainty;
  const predictedSlope = (predicted168h - at24.value) / 144;
  const absoluteLimitViolated = input.checkpoints.some((checkpoint) => checkpoint.absoluteLimit != null && checkpoint.value > checkpoint.absoluteLimit);
  const holdRobustZ = input.holdRobustZ ?? 3.5;

  let decision: ScreeningDecision = "ACCEPT";
  let reasonCode = "WITHIN_PEER_ENVELOPE";
  if (absoluteLimitViolated) {
    decision = "REJECT";
    reasonCode = "ABSOLUTE_LIMIT_VIOLATED";
  } else if (Math.abs(robustZ24h) >= holdRobustZ || upper168h > (at24.absoluteLimit ?? Number.POSITIVE_INFINITY) || predictedSlope > input.safetySlope) {
    decision = "HOLD";
    reasonCode = predictedSlope > input.safetySlope ? "FORECAST_SAFETY_SLOPE_EXCEEDED" : "PEER_OUTLIER_REQUIRES_REVIEW";
  }

  const limitText = at24.absoluteLimit == null ? "no absolute limit supplied" : `qualified limit ${at24.absoluteLimit}`;
  const peerContext = hasPeerBaseline ? `${robustZ24h.toFixed(2)} MAD-equivalent units from its peer median of ${peerMedian24h.toFixed(3)} ${input.unit}` : "without a qualified peer baseline yet";
  const explanation = decision === "REJECT"
    ? `${input.componentId} exceeds an absolute ${input.parameterName} limit; route to rejection. Observed ${at24.value} ${input.unit} at 24h.`
    : decision === "HOLD"
      ? `${input.componentId} is ${peerContext}. The 168h forecast is ${predicted168h.toFixed(3)} ${input.unit} with an upper bound of ${upper168h.toFixed(3)}; ${limitText}.`
      : `${input.componentId} remains within the peer envelope ${hasPeerBaseline ? "" : "for this sparse baseline"}. The 168h forecast is ${predicted168h.toFixed(3)} ${input.unit} and the predicted slope remains below the qualified safety slope.`;

  return { decision, componentId: input.componentId, parameterName: input.parameterName, unit: input.unit, value24h: at24.value, peerMedian24h, peerMad24h, robustZ24h, predicted168h, upper168h, predictedSlope, safetySlope: input.safetySlope, absoluteLimitViolated, reasonCode, explanation, modelVersion: nasaModel?.version ?? MODEL_VERSION, qualifiedLimit: at24.absoluteLimit ?? null, checkpoints: input.checkpoints.map(({ timeH, value }) => ({ timeH, value })) };
}
