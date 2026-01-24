import { NextResponse } from 'next/server';
import postgres from 'postgres';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';

// Database connection
const sql = postgres(process.env.DATABASE_URL || '', {
  ssl: 'require',
  max: 1,
  idle_timeout: 20,
});

// DynamoDB client
const dynamoClient = new DynamoDBClient({
  region: process.env.REGION || 'eu-central-1',
  credentials: process.env.MY_AWS_ACCESS_KEY_ID ? {
    accessKeyId: process.env.MY_AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.MY_AWS_SECRET_ACCESS_KEY || '',
  } : undefined,
});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    // Parallel queries for better performance
    const [
      overviewResult,
      sourcesResult,
      hourlyResult,
      topRoutesResult,
      bodyTypesResult,
      cargoTypesResult,
      conversationsCount,
    ] = await Promise.all([
      // Overview stats - count unique jobs (deduplicated)
      sql`
        SELECT
          (SELECT COUNT(*) FROM (
            SELECT DISTINCT
              COALESCE(origin_province, ''), COALESCE(destination_province, ''),
              COALESCE(vehicle_type, ''), COALESCE(body_type, ''), COALESCE(cargo_type, ''),
              COALESCE(weight::text, ''), COALESCE(contact_phone, ''),
              COALESCE(is_urgent::text, ''), COALESCE(is_refrigerated::text, '')
            FROM jobs WHERE created_at > NOW() - INTERVAL '24 hours'
          ) u) as total_jobs,
          (SELECT COUNT(*) FROM raw_messages) as total_messages,
          (SELECT COUNT(DISTINCT sender_jid) FROM jobs WHERE created_at > NOW() - INTERVAL '24 hours') as unique_senders,
          (SELECT COUNT(DISTINCT source_group_jid) FROM jobs WHERE created_at > NOW() - INTERVAL '24 hours') as unique_groups
      `,

      // Jobs by source - unique jobs, attributed to first source seen
      // Now distinguishes between Evolution instances (turkish-logistics vs turkish-logistics-2)
      sql`
        SELECT source, COUNT(*) as count FROM (
          SELECT
            CASE
              WHEN MIN(j.source_group_jid) = 'kamyoon-loads@g.us' THEN 'kamyoon'
              WHEN MIN(j.source_group_jid) = 'yukbul-loads@g.us' THEN 'yukbul'
              WHEN MIN(rm.instance_name) = 'turkish-logistics-2' THEN 'evolution-2'
              ELSE 'evolution'
            END as source
          FROM jobs j
          LEFT JOIN raw_messages rm ON j.message_id = rm.message_id
          WHERE j.created_at > NOW() - INTERVAL '24 hours'
          GROUP BY
            COALESCE(j.origin_province, ''), COALESCE(j.destination_province, ''),
            COALESCE(j.vehicle_type, ''), COALESCE(j.body_type, ''), COALESCE(j.cargo_type, ''),
            COALESCE(j.weight::text, ''), COALESCE(j.contact_phone, ''),
            COALESCE(j.is_urgent::text, ''), COALESCE(j.is_refrigerated::text, '')
        ) unique_jobs
        GROUP BY source
        ORDER BY count DESC
      `,

      // Hourly activity - unique jobs only
      sql`
        SELECT hour, COUNT(*) as count FROM (
          SELECT DISTINCT
            TO_CHAR(created_at, 'HH24:00') as hour,
            COALESCE(origin_province, ''), COALESCE(destination_province, ''),
            COALESCE(vehicle_type, ''), COALESCE(body_type, ''), COALESCE(cargo_type, ''),
            COALESCE(weight::text, ''), COALESCE(contact_phone, ''),
            COALESCE(is_urgent::text, ''), COALESCE(is_refrigerated::text, '')
          FROM jobs
          WHERE created_at > NOW() - INTERVAL '24 hours'
        ) unique_jobs
        GROUP BY hour
        ORDER BY hour
      `,

      // Top routes - count unique jobs per route
      sql`
        SELECT origin, destination, COUNT(*) as count FROM (
          SELECT DISTINCT
            COALESCE(origin_province, '') as origin,
            COALESCE(destination_province, '') as destination,
            COALESCE(vehicle_type, ''), COALESCE(body_type, ''), COALESCE(cargo_type, ''),
            COALESCE(weight::text, ''), COALESCE(contact_phone, ''),
            COALESCE(is_urgent::text, ''), COALESCE(is_refrigerated::text, '')
          FROM jobs
          WHERE created_at > NOW() - INTERVAL '24 hours'
        ) unique_jobs
        GROUP BY origin, destination
        ORDER BY count DESC
        LIMIT 15
      `,

      // Body types - unique jobs only
      sql`
        SELECT body_type, COUNT(*) as count FROM (
          SELECT DISTINCT
            COALESCE(body_type, 'Not specified') as body_type,
            COALESCE(origin_province, ''), COALESCE(destination_province, ''),
            COALESCE(vehicle_type, ''), COALESCE(cargo_type, ''),
            COALESCE(weight::text, ''), COALESCE(contact_phone, ''),
            COALESCE(is_urgent::text, ''), COALESCE(is_refrigerated::text, '')
          FROM jobs
          WHERE created_at > NOW() - INTERVAL '24 hours'
        ) unique_jobs
        GROUP BY body_type
        ORDER BY count DESC
      `,

      // Cargo types - unique jobs only
      sql`
        SELECT cargo_type, COUNT(*) as count FROM (
          SELECT DISTINCT
            COALESCE(cargo_type, 'Not specified') as cargo_type,
            COALESCE(origin_province, ''), COALESCE(destination_province, ''),
            COALESCE(vehicle_type, ''), COALESCE(body_type, ''),
            COALESCE(weight::text, ''), COALESCE(contact_phone, ''),
            COALESCE(is_urgent::text, ''), COALESCE(is_refrigerated::text, '')
          FROM jobs
          WHERE created_at > NOW() - INTERVAL '24 hours'
        ) unique_jobs
        GROUP BY cargo_type
        ORDER BY count DESC
      `,

      // DynamoDB conversations count
      getConversationsCount(),
    ]);

    // Fill in missing hours
    const hourlyMap = new Map(hourlyResult.map(h => [h.hour, Number(h.count)]));
    const hourly = [];
    for (let i = 0; i < 24; i++) {
      const hour = i.toString().padStart(2, '0') + ':00';
      hourly.push({ hour, count: hourlyMap.get(hour) || 0 });
    }

    return NextResponse.json({
      overview: {
        totalJobs: Number(overviewResult[0]?.total_jobs || 0),
        totalMessages: Number(overviewResult[0]?.total_messages || 0),
        uniqueSenders24h: Number(overviewResult[0]?.unique_senders || 0),
        uniqueGroups: Number(overviewResult[0]?.unique_groups || 0),
        conversations: conversationsCount,
      },
      sources: sourcesResult.map(s => ({
        source: s.source,
        count: Number(s.count),
      })),
      hourly,
      topRoutes: topRoutesResult.map(r => ({
        origin: r.origin || 'Unknown',
        destination: r.destination,
        count: Number(r.count),
      })),
      bodyTypes: bodyTypesResult.map(b => ({
        bodyType: b.body_type,
        count: Number(b.count),
      })),
      cargoTypes: cargoTypesResult.map(c => ({
        cargoType: c.cargo_type,
        count: Number(c.count),
      })),
    });
  } catch (error) {
    console.error('Stats API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}

async function getConversationsCount(): Promise<number> {
  try {
    const result = await docClient.send(
      new ScanCommand({
        TableName: process.env.CONVERSATIONS_TABLE || 'turkish-logistics-conversations',
        Select: 'COUNT',
      })
    );
    return result.Count || 0;
  } catch (error) {
    console.error('DynamoDB error:', error);
    return 0;
  }
}
