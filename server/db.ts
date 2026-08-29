import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, components, burnInMeasurements, screeningRuns, screeningResults, qaAuditEvents } from "../drizzle/schema";
import { and, desc, eq } from "drizzle-orm";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function upsertComponent(input: typeof components.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.insert(components).values(input).onDuplicateKeyUpdate({
    set: {
      partNumber: input.partNumber,
      lotId: input.lotId,
      testStationId: input.testStationId,
      temperatureC: input.temperatureC,
      voltageV: input.voltageV,
      updatedAt: new Date(),
    },
  });
  const rows = await db.select().from(components).where(eq(components.componentId, input.componentId)).limit(1);
  if (!rows[0]) throw new Error("Component could not be persisted");
  return rows[0];
}

export async function insertMeasurements(values: (typeof burnInMeasurements.$inferInsert)[]) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  if (values.length === 0) return [];
  await db.insert(burnInMeasurements).values(values);
  return db.select().from(burnInMeasurements).where(eq(burnInMeasurements.componentId, values[0]!.componentId));
}

export async function getComponentWithMeasurements(componentId: string, parameterName: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const componentRows = await db.select().from(components).where(eq(components.componentId, componentId)).limit(1);
  const component = componentRows[0];
  if (!component) return undefined;
  const measurements = await db.select().from(burnInMeasurements).where(and(eq(burnInMeasurements.componentId, component.id), eq(burnInMeasurements.parameterName, parameterName)));
  return { component, measurements };
}

export async function getPeer24hValues(lotId: string, partNumber: string, parameterName: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const rows = await db.select({ value: burnInMeasurements.value }).from(burnInMeasurements).innerJoin(components, eq(burnInMeasurements.componentId, components.id)).where(and(eq(components.lotId, lotId), eq(components.partNumber, partNumber), eq(burnInMeasurements.parameterName, parameterName), eq(burnInMeasurements.timeH, 24)));
  return rows.map((row) => Number(row.value));
}

export async function createScreeningRun(input: typeof screeningRuns.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.insert(screeningRuns).values(input);
  const rows = await db.select().from(screeningRuns).where(eq(screeningRuns.runKey, input.runKey)).limit(1);
  if (!rows[0]) throw new Error("Screening run could not be persisted");
  return rows[0];
}

export async function saveScreeningResult(input: typeof screeningResults.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.insert(screeningResults).values(input);
  const rows = await db.select().from(screeningResults).where(eq(screeningResults.runId, input.runId)).orderBy(desc(screeningResults.createdAt)).limit(1);
  if (!rows[0]) throw new Error("Screening result could not be persisted");
  return rows[0];
}

export async function createQaAuditEvent(input: typeof qaAuditEvents.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.insert(qaAuditEvents).values(input);
  return input;
}

export async function listRecentScreeningRuns(limit = 20) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db.select().from(screeningRuns).orderBy(desc(screeningRuns.createdAt)).limit(limit);
}

export async function getRunWithResults(runKey: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const runs = await db.select().from(screeningRuns).where(eq(screeningRuns.runKey, runKey)).limit(1);
  const run = runs[0];
  if (!run) return undefined;
  const results = await db.select().from(screeningResults).where(eq(screeningResults.runId, run.id)).orderBy(desc(screeningResults.createdAt));
  return { run, results };
}

export async function getQaAuditHistory(runId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db.select().from(qaAuditEvents).where(eq(qaAuditEvents.runId, runId)).orderBy(desc(qaAuditEvents.createdAt));
}
