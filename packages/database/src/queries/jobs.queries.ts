import { eq, and, desc, sql, gte, lte, or, like } from 'drizzle-orm';
import type { Database } from '../client.js';
import { jobs, type JobInsert, type JobSelect } from '../schema/index.js';

/**
 * Job query filters
 */
export interface JobFilters {
  originProvince?: string;
  destinationProvince?: string;
  vehicleType?: string;
  isRefrigerated?: boolean;
  isActive?: boolean;
  minConfidence?: number;
  fromDate?: Date;
  toDate?: Date;
  limit?: number;
  offset?: number;
}

/**
 * Insert a new job
 */
export async function insertJob(
  db: Database,
  job: JobInsert
): Promise<JobSelect> {
  const [result] = await db.insert(jobs).values(job).returning();
  return result!;
}

/**
 * Get job by message ID
 */
export async function getJobByMessageId(
  db: Database,
  messageId: string
): Promise<JobSelect | undefined> {
  const [result] = await db
    .select()
    .from(jobs)
    .where(eq(jobs.messageId, messageId))
    .limit(1);
  return result;
}

/**
 * Check if a job exists by message ID
 */
export async function jobExists(
  db: Database,
  messageId: string
): Promise<boolean> {
  const [result] = await db
    .select({ count: sql<number>`count(*)` })
    .from(jobs)
    .where(eq(jobs.messageId, messageId));
  return (result?.count ?? 0) > 0;
}

/**
 * Get jobs with filters
 */
export async function getJobs(
  db: Database,
  filters: JobFilters = {}
): Promise<JobSelect[]> {
  const conditions = [];

  if (filters.originProvince) {
    conditions.push(eq(jobs.originProvince, filters.originProvince));
  }
  if (filters.destinationProvince) {
    conditions.push(eq(jobs.destinationProvince, filters.destinationProvince));
  }
  if (filters.vehicleType) {
    conditions.push(eq(jobs.vehicleType, filters.vehicleType));
  }
  if (filters.isRefrigerated !== undefined) {
    conditions.push(eq(jobs.isRefrigerated, filters.isRefrigerated));
  }
  if (filters.isActive !== undefined) {
    conditions.push(eq(jobs.isActive, filters.isActive));
  }
  if (filters.minConfidence !== undefined) {
    conditions.push(
      gte(jobs.confidenceScore, filters.minConfidence.toString())
    );
  }
  if (filters.fromDate) {
    conditions.push(gte(jobs.postedAt, filters.fromDate));
  }
  if (filters.toDate) {
    conditions.push(lte(jobs.postedAt, filters.toDate));
  }

  let query = db
    .select()
    .from(jobs)
    .orderBy(desc(jobs.postedAt))
    .limit(filters.limit ?? 50)
    .offset(filters.offset ?? 0);

  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as typeof query;
  }

  return query;
}

/**
 * Get jobs by route (origin and/or destination)
 */
export async function getJobsByRoute(
  db: Database,
  origin?: string,
  destination?: string,
  limit = 50
): Promise<JobSelect[]> {
  const conditions = [];

  if (origin) {
    conditions.push(
      or(
        eq(jobs.originProvince, origin),
        like(jobs.originMentioned, `%${origin}%`)
      )
    );
  }
  if (destination) {
    conditions.push(
      or(
        eq(jobs.destinationProvince, destination),
        like(jobs.destinationMentioned, `%${destination}%`)
      )
    );
  }

  if (conditions.length === 0) {
    return [];
  }

  return db
    .select()
    .from(jobs)
    .where(and(...conditions, eq(jobs.isActive, true)))
    .orderBy(desc(jobs.postedAt))
    .limit(limit);
}

/**
 * Deactivate old jobs
 */
export async function deactivateOldJobs(
  db: Database,
  olderThan: Date
): Promise<number> {
  const result = await db
    .update(jobs)
    .set({ isActive: false, updatedAt: new Date() })
    .where(and(eq(jobs.isActive, true), lte(jobs.postedAt, olderThan)));

  return result.rowCount ?? 0;
}

/**
 * Get job statistics
 */
export async function getJobStats(db: Database): Promise<{
  totalJobs: number;
  activeJobs: number;
  todayJobs: number;
  avgConfidence: number;
}> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [stats] = await db
    .select({
      totalJobs: sql<number>`count(*)`,
      activeJobs: sql<number>`sum(case when ${jobs.isActive} then 1 else 0 end)`,
      todayJobs: sql<number>`sum(case when ${jobs.createdAt} >= ${today} then 1 else 0 end)`,
      avgConfidence: sql<number>`avg(${jobs.confidenceScore})`,
    })
    .from(jobs);

  return {
    totalJobs: stats?.totalJobs ?? 0,
    activeJobs: stats?.activeJobs ?? 0,
    todayJobs: stats?.todayJobs ?? 0,
    avgConfidence: stats?.avgConfidence ?? 0,
  };
}
