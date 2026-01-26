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
      // Daily trends (last 7 days) - unique jobs only
      sql`
        SELECT date, COUNT(*) as jobs, COUNT(DISTINCT sender_jid) as senders
        FROM (
          SELECT DISTINCT
            DATE(created_at) as date,
            sender_jid,
            COALESCE(origin_province, ''), COALESCE(destination_province, ''),
            COALESCE(vehicle_type, ''), COALESCE(body_type, ''), COALESCE(cargo_type, ''),
            COALESCE(weight::text, ''), COALESCE(contact_phone, ''),
            COALESCE(is_urgent::text, ''), COALESCE(is_refrigerated::text, '')
          FROM jobs
          WHERE created_at > NOW() - INTERVAL '7 days'
        ) unique_jobs
        GROUP BY date
        ORDER BY date
      `,

      // Parser success metrics - unique jobs only
      sql`
        SELECT
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE origin_province IS NOT NULL AND origin_province != '') as with_origin,
          COUNT(*) FILTER (WHERE destination_province IS NOT NULL AND destination_province != '') as with_destination,
          COUNT(*) FILTER (WHERE contact_phone IS NOT NULL AND contact_phone != '') as with_phone,
          COUNT(*) FILTER (WHERE body_type IS NOT NULL AND body_type != '') as with_body_type,
          ROUND(AVG(confidence_score)::numeric, 2) as avg_confidence
        FROM (
          SELECT DISTINCT
            COALESCE(origin_province, '') as origin_province,
            COALESCE(destination_province, '') as destination_province,
            COALESCE(vehicle_type, ''), COALESCE(body_type, '') as body_type,
            COALESCE(cargo_type, ''), COALESCE(weight::text, ''),
            COALESCE(contact_phone, '') as contact_phone,
            COALESCE(is_urgent::text, ''), COALESCE(is_refrigerated::text, ''),
            confidence_score
          FROM jobs
          WHERE created_at > NOW() - INTERVAL '24 hours'
        ) unique_jobs
      `,

      // Top origins - unique jobs only
      sql`
        SELECT origin_province as province, COUNT(*) as count
        FROM (
          SELECT DISTINCT origin_province,
            COALESCE(destination_province, ''), COALESCE(vehicle_type, ''), COALESCE(body_type, ''),
            COALESCE(cargo_type, ''), COALESCE(weight::text, ''), COALESCE(contact_phone, ''),
            COALESCE(is_urgent::text, ''), COALESCE(is_refrigerated::text, '')
          FROM jobs
          WHERE created_at > NOW() - INTERVAL '24 hours' AND origin_province IS NOT NULL
        ) u
        GROUP BY origin_province
        ORDER BY count DESC
        LIMIT 10
      `,

      // Top destinations - unique jobs only
      sql`
        SELECT destination_province as province, COUNT(*) as count
        FROM (
          SELECT DISTINCT destination_province,
            COALESCE(origin_province, ''), COALESCE(vehicle_type, ''), COALESCE(body_type, ''),
            COALESCE(cargo_type, ''), COALESCE(weight::text, ''), COALESCE(contact_phone, ''),
            COALESCE(is_urgent::text, ''), COALESCE(is_refrigerated::text, '')
          FROM jobs
          WHERE created_at > NOW() - INTERVAL '24 hours' AND destination_province IS NOT NULL
        ) u
        GROUP BY destination_province
        ORDER BY count DESC
        LIMIT 10
      `,

      // Peak hours analysis - unique jobs only
      sql`
        SELECT hour, COUNT(*) as count FROM (
          SELECT DISTINCT
            EXTRACT(HOUR FROM created_at)::int as hour,
            COALESCE(origin_province, ''), COALESCE(destination_province, ''),
            COALESCE(vehicle_type, ''), COALESCE(body_type, ''), COALESCE(cargo_type, ''),
            COALESCE(weight::text, ''), COALESCE(contact_phone, ''),
            COALESCE(is_urgent::text, ''), COALESCE(is_refrigerated::text, '')
          FROM jobs
          WHERE created_at > NOW() - INTERVAL '7 days'
        ) unique_jobs
        GROUP BY hour
        ORDER BY hour
      `,

      // This week vs last week - unique jobs only
      sql`
        SELECT period, COUNT(*) as jobs FROM (
          SELECT DISTINCT
            CASE
              WHEN created_at > NOW() - INTERVAL '7 days' THEN 'this_week'
              ELSE 'last_week'
            END as period,
            COALESCE(origin_province, ''), COALESCE(destination_province, ''),
            COALESCE(vehicle_type, ''), COALESCE(body_type, ''), COALESCE(cargo_type, ''),
            COALESCE(weight::text, ''), COALESCE(contact_phone, ''),
            COALESCE(is_urgent::text, ''), COALESCE(is_refrigerated::text, '')
          FROM jobs
          WHERE created_at > NOW() - INTERVAL '14 days'
        ) unique_jobs
        GROUP BY period
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
