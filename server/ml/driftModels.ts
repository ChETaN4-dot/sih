import { datasetStore, ComponentSummary } from "../data/datasetStore";
import { fitNASARidge, FittedDriftModel, NASATrainingRow } from "../nasaBatteryModel";

export type ModelEvalResult = {
  predicted168h: number;
  mae: number;
  rmse: number;
  r2?: number;
};

export type ExponentialFitResult = {
  i0: number;
  a: number;
  b: number;
  predicted168h: number;
  rmse: number;
  r2: number;
};

// Simple Pure-TypeScript Decision Tree for Regression
class DecisionTreeNode {
  featureIndex: number = -1;
  threshold: number = 0;
  left: DecisionTreeNode | null = null;
  right: DecisionTreeNode | null = null;
  value: number = 0;
  isLeaf: boolean = false;
}

function buildRegressionTree(X: number[][], y: number[], depth: number = 0, maxDepth: number = 4): DecisionTreeNode {
  const node = new DecisionTreeNode();
  if (X.length === 0) return node;

  const meanY = y.reduce((acc, val) => acc + val, 0) / y.length;
  node.value = meanY;

  if (depth >= maxDepth || X.length <= 2) {
    node.isLeaf = true;
    return node;
  }

  let bestSse = Number.MAX_VALUE;
  let bestFeature = -1;
  let bestThreshold = 0;
  let bestLeftX: number[][] = [];
  let bestLeftY: number[] = [];
  let bestRightX: number[][] = [];
  let bestRightY: number[] = [];

  const numFeatures = X[0].length;
  for (let f = 0; f < numFeatures; f++) {
    const featureValues = X.map((row) => row[f]);
    featureValues.sort((a, b) => a - b);

    for (let i = 0; i < featureValues.length - 1; i++) {
      const threshold = (featureValues[i] + featureValues[i + 1]) / 2;
      const leftX: number[][] = [];
      const leftY: number[] = [];
      const rightX: number[][] = [];
      const rightY: number[] = [];

      for (let r = 0; r < X.length; r++) {
        if (X[r][f] <= threshold) {
          leftX.push(X[r]);
          leftY.push(y[r]);
        } else {
          rightX.push(X[r]);
          rightY.push(y[r]);
        }
      }

      if (leftY.length === 0 || rightY.length === 0) continue;

      const leftMean = leftY.reduce((a, v) => a + v, 0) / leftY.length;
      const rightMean = rightY.reduce((a, v) => a + v, 0) / rightY.length;

      const leftSse = leftY.reduce((a, v) => a + Math.pow(v - leftMean, 2), 0);
      const rightSse = rightY.reduce((a, v) => a + Math.pow(v - rightMean, 2), 0);
      const totalSse = leftSse + rightSse;

      if (totalSse < bestSse) {
        bestSse = totalSse;
        bestFeature = f;
        bestThreshold = threshold;
        bestLeftX = leftX;
        bestLeftY = leftY;
        bestRightX = rightX;
        bestRightY = rightY;
      }
    }
  }

  if (bestFeature === -1) {
    node.isLeaf = true;
    return node;
  }

  node.featureIndex = bestFeature;
  node.threshold = bestThreshold;
  node.left = buildRegressionTree(bestLeftX, bestLeftY, depth + 1, maxDepth);
  node.right = buildRegressionTree(bestRightX, bestRightY, depth + 1, maxDepth);
  return node;
}

function predictTree(node: DecisionTreeNode, x: number[]): number {
  if (node.isLeaf || !node.left || !node.right) {
    return node.value;
  }
  if (x[node.featureIndex] <= node.threshold) {
    return predictTree(node.left, x);
  } else {
    return predictTree(node.right, x);
  }
}

export class RandomForestRegressorTS {
  trees: DecisionTreeNode[] = [];

  fit(X: number[][], y: number[], numTrees: number = 20, maxDepth: number = 4) {
    this.trees = [];
    const nSamples = X.length;
    if (nSamples === 0) return;

    for (let t = 0; t < numTrees; t++) {
      // Bootstrap sampling
      const bootX: number[][] = [];
      const bootY: number[] = [];
      for (let i = 0; i < nSamples; i++) {
        const randIdx = Math.floor(Math.random() * nSamples);
        bootX.push(X[randIdx]);
        bootY.push(y[randIdx]);
      }
      const tree = buildRegressionTree(bootX, bootY, 0, maxDepth);
      this.trees.push(tree);
    }
  }

  predict(x: number[]): number {
    if (this.trees.length === 0) return 0;
    const preds = this.trees.map((t) => predictTree(t, x));
    return preds.reduce((a, b) => a + b, 0) / preds.length;
  }
}

export type ComponentDriftAnalysisResult = {
  component: ComponentSummary;
  checkpoints: Array<{ time_h: number; dcl_uA: number }>;
  missingCheckpoints: number[];
  sufficient: boolean;
  message?: string;

  dclChange?: number;
  pctChange?: number;
  earlySlope?: number;
  overallSlope?: number;

  predictions?: {
    linear: {
      predicted168h: number;
      mae: number;
      rmse: number;
      description: string;
    };
    ridge: {
      predicted168h: number;
      mae: number;
      rmse: number;
      trainedOnComponentsCount: number;
      version: string;
      description: string;
    };
    randomForest: {
      predicted168h: number;
      mae: number;
      rmse: number;
      description: string;
    };
    exponential: ExponentialFitResult;
    bestModelByCV: "linear" | "ridge" | "randomForest" | "exponential";
    comparisonSummary: string;
  };
};

export function fitExponentialCurve(points: Array<{ time_h: number; dcl_uA: number }>): ExponentialFitResult {
  if (points.length < 2) {
    return { i0: points[0]?.dcl_uA ?? 0, a: 0, b: 0, predicted168h: points[0]?.dcl_uA ?? 0, rmse: 0, r2: 0 };
  }

  const p0 = points[0];
  const p1 = points[1];
  const i0 = p0.dcl_uA;

  let bestB = 0.01;
  let bestA = 0;
  let minRse = Number.MAX_VALUE;

  for (let bTest = 0.0001; bTest <= 0.1; bTest += 0.0005) {
    const denom = 1 - Math.exp(-bTest * p1.time_h);
    if (Math.abs(denom) < 1e-6) continue;
    const aTest = (p1.dcl_uA - i0) / denom;

    let sse = 0;
    for (const pt of points) {
      const pred = i0 + aTest * (1 - Math.exp(-bTest * pt.time_h));
      sse += Math.pow(pt.dcl_uA - pred, 2);
    }

    if (sse < minRse) {
      minRse = sse;
      bestB = bTest;
      bestA = aTest;
    }
  }

  const predicted168h = i0 + bestA * (1 - Math.exp(-bestB * 168));
  const rmse = Math.sqrt(minRse / points.length);

  const meanY = points.reduce((acc, p) => acc + p.dcl_uA, 0) / points.length;
  const sst = points.reduce((acc, p) => acc + Math.pow(p.dcl_uA - meanY, 2), 0);
  const r2 = sst > 1e-12 ? Math.max(0, 1 - minRse / sst) : 1.0;

  return { i0, a: bestA, b: bestB, predicted168h, rmse, r2 };
}

function evaluateLOCO(targetCompId: string, allComponents: ComponentSummary[]) {
  const trainComps = allComponents.filter(
    (c) => c.component_id !== targetCompId && c.available_checkpoints.includes(0) && c.available_checkpoints.includes(24) && c.available_checkpoints.includes(168),
  );

  const ridgeRows: NASATrainingRow[] = trainComps.map((c) => {
    const v0 = c.measurements.find((m) => m.time_h === 0)!.dcl_uA;
    const v24 = c.measurements.find((m) => m.time_h === 24)!.dcl_uA;
    const v168 = c.measurements.find((m) => m.time_h === 168)!.dcl_uA;
    return { componentId: c.component_id, value0h: v0, value24h: v24, value168h: v168 };
  });

  const fittedRidge = fitNASARidge(ridgeRows, undefined, undefined, targetCompId);

  // Train Pure-TS Random Forest Regressor on trainComps (LOCO split)
  const rfX = trainComps.map((c) => [c.measurements.find((m) => m.time_h === 0)!.dcl_uA, c.measurements.find((m) => m.time_h === 24)!.dcl_uA]);
  const rfY = trainComps.map((c) => c.measurements.find((m) => m.time_h === 168)!.dcl_uA);

  const rfModel = new RandomForestRegressorTS();
  rfModel.fit(rfX, rfY, 20, 4);

  let linearSse = 0;
  let linearSae = 0;
  let ridgeSse = 0;
  let ridgeSae = 0;
  let rfSse = 0;
  let rfSae = 0;
  let evalCount = 0;

  for (const c of trainComps) {
    const v0 = c.measurements.find((m) => m.time_h === 0)!.dcl_uA;
    const v24 = c.measurements.find((m) => m.time_h === 24)!.dcl_uA;
    const v168 = c.measurements.find((m) => m.time_h === 168)!.dcl_uA;

    const slope = (v24 - v0) / 24;
    const linearPred = v24 + slope * 144;
    const linearErr = linearPred - v168;

    linearSae += Math.abs(linearErr);
    linearSse += Math.pow(linearErr, 2);

    if (fittedRidge) {
      const ridgePred = fittedRidge.predict(v0, v24);
      const ridgeErr = ridgePred - v168;
      ridgeSae += Math.abs(ridgeErr);
      ridgeSse += Math.pow(ridgeErr, 2);
    }

    const rfPred = rfModel.predict([v0, v24]);
    const rfErr = rfPred - v168;
    rfSae += Math.abs(rfErr);
    rfSse += Math.pow(rfErr, 2);

    evalCount++;
  }

  const linearMae = evalCount > 0 ? linearSae / evalCount : 0;
  const linearRmse = evalCount > 0 ? Math.sqrt(linearSse / evalCount) : 0;

  const ridgeMae = evalCount > 0 && fittedRidge ? ridgeSae / evalCount : linearMae;
  const ridgeRmse = evalCount > 0 && fittedRidge ? Math.sqrt(ridgeSse / evalCount) : linearRmse;

  const rfMae = evalCount > 0 ? rfSae / evalCount : linearMae;
  const rfRmse = evalCount > 0 ? Math.sqrt(rfSse / evalCount) : linearRmse;

  return {
    fittedRidge,
    rfModel,
    linearMae,
    linearRmse,
    ridgeMae,
    ridgeRmse,
    rfMae,
    rfRmse,
    trainCount: evalCount,
  };
}

export function analyzeComponentDrift(componentId: string): ComponentDriftAnalysisResult {
  const component = datasetStore.getComponent(componentId);
  if (!component) {
    throw new Error(`Component with ID ${componentId} not found`);
  }

  const expectedCheckpoints = [0, 24, 96, 168];
  const checkpoints = component.measurements;
  const availTimes = checkpoints.map((m) => m.time_h);
  const missingCheckpoints = expectedCheckpoints.filter((t) => !availTimes.includes(t));

  if (checkpoints.length < 2) {
    return {
      component,
      checkpoints,
      missingCheckpoints,
      sufficient: false,
      message: "Insufficient measurements for drift analysis",
    };
  }

  const first = checkpoints[0];
  const last = checkpoints[checkpoints.length - 1];
  const dclChange = last.dcl_uA - first.dcl_uA;
  const pctChange = first.dcl_uA > 0 ? (dclChange / first.dcl_uA) * 100 : 0;
  const earlySlope = checkpoints.length >= 2 ? (checkpoints[1].dcl_uA - checkpoints[0].dcl_uA) / (checkpoints[1].time_h - checkpoints[0].time_h) : 0;
  const overallSlope = last.time_h > first.time_h ? dclChange / (last.time_h - first.time_h) : 0;

  const has0 = availTimes.includes(0);
  const has24 = availTimes.includes(24);

  if (!has0 || !has24) {
    return {
      component,
      checkpoints,
      missingCheckpoints,
      sufficient: true,
      dclChange,
      pctChange,
      earlySlope,
      overallSlope,
      message: "Early prediction (24h -> 168h) requires both 0h and 24h checkpoints",
    };
  }

  const v0 = checkpoints.find((m) => m.time_h === 0)!.dcl_uA;
  const v24 = checkpoints.find((m) => m.time_h === 24)!.dcl_uA;

  const linearSlope = (v24 - v0) / 24;
  const linearPred168 = v24 + linearSlope * 144;

  const allComps = datasetStore.getComponentList();
  const locoEval = evaluateLOCO(componentId, allComps);

  let ridgePred168 = linearPred168;
  if (locoEval.fittedRidge) {
    ridgePred168 = locoEval.fittedRidge.predict(v0, v24);
  }

  const rfPred168 = locoEval.rfModel ? locoEval.rfModel.predict([v0, v24]) : linearPred168;

  const expFit = fitExponentialCurve(checkpoints);

  // Model Selection based on LOCO CV MAE
  let bestModelByCV: "linear" | "ridge" | "randomForest" | "exponential" = "linear";
  let minMae = locoEval.linearMae;

  if (locoEval.fittedRidge && locoEval.ridgeMae < minMae) {
    minMae = locoEval.ridgeMae;
    bestModelByCV = "ridge";
  }
  if (locoEval.rfMae < minMae) {
    minMae = locoEval.rfMae;
    bestModelByCV = "randomForest";
  }

  const comparisonSummary = `Model Comparison (LOCO Grouped Split by Component): Ridge MAE = ${locoEval.ridgeMae.toFixed(3)} µA, Random Forest MAE = ${locoEval.rfMae.toFixed(3)} µA, Linear MAE = ${locoEval.linearMae.toFixed(3)} µA. Selected best model: ${bestModelByCV.toUpperCase()}. Exponential curve fit R² = ${expFit.r2.toFixed(3)}.`;

  return {
    component,
    checkpoints,
    missingCheckpoints,
    sufficient: true,
    dclChange,
    pctChange,
    earlySlope: linearSlope,
    overallSlope,
    predictions: {
      linear: {
        predicted168h: linearPred168,
        mae: locoEval.linearMae,
        rmse: locoEval.linearRmse,
        description: "Linear extrapolation using 0h to 24h rate of degradation",
      },
      ridge: {
        predicted168h: ridgePred168,
        mae: locoEval.ridgeMae,
        rmse: locoEval.ridgeRmse,
        trainedOnComponentsCount: locoEval.trainCount,
        version: locoEval.fittedRidge?.version ?? "linear-fallback",
        description: "Ridge regression model trained on held-out dataset components (LOCO split)",
      },
      randomForest: {
        predicted168h: rfPred168,
        mae: locoEval.rfMae,
        rmse: locoEval.rfRmse,
        description: "Pure TypeScript Random Forest Regressor trained on held-out components (LOCO split)",
      },
      exponential: expFit,
      bestModelByCV,
      comparisonSummary,
    },
  };
}
