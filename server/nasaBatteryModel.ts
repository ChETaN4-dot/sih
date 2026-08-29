export type NASATrainingRow = {
  value0h: number;
  value24h: number;
  value168h: number;
  componentId?: string;
  parameterName?: string;
  unit?: string;
};

export type FittedDriftModel = {
  version: string;
  rows: number;
  coefficients: [number, number, number];
  mae: number;
  rmse: number;
  predict: (value0h: number, value24h: number) => number;
};

const NASA_MODEL_VERSION = "nasa-pcoe-ridge-v1";

function solve3x3(matrix: number[][], vector: number[]) {
  const augmented = matrix.map((row, index) => [...row, vector[index]]);
  for (let column = 0; column < 3; column += 1) {
    let pivot = column;
    for (let row = column + 1; row < 3; row += 1) {
      if (Math.abs(augmented[row][column]) > Math.abs(augmented[pivot][column])) pivot = row;
    }
    if (Math.abs(augmented[pivot][column]) < 1e-12) return null;
    [augmented[column], augmented[pivot]] = [augmented[pivot], augmented[column]];
    const divisor = augmented[column][column];
    for (let index = column; index <= 3; index += 1) augmented[column][index] /= divisor;
    for (let row = 0; row < 3; row += 1) {
      if (row === column) continue;
      const factor = augmented[row][column];
      for (let index = column; index <= 3; index += 1) augmented[row][index] -= factor * augmented[column][index];
    }
  }
  return [augmented[0][3], augmented[1][3], augmented[2][3]] as [number, number, number];
}

export function fitNASARidge(
  rows: NASATrainingRow[],
  parameterName?: string,
  unit?: string,
  excludeComponentId?: string,
): FittedDriftModel | null {
  const usable = rows.filter((row) =>
    (excludeComponentId == null || row.componentId == null || row.componentId !== excludeComponentId) &&
    (parameterName == null || row.parameterName == null || row.parameterName === parameterName) &&
    (unit == null || row.unit == null || row.unit === unit) &&
    [row.value0h, row.value24h, row.value168h].every(Number.isFinite),
  );
  if (usable.length < 3) return null;
  const matrix = Array.from({ length: 3 }, () => [0, 0, 0]);
  const vector = [0, 0, 0];
  for (const row of usable) {
    const features = [1, row.value0h, row.value24h];
    for (let left = 0; left < 3; left += 1) {
      vector[left] += features[left] * row.value168h;
      for (let right = 0; right < 3; right += 1) matrix[left][right] += features[left] * features[right];
    }
  }
  matrix[1][1] += 1e-8;
  matrix[2][2] += 1e-8;
  const coefficients = solve3x3(matrix, vector);
  if (!coefficients) return null;
  const predict = (value0h: number, value24h: number) => coefficients[0] + coefficients[1] * value0h + coefficients[2] * value24h;
  const mae = usable.reduce((total, row) => total + Math.abs(predict(row.value0h, row.value24h) - row.value168h), 0) / usable.length;
  const mse = usable.reduce((total, row) => total + Math.pow(predict(row.value0h, row.value24h) - row.value168h, 2), 0) / usable.length;
  const rmse = Math.sqrt(mse);
  return { version: NASA_MODEL_VERSION, rows: usable.length, coefficients, mae, rmse, predict };
}

// Accepts a normalized export made from NASA PCoE Battery Data Set cycle records.
export function parseNASATrainingCsv(csv: string): NASATrainingRow[] {
  const lines = csv.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((header) => header.trim().toLowerCase());
  const indexOf = (names: string[]) => headers.findIndex((header) => names.includes(header));
  const compId = indexOf(["component_id", "componentid", "part_id"]);
  const value0 = indexOf(["value_0h", "value0h", "0h"]);
  const value24 = indexOf(["value_24h", "value24h", "24h"]);
  const value168 = indexOf(["value_168h", "value168h", "168h"]);
  if ([value0, value24, value168].some((index) => index < 0)) return [];
  const parameter = indexOf(["parameter", "parametername"]);
  const unit = indexOf(["unit"]);
  return lines.slice(1).map((line) => line.split(",").map((value) => value.trim())).map((cells) => ({
    componentId: compId >= 0 ? cells[compId] : undefined,
    value0h: Number(cells[value0]), value24h: Number(cells[value24]), value168h: Number(cells[value168]),
    parameterName: parameter >= 0 ? cells[parameter] : undefined, unit: unit >= 0 ? cells[unit] : undefined,
  }));
}

export const NASA_PCOE_BATTERY_DATASET = {
  name: "NASA PCoE Battery Data Set",
  source: "https://phm-datasets.s3.amazonaws.com/NASA/5.+Battery+Data+Set.zip",
  citation: "B. Saha and K. Goebel (2007), NASA Prognostics Data Repository",
};