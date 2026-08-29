import { index, int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const components = mysqlTable("components", {
  id: int("id").autoincrement().primaryKey(),
  componentId: varchar("componentId", { length: 128 }).notNull().unique(),
  partNumber: varchar("partNumber", { length: 128 }).notNull(),
  lotId: varchar("lotId", { length: 128 }).notNull(),
  testStationId: varchar("testStationId", { length: 128 }),
  temperatureC: decimal("temperatureC", { precision: 8, scale: 3 }),
  voltageV: decimal("voltageV", { precision: 8, scale: 3 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({ lotPartIdx: index("components_lot_part_idx").on(table.lotId, table.partNumber) }));

export const burnInMeasurements = mysqlTable("burnInMeasurements", {
  id: int("id").autoincrement().primaryKey(),
  componentId: int("componentId").notNull(),
  timeH: int("timeH").notNull(),
  parameterName: varchar("parameterName", { length: 128 }).notNull(),
  value: decimal("value", { precision: 18, scale: 8 }).notNull(),
  unit: varchar("unit", { length: 32 }).notNull(),
  absoluteLimit: decimal("absoluteLimit", { precision: 18, scale: 8 }),
  measurementUncertainty: decimal("measurementUncertainty", { precision: 18, scale: 8 }),
  runId: varchar("runId", { length: 128 }),
  measuredAt: timestamp("measuredAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  componentParameterTimeIdx: index("measurements_component_param_time_idx").on(table.componentId, table.parameterName, table.timeH),
}));

export const screeningRuns = mysqlTable("screeningRuns", {
  id: int("id").autoincrement().primaryKey(),
  runKey: varchar("runKey", { length: 128 }).notNull().unique(),
  requestedByUserId: int("requestedByUserId"),
  parameterName: varchar("parameterName", { length: 128 }).notNull(),
  status: mysqlEnum("status", ["queued", "complete", "failed"]).default("complete").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
});

export const screeningResults = mysqlTable("screeningResults", {
  id: int("id").autoincrement().primaryKey(),
  runId: int("runId").notNull(),
  componentId: int("componentId").notNull(),
  decision: mysqlEnum("decision", ["ACCEPT", "HOLD", "REJECT"]).notNull(),
  peerMedian24h: decimal("peerMedian24h", { precision: 18, scale: 8 }),
  peerMad24h: decimal("peerMad24h", { precision: 18, scale: 8 }),
  robustZ24h: decimal("robustZ24h", { precision: 18, scale: 8 }),
  predicted168h: decimal("predicted168h", { precision: 18, scale: 8 }),
  upper168h: decimal("upper168h", { precision: 18, scale: 8 }),
  predictedSlope: decimal("predictedSlope", { precision: 18, scale: 8 }),
  safetySlope: decimal("safetySlope", { precision: 18, scale: 8 }),
  absoluteLimitViolated: int("absoluteLimitViolated").default(0).notNull(),
  reasonCode: varchar("reasonCode", { length: 128 }).notNull(),
  explanation: text("explanation").notNull(),
  modelVersion: varchar("modelVersion", { length: 64 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({ runDecisionIdx: index("screening_results_run_decision_idx").on(table.runId, table.decision) }));

export const qaAuditEvents = mysqlTable("qaAuditEvents", {
  id: int("id").autoincrement().primaryKey(),
  runId: int("runId").notNull(),
  resultId: int("resultId"),
  actorUserId: int("actorUserId"),
  eventType: mysqlEnum("eventType", ["SCREENING_COMPLETED", "REVIEWED", "RELEASED", "REJECTED", "HELD"]).notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({ runEventIdx: index("qa_audit_run_event_idx").on(table.runId, table.eventType) }));

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Component = typeof components.$inferSelect;
export type BurnInMeasurement = typeof burnInMeasurements.$inferSelect;
export type ScreeningRun = typeof screeningRuns.$inferSelect;
export type ScreeningResult = typeof screeningResults.$inferSelect;
export type QaAuditEvent = typeof qaAuditEvents.$inferSelect;