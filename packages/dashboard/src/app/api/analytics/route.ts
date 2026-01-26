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

// MD5 hash for job uniqueness - faster than DISTINCT with many columns
const JOB_HASH = `MD5(
  COALESCE(origin_province, '') || '|' ||
  COALESCE(destination_province, '') || '|' ||
  COALESCE(contact_phone, '') || '|' ||
  COALESCE(body_type, '') || '|' ||
  COALESCE(cargo_type, '')
)`;

export async function GET() {
  try {
    const [
      dailyTrends,
      parserMetrics,
      topOrigins,
      topDestinations,
      peakHours,
      weeklyComparison,
    ] = await Promise.all([
      // Daily trends (last 7 days) - unique jobs using MD5 hash
      sql`
        SELECT
          DATE(created_at) as date,
          COUNT(DISTINCT MD5(
            COALESCE(origin_province, '') || '|' ||
            COALESCE(destination_province, '') || '|' ||
            COALESCE(contact_phone, '') || '|' ||
            COALESCE(body_type, '') || '|' ||
            COALESCE(cargo_type, '')
          )) as jobs,
          COUNT(DISTINCT sender_jid) as senders
        FROM jobs
        WHERE created_at > NOW() - INTERVAL '7 days'
        GROUP BY DATE(created_at)
        ORDER BY date
      `,

      // Parser success metrics - simplified
      sql`
        SELECT
          COUNT(DISTINCT MD5(
            COALESCE(origin_province, '') || '|' ||
            COALESCE(destination_province, '') || '|' ||
            COALESCE(contact_phone, '') || '|' ||
            COALESCE(body_type, '') || '|' ||
            COALESCE(cargo_type, '')
          )) as total,
          COUNT(DISTINCT CASE WHEN origin_province IS NOT NULL AND origin_province != '' THEN MD5(
            COALESCE(origin_province, '') || '|' ||
            COALESCE(destination_province, '') || '|' ||
            COALESCE(contact_phone, '') || '|' ||
            COALESCE(body_type, '') || '|' ||
            COALESCE(cargo_type, '')
          ) END) as with_origin,
          COUNT(DISTINCT CASE WHEN destination_province IS NOT NULL AND destination_province != '' THEN MD5(
            COALESCE(origin_province, '') || '|' ||
            COALESCE(destination_province, '') || '|' ||
            COALESCE(contact_phone, '') || '|' ||
            COALESCE(body_type, '') || '|' ||
            COALESCE(cargo_type, '')
          ) END) as with_destination,
          COUNT(DISTINCT CASE WHEN contact_phone IS NOT NULL AND contact_phone != '' THEN MD5(
            COALESCE(origin_province, '') || '|' ||
            COALESCE(destination_province, '') || '|' ||
            COALESCE(contact_phone, '') || '|' ||
            COALESCE(body_type, '') || '|' ||
            COALESCE(cargo_type, '')
          ) END) as with_phone,
          COUNT(DISTINCT CASE WHEN body_type IS NOT NULL AND body_type != '' THEN MD5(
            COALESCE(origin_province, '') || '|' ||
            COALESCE(destination_province, '') || '|' ||
            COALESCE(contact_phone, '') || '|' ||
            COALESCE(body_type, '') || '|' ||
            COALESCE(cargo_type, '')
          ) END) as with_body_type,
          ROUND(AVG(confidence_score)::numeric, 2) as avg_confidence
        FROM jobs
        WHERE created_at > NOW() - INTERVAL '24 hours'
      `,

      // Top origins - simplified
      sql`
        SELECT origin_province as province, COUNT(*) as count
        FROM jobs
        WHERE created_at > NOW() - INTERVAL '24 hours' AND origin_province IS NOT NULL
        GROUP BY origin_province
        ORDER BY count DESC
        LIMIT 10
      `,

      // Top destinations - simplified
      sql`
        SELECT destination_province as province, COUNT(*) as count
        FROM jobs
        WHERE created_at > NOW() - INTERVAL '24 hours' AND destination_province IS NOT NULL
        GROUP BY destination_province
        ORDER BY count DESC
        LIMIT 10
      `,

      // Peak hours analysis - simplified
      sql`
        SELECT
          EXTRACT(HOUR FROM created_at)::int as hour,
          COUNT(DISTINCT MD5(
            COALESCE(origin_province, '') || '|' ||
            COALESCE(destination_province, '') || '|' ||
            COALESCE(contact_phone, '') || '|' ||
            COALESCE(body_type, '') || '|' ||
            COALESCE(cargo_type, '')
          )) as count
        FROM jobs
        WHERE created_at > NOW() - INTERVAL '7 days'
        GROUP BY EXTRACT(HOUR FROM created_at)::int
        ORDER BY hour
      `,

      // This week vs last week - simplified
      sql`
        SELECT
          CASE
            WHEN created_at > NOW() - INTERVAL '7 days' THEN 'this_week'
            ELSE 'last_week'
          END as period,
          COUNT(DISTINCT MD5(
            COALESCE(origin_province, '') || '|' ||
            COALESCE(destination_province, '') || '|' ||
            COALESCE(contact_phone, '') || '|' ||
            COALESCE(body_type, '') || '|' ||
            COALESCE(cargo_type, '')
          )) as jobs
        FROM jobs
        WHERE created_at > NOW() - INTERVAL '14 days'
        GROUP BY 1
      `,
    ]);

    // Calculate parser success rates
    const parser = parserMetrics[0];
    const total = Number(parser?.total) || 1;
    const parserStats = {
      originRate: Math.round((Number(parser?.with_origin) / total) * 100),
      destinationRate: Math.round((Number(parser?.with_destination) / total) * 100),
      phoneRate: Math.round((Number(parser?.with_phone) / total) * 100),
      bodyTypeRate: Math.round((Number(parser?.with_body_type) / total) * 100),
      avgConfidence: Number(parser?.avg_confidence) || 0,
    };

    // Calculate week over week change
    const thisWeek = Number(weeklyComparison.find(w => w.period === 'this_week')?.jobs) || 0;
    const lastWeek = Number(weeklyComparison.find(w => w.period === 'last_week')?.jobs) || 1;
    const weekChange = Math.round(((thisWeek - lastWeek) / lastWeek) * 100);

    return NextResponse.json({
      dailyTrends: dailyTrends.map(d => ({
        date: d.date,
        jobs: Number(d.jobs),
        senders: Number(d.senders),
      })),
      parserStats,
      topOrigins: topOrigins.map(o => ({ province: o.province, count: Number(o.count) })),
      topDestinations: topDestinations.map(d => ({ province: d.province, count: Number(d.count) })),
      peakHours: Array.from({ length: 24 }, (_, i) => ({
        hour: i,
        count: Number(peakHours.find(p => Number(p.hour) === i)?.count) || 0,
      })),
      weekChange,
      thisWeekTotal: thisWeek,
    });
  } catch (error) {
    console.error('Analytics API error:', error);
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 });
  }
}
