import postgres from 'postgres';

/**
 * Get raw text search variants for a term.
 * Maps structured field values to patterns that appear in raw WhatsApp messages.
 */
function getRawTextVariants(term: string): string[] {
  const normalized = term.toLowerCase().trim();

  // Map common terms to their raw text patterns
  const variantMap: Record<string, string[]> = {
    // Body types
    'damperli': ['damper'],
    'damper': ['damper'],
    'tenteli': ['tente'],
    'tente': ['tente'],
    'kapali': ['kapalı', 'kapali'],
    'acik_kasa': ['açık', 'acik'],
    'acik': ['açık', 'acik'],
    'lowbed': ['lowbed', 'low bed'],
    'platform': ['platform'],
    'sal': ['sal'],
    'frigo': ['frigo', 'frigorifik', 'soğuk'],
    'frigorifik': ['frigo', 'frigorifik', 'soğuk'],

    // Vehicle types
    'tir': ['tır', 'tir'],
    'kamyon': ['kamyon'],
    'kamyonet': ['kamyonet'],
    'dorse': ['dorse'],
    'cekici': ['çekici', 'cekici'],
  };

  return variantMap[normalized] || [normalized];
}

export interface SearchJobsParams {
  origin?: string;
  destination?: string;
  vehicleType?: string;
  bodyType?: string;
  cargoType?: string;
  isRefrigerated?: boolean;
  isUrgent?: boolean;
  minWeight?: number;
  maxWeight?: number;
  limit?: number;
}

export interface JobResult {
  id: string;
  originProvince: string | null;
  destinationProvince: string | null;
  vehicleType: string | null;
  bodyType: string | null;
  cargoType: string | null;
  weight: number | null;
  weightUnit: string | null;
  isRefrigerated: boolean;
  isUrgent: boolean;
  contactPhone: string | null;
  contactName: string | null;
  rawText: string;
  postedAt: Date | null;
  createdAt: Date;
}

export interface SearchJobsResult {
  jobs: JobResult[];
  totalCount: number;
  dedupedCount: number;
}

export async function searchJobs(
  sql: postgres.Sql,
  params: SearchJobsParams
): Promise<SearchJobsResult> {
  const limit = params.limit || 10;

  // Build dynamic query based on provided parameters
  // Only show jobs from last 24 hours
  // Exclude jobs without a destination (varis belirtilmemis)
  const conditions: string[] = [
    'is_active = true',
    "created_at > NOW() - INTERVAL '24 hours'",
    "destination_province IS NOT NULL AND destination_province != ''"
  ];
  const values: (string | number | boolean)[] = [];
  let paramIndex = 1;

  if (params.origin && params.destination) {
    // Search only main fields - routes array causes false positives
    conditions.push(`(LOWER(origin_province) LIKE LOWER($${paramIndex}) AND LOWER(destination_province) LIKE LOWER($${paramIndex + 1}))`);
    values.push(`%${params.origin}%`);
    values.push(`%${params.destination}%`);
    paramIndex += 2;
  } else if (params.origin) {
    // Search only main origin field - routes array causes false positives
    conditions.push(`LOWER(origin_province) LIKE LOWER($${paramIndex})`);
    values.push(`%${params.origin}%`);
    paramIndex++;
  } else if (params.destination) {
    // Search only main destination field - routes array causes false positives
    conditions.push(`LOWER(destination_province) LIKE LOWER($${paramIndex})`);
    values.push(`%${params.destination}%`);
    paramIndex++;
  }

  if (params.vehicleType) {
    // Search structured field OR raw_text (fallback for parser misses)
    const vehicleVariants = getRawTextVariants(params.vehicleType);
    conditions.push(`(
      LOWER(vehicle_type) LIKE LOWER($${paramIndex})
      OR LOWER(raw_text) LIKE LOWER($${paramIndex + 1})
    )`);
    values.push(`%${params.vehicleType}%`);
    values.push(`%${vehicleVariants[0]}%`);
    paramIndex += 2;
  }

  if (params.bodyType) {
    // Search structured field OR raw_text (fallback for parser misses)
    const bodyVariants = getRawTextVariants(params.bodyType);
    conditions.push(`(
      LOWER(body_type) LIKE LOWER($${paramIndex})
      OR LOWER(raw_text) LIKE LOWER($${paramIndex + 1})
    )`);
    values.push(`%${params.bodyType}%`);
    values.push(`%${bodyVariants[0]}%`);
    paramIndex += 2;
  }

  if (params.cargoType) {
    // Search structured field OR raw_text (fallback for parser misses)
    conditions.push(`(
      LOWER(cargo_type) LIKE LOWER($${paramIndex})
      OR LOWER(raw_text) LIKE LOWER($${paramIndex + 1})
    )`);
    values.push(`%${params.cargoType}%`);
    values.push(`%${params.cargoType}%`);
    paramIndex += 2;
  }

  if (params.isRefrigerated !== undefined) {
    if (params.isRefrigerated) {
      // Search structured field OR raw_text for frigo keywords
      conditions.push(`(
        is_refrigerated = true
        OR LOWER(raw_text) LIKE '%frigo%'
        OR LOWER(raw_text) LIKE '%soğuk%'
        OR LOWER(raw_text) LIKE '%soguk%'
      )`);
    } else {
      conditions.push(`is_refrigerated = $${paramIndex}`);
      values.push(params.isRefrigerated);
      paramIndex++;
    }
  }

  if (params.isUrgent !== undefined) {
    conditions.push(`is_urgent = $${paramIndex}`);
    values.push(params.isUrgent);
    paramIndex++;
  }

  // Get unique count (deduplicated) - this is the true count of distinct jobs
  const countQuery = `
    SELECT COUNT(*) as count FROM (
      SELECT DISTINCT
        COALESCE(origin_province, ''), COALESCE(destination_province, ''),
        COALESCE(vehicle_type, ''), COALESCE(body_type, ''), COALESCE(cargo_type, ''),
        COALESCE(weight::text, ''), COALESCE(contact_phone, ''),
        COALESCE(is_urgent::text, ''), COALESCE(is_refrigerated::text, '')
      FROM jobs
      WHERE ${conditions.join(' AND ')}
    ) unique_jobs
  `;
  const countResult = await sql.unsafe(countQuery, values);
  const totalCount = Number(countResult[0]?.count || 0);

  // Fetch many more to get accurate dedup count
  values.push(100);

  const query = `
    SELECT
      id,
      origin_province as "originProvince",
      destination_province as "destinationProvince",
      vehicle_type as "vehicleType",
      body_type as "bodyType",
      cargo_type as "cargoType",
      weight,
      weight_unit as "weightUnit",
      is_refrigerated as "isRefrigerated",
      is_urgent as "isUrgent",
      contact_phone as "contactPhone",
      contact_name as "contactName",
      raw_text as "rawText",
      posted_at as "postedAt",
      created_at as "createdAt"
    FROM jobs
    WHERE ${conditions.join(' AND ')}
    ORDER BY created_at DESC
    LIMIT $${paramIndex}
  `;

  const result = await sql.unsafe(query, values);
  const allJobs = result as unknown as JobResult[];

  // Deduplicate only if ALL fields are identical (true duplicates/spam)
  const deduped = deduplicateJobs(allJobs);

  return {
    jobs: deduped.slice(0, limit),
    totalCount,
    dedupedCount: deduped.length,
  };
}

/**
 * Deduplicate jobs - only remove exact duplicates
 * Uses all display fields to determine if two jobs are identical
 */
function deduplicateJobs(jobs: JobResult[]): JobResult[] {
  const seen = new Set<string>();
  const unique: JobResult[] = [];

  for (const job of jobs) {
    // Create a key from ALL fields that would be displayed
    // Only dedupe if everything is exactly the same
    const key = [
      job.originProvince?.toLowerCase() || '',
      job.destinationProvince?.toLowerCase() || '',
      job.vehicleType?.toLowerCase() || '',
      job.bodyType?.toLowerCase() || '',
      job.cargoType?.toLowerCase() || '',
      job.weight?.toString() || '',
      job.contactPhone || '',
      job.isUrgent ? 'urgent' : '',
      job.isRefrigerated ? 'frigo' : '',
    ].join('|');

    if (!seen.has(key)) {
      seen.add(key);
      unique.push(job);
    }
  }

  return unique;
}

export async function getJobById(
  sql: postgres.Sql,
  jobId: string
): Promise<JobResult | null> {
  const result = await sql`
    SELECT
      id,
      origin_province as "originProvince",
      destination_province as "destinationProvince",
      vehicle_type as "vehicleType",
      body_type as "bodyType",
      cargo_type as "cargoType",
      weight,
      weight_unit as "weightUnit",
      is_refrigerated as "isRefrigerated",
      is_urgent as "isUrgent",
      contact_phone as "contactPhone",
      contact_name as "contactName",
      raw_text as "rawText",
      posted_at as "postedAt",
      created_at as "createdAt"
    FROM jobs
    WHERE id = ${jobId} AND is_active = true
  `;

  if (result.length === 0) {
    return null;
  }

  return result[0] as unknown as JobResult;
}

export async function countJobs(
  sql: postgres.Sql,
  params: Omit<SearchJobsParams, 'limit'>
): Promise<number> {
  const conditions: string[] = [
    'is_active = true',
    "destination_province IS NOT NULL AND destination_province != ''"
  ];
  const values: (string | boolean)[] = [];
  let paramIndex = 1;

  if (params.origin && params.destination) {
    // Search only main fields - routes array causes false positives
    conditions.push(`(LOWER(origin_province) LIKE LOWER($${paramIndex}) AND LOWER(destination_province) LIKE LOWER($${paramIndex + 1}))`);
    values.push(`%${params.origin}%`);
    values.push(`%${params.destination}%`);
    paramIndex += 2;
  } else if (params.origin) {
    // Search only main origin field
    conditions.push(`LOWER(origin_province) LIKE LOWER($${paramIndex})`);
    values.push(`%${params.origin}%`);
    paramIndex++;
  } else if (params.destination) {
    // Search only main destination field
    conditions.push(`LOWER(destination_province) LIKE LOWER($${paramIndex})`);
    values.push(`%${params.destination}%`);
    paramIndex++;
  }

  const query = `
    SELECT COUNT(*) as count
    FROM jobs
    WHERE ${conditions.join(' AND ')}
  `;

  const result = await sql.unsafe(query, values);
  return Number(result[0]?.count || 0);
}

// Tool definition for OpenAI function calling
export const searchJobsToolDefinition = {
  type: 'function' as const,
  function: {
    name: 'search_jobs',
    description: 'Search for logistics jobs in the database. IMPORTANT: If user mentions ANY city name, even just one word like "istanbul" or "kocaeli", you MUST call this function with that city as the origin. Single city name = search jobs FROM that city.',
    parameters: {
      type: 'object',
      properties: {
        origin: {
          type: 'string',
          description: 'Origin city/province name in Turkish (e.g., "Istanbul", "Izmir", "Ankara")',
        },
        destination: {
          type: 'string',
          description: 'Destination city/province name in Turkish (e.g., "Istanbul", "Izmir", "Ankara")',
        },
        vehicleType: {
          type: 'string',
          description: 'Type of vehicle (e.g., "TIR", "KAMYON", "KAMYONET")',
        },
        bodyType: {
          type: 'string',
          description: 'Type of truck body/trailer (e.g., "DAMPERLI", "TENTELI", "FRIGO", "ACIK_KASA", "KAPALI")',
        },
        cargoType: {
          type: 'string',
          description: 'Type of cargo (e.g., "tekstil", "gida", "mobilya", "demir")',
        },
        isRefrigerated: {
          type: 'boolean',
          description: 'Whether refrigerated transport is required (frigorifik)',
        },
        isUrgent: {
          type: 'boolean',
          description: 'Whether the job is urgent (acil)',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results to return (default: 10)',
        },
      },
      required: [],
    },
  },
};

export const getJobDetailsToolDefinition = {
  type: 'function' as const,
  function: {
    name: 'get_job_details',
    description: 'Get detailed information about a specific job by its ID',
    parameters: {
      type: 'object',
      properties: {
        jobId: {
          type: 'string',
          description: 'The UUID of the job to retrieve',
        },
      },
      required: ['jobId'],
    },
  },
};
