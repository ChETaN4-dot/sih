import { readFileSync } from "fs";
import { join } from "path";
import { DatasetRow, validateCSVContent } from "./csvValidator";

export type ComponentSummary = {
  component_id: string;
  lot_id: string;
  component_type: string;
  capacitance_uF: number;
  rated_voltage_V: number;
  test_voltage_V: number;
  test_temperature_C: number;
  data_source: string;
  data_type: string;
  available_checkpoints: number[];
  measurements: Array<{ time_h: number; dcl_uA: number }>;
};

class DatasetStore {
  private rows: DatasetRow[] = [];
  private initialized = false;

  constructor() {
    this.init();
  }

  private init() {
    if (this.initialized) return;
    try {
      // Load synthetic dataset
      const syntheticPath = join(process.cwd(), "server", "data", "synthetic_tantalum_dcl.csv");
      const syntheticContent = readFileSync(syntheticPath, "utf-8");
      const syntheticRes = validateCSVContent(syntheticContent);
      if (syntheticRes.valid) {
        this.rows.push(...syntheticRes.rows);
      }

      // Load real dataset
      const realPath = join(process.cwd(), "server", "data", "real_tantalum_dcl.csv");
      const realContent = readFileSync(realPath, "utf-8");
      const realRes = validateCSVContent(realContent);
      if (realRes.valid) {
        this.rows.push(...realRes.rows);
      }

      // Load space qualification dataset
      const qualPath = join(process.cwd(), "server", "data", "space_qual_tantalum_dcl.csv");
      const qualContent = readFileSync(qualPath, "utf-8");
      const qualRes = validateCSVContent(qualContent);
      if (qualRes.valid) {
        this.rows.push(...qualRes.rows);
      }

      this.initialized = true;
    } catch (err) {
      console.warn("[DatasetStore] Error loading static CSV datasets:", err);
    }
  }

  public getAllRows(): DatasetRow[] {
    return [...this.rows];
  }

  public addRows(newRows: DatasetRow[]) {
    this.rows.push(...newRows);
  }

  public getComponentList(): ComponentSummary[] {
    const compMap = new Map<string, DatasetRow[]>();
    for (const r of this.rows) {
      if (!compMap.has(r.component_id)) {
        compMap.set(r.component_id, []);
      }
      compMap.get(r.component_id)!.push(r);
    }

    const summaries: ComponentSummary[] = [];
    for (const [compId, compRows] of Array.from(compMap.entries())) {
      compRows.sort((a: DatasetRow, b: DatasetRow) => a.time_h - b.time_h);
      const first = compRows[0];
      summaries.push({
        component_id: compId,
        lot_id: first.lot_id,
        component_type: first.component_type,
        capacitance_uF: first.capacitance_uF,
        rated_voltage_V: first.rated_voltage_V,
        test_voltage_V: first.test_voltage_V,
        test_temperature_C: first.test_temperature_C,
        data_source: first.data_source,
        data_type: first.data_type,
        available_checkpoints: compRows.map((r: DatasetRow) => r.time_h),
        measurements: compRows.map((r: DatasetRow) => ({ time_h: r.time_h, dcl_uA: r.dcl_uA })),
      });
    }
    return summaries;
  }

  public getComponent(componentId: string): ComponentSummary | undefined {
    return this.getComponentList().find((c) => c.component_id === componentId);
  }

  public getLotList(): Array<{ lot_id: string; componentCount: number; data_type: string }> {
    const lotMap = new Map<string, { compIds: Set<string>; data_type: string }>();
    for (const r of this.rows) {
      if (!lotMap.has(r.lot_id)) {
        lotMap.set(r.lot_id, { compIds: new Set(), data_type: r.data_type });
      }
      lotMap.get(r.lot_id)!.compIds.add(r.component_id);
    }

    return Array.from(lotMap.entries()).map(([lotId, val]) => ({
      lot_id: lotId,
      componentCount: val.compIds.size,
      data_type: val.data_type,
    }));
  }
}

export const datasetStore = new DatasetStore();
