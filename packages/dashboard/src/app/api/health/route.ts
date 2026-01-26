import { NextResponse } from 'next/server';
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL || '', {
  ssl: 'require',
  max: 1,
  idle_timeout: 20,
  connect_timeout: 10,
});

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface ServiceHealth {
  name: string;
  status: 'operational' | 'degraded' | 'down';
  latency?: number;
  lastCheck: string;
  details?: string;
  metrics?: Record<string, number>;
}

async function checkDatabase(): Promise<ServiceHealth> {
  const start = Date.now();
  try {
    await sql`SELECT 1`;
    return {
      name: 'PostgreSQL Database',
      status: 'operational',
      latency: Date.now() - start,
      lastCheck: new Date().toISOString(),
    };
  } catch (error) {
    return {
      name: 'PostgreSQL Database',
      status: 'down',
      lastCheck: new Date().toISOString(),
      details: error instanceof Error ? error.message : 'Connection failed',
    };
  }
}

async function checkEvolutionInstance(instanceName: string, displayName: string): Promise<ServiceHealth> {
  const start = Date.now();
  try {
    // Check if we're receiving messages from this Evolution API instance
    const result = await sql`
      SELECT
        COUNT(*) as total_messages,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '5 minutes') as last_5min,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 hour') as last_hour,
        MAX(created_at) as last_message_at
      FROM raw_messages
      WHERE instance_name = ${instanceName}
    `;

    const data = result[0];
    const lastMessageAt = data.last_message_at ? new Date(data.last_message_at) : null;
    const minutesSinceLastMessage = lastMessageAt
      ? Math.floor((Date.now() - lastMessageAt.getTime()) / 60000)
      : null;

    let status: 'operational' | 'degraded' | 'down' = 'operational';
    let details = '';

    if (minutesSinceLastMessage === null) {
      status = 'down';
      details = 'No messages received';
    } else if (minutesSinceLastMessage > 30) {
      status = 'degraded';
      details = `Last message ${minutesSinceLastMessage} minutes ago`;
    } else if (minutesSinceLastMessage > 60) {
      status = 'down';
      details = `No messages for ${minutesSinceLastMessage} minutes`;
    }

    return {
      name: displayName,
      status,
      latency: Date.now() - start,
      lastCheck: new Date().toISOString(),
      details: details || `Last message ${minutesSinceLastMessage} min ago`,
      metrics: {
        totalMessages: Number(data.total_messages),
        last5min: Number(data.last_5min),
        lastHour: Number(data.last_hour),
        minutesSinceLastMessage: minutesSinceLastMessage || 0,
      },
    };
  } catch (error) {
    return {
      name: displayName,
      status: 'down',
      lastCheck: new Date().toISOString(),
      details: error instanceof Error ? error.message : 'Check failed',
    };
  }
}

async function checkEvolutionAPI(): Promise<ServiceHealth> {
  return checkEvolutionInstance('turkish-logistics', 'Evolution API');
}

async function checkEvolutionAPI2(): Promise<ServiceHealth> {
  return checkEvolutionInstance('turkish-logistics-2', 'Evolution API 2');
}

async function checkScraperSource(sourceJid: string, displayName: string): Promise<ServiceHealth> {
  const start = Date.now();
  try {
    const result = await sql`
      SELECT
        COUNT(*) as total_jobs,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '5 minutes') as last_5min,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 hour') as last_hour,
        MAX(created_at) as last_job_at
      FROM jobs
      WHERE source_group_jid = ${sourceJid}
    `;

    const data = result[0];
    const lastJobAt = data.last_job_at ? new Date(data.last_job_at) : null;
    const minutesSinceLastJob = lastJobAt
      ? Math.floor((Date.now() - lastJobAt.getTime()) / 60000)
      : null;

    let status: 'operational' | 'degraded' | 'down' = 'operational';
    let details = '';

    if (minutesSinceLastJob === null) {
      status = 'down';
      details = 'No jobs received';
    } else if (minutesSinceLastJob > 30) {
      status = 'degraded';
      details = `Last job ${minutesSinceLastJob} minutes ago`;
    } else if (minutesSinceLastJob > 60) {
      status = 'down';
      details = `No jobs for ${minutesSinceLastJob} minutes`;
    }

    return {
      name: displayName,
      status,
      latency: Date.now() - start,
      lastCheck: new Date().toISOString(),
      details: details || `Last job ${minutesSinceLastJob} min ago`,
      metrics: {
        totalJobs: Number(data.total_jobs),
        last5min: Number(data.last_5min),
        lastHour: Number(data.last_hour),
        minutesSinceLastJob: minutesSinceLastJob || 0,
      },
    };
  } catch (error) {
    return {
      name: displayName,
      status: 'down',
      lastCheck: new Date().toISOString(),
      details: error instanceof Error ? error.message : 'Check failed',
    };
  }
}

async function checkKamyoon(): Promise<ServiceHealth> {
  return checkScraperSource('kamyoon-loads@g.us', 'Kamyoon API');
}

async function checkYukbul(): Promise<ServiceHealth> {
  return checkScraperSource('yukbul-loads@g.us', 'Yukbul API');
}

async function checkOpenAI(): Promise<ServiceHealth> {
  const start = Date.now();
  try {
    const response = await fetch('https://status.openai.com/api/v2/status.json', {
      next: { revalidate: 60 }, // Cache for 1 minute
    });

    if (!response.ok) {
      return {
        name: 'OpenAI API',
        status: 'degraded',
        lastCheck: new Date().toISOString(),
        details: 'Could not fetch status',
      };
    }

    const data = await response.json();
    const indicator = data.status?.indicator; // none, minor, major, critical

    let status: 'operational' | 'degraded' | 'down' = 'operational';
    if (indicator === 'minor') status = 'degraded';
    else if (indicator === 'major' || indicator === 'critical') status = 'down';

    return {
      name: 'OpenAI API',
      status,
      latency: Date.now() - start,
      lastCheck: new Date().toISOString(),
      details: data.status?.description || 'Status unknown',
    };
  } catch (error) {
    return {
      name: 'OpenAI API',
      status: 'degraded',
      lastCheck: new Date().toISOString(),
      details: error instanceof Error ? error.message : 'Check failed',
    };
  }
}

async function getProcessingStats(): Promise<{
  parserSuccessRate: number;
  avgProcessingTime: number;
  errorsLast24h: number;
  jobsProcessed24h: number;
}> {
  try {
    // Use MD5 hash for unique job counting
    const result = await sql`
      SELECT
        COUNT(DISTINCT MD5(
          COALESCE(origin_province, '') || '|' ||
          COALESCE(destination_province, '') || '|' ||
          COALESCE(contact_phone, '') || '|' ||
          COALESCE(body_type, '') || '|' ||
          COALESCE(cargo_type, '')
        )) as total_jobs,
        COUNT(DISTINCT CASE WHEN origin_province IS NOT NULL THEN MD5(
          COALESCE(origin_province, '') || '|' ||
          COALESCE(destination_province, '') || '|' ||
          COALESCE(contact_phone, '') || '|' ||
          COALESCE(body_type, '') || '|' ||
          COALESCE(cargo_type, '')
        ) END) as has_origin
      FROM jobs
      WHERE created_at > NOW() - INTERVAL '24 hours'
    `;

    const data = result[0];
    const total = Number(data.total_jobs) || 1;
    const successRate = (Number(data.has_origin) / total) * 100;

    return {
      parserSuccessRate: Math.round(successRate),
      avgProcessingTime: 150, // Placeholder - would need Lambda metrics
      errorsLast24h: 0, // Placeholder
      jobsProcessed24h: total,
    };
  } catch {
    return {
      parserSuccessRate: 0,
      avgProcessingTime: 0,
      errorsLast24h: 0,
      jobsProcessed24h: 0,
    };
  }
}

async function getRecentActivity(): Promise<{
  hour: string;
  evolution: number;
  evolution2: number;
  kamyoon: number;
  yukbul: number;
}[]> {
  try {
    const result = await sql`
      SELECT
        TO_CHAR(j.created_at, 'HH24:00') as hour,
        COUNT(*) FILTER (WHERE j.source_group_jid NOT IN ('kamyoon-loads@g.us', 'yukbul-loads@g.us') AND (rm.instance_name IS NULL OR rm.instance_name = 'turkish-logistics')) as evolution,
        COUNT(*) FILTER (WHERE rm.instance_name = 'turkish-logistics-2') as evolution2,
        COUNT(*) FILTER (WHERE j.source_group_jid = 'kamyoon-loads@g.us') as kamyoon,
        COUNT(*) FILTER (WHERE j.source_group_jid = 'yukbul-loads@g.us') as yukbul
      FROM jobs j
      LEFT JOIN raw_messages rm ON j.message_id = rm.message_id
      WHERE j.created_at > NOW() - INTERVAL '12 hours'
      GROUP BY TO_CHAR(j.created_at, 'HH24:00')
      ORDER BY hour DESC
      LIMIT 12
    `;

    return result.map(r => ({
      hour: r.hour,
      evolution: Number(r.evolution),
      evolution2: Number(r.evolution2),
      kamyoon: Number(r.kamyoon),
      yukbul: Number(r.yukbul),
    }));
  } catch {
    return [];
  }
}

export async function GET() {
  try {
    const [database, evolution, evolution2, kamyoon, yukbul, openai, processingStats, recentActivity] = await Promise.all([
      checkDatabase(),
      checkEvolutionAPI(),
      checkEvolutionAPI2(),
      checkKamyoon(),
      checkYukbul(),
      checkOpenAI(),
      getProcessingStats(),
      getRecentActivity(),
    ]);

    // Calculate overall status (OpenAI excluded from critical path)
    const coreServices = [database, evolution, evolution2, kamyoon, yukbul];
    const services = [...coreServices, openai];
    const overallStatus = coreServices.every(s => s.status === 'operational')
      ? 'operational'
      : coreServices.some(s => s.status === 'down')
        ? 'down'
        : 'degraded';

    return NextResponse.json({
      status: overallStatus,
      timestamp: new Date().toISOString(),
      services,
      processing: processingStats,
      recentActivity,
    });
  } catch (error) {
    console.error('Health API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch health status' },
      { status: 500 }
    );
  }
}
