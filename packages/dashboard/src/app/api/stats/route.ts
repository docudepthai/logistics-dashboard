import { NextResponse } from 'next/server';
import postgres from 'postgres';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';

// Database connection
const sql = postgres(process.env.DATABASE_URL || '', {
  ssl: 'require',
  max: 1,
  idle_timeout: 20,
  connect_timeout: 10,
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
      // Overview stats - count unique jobs using MD5 hash of key fields
      sql`
        SELECT
          COUNT(DISTINCT MD5(
            COALESCE(origin_province, '') || '|' ||
            COALESCE(destination_province, '') || '|' ||
            COALESCE(contact_phone, '') || '|' ||
            COALESCE(body_type, '') || '|' ||
            COALESCE(cargo_type, '')
          )) as total_jobs,
          COUNT(DISTINCT sender_jid) as unique_senders,
          COUNT(DISTINCT source_group_jid) as unique_groups
        FROM jobs
        WHERE created_at > NOW() - INTERVAL '24 hours'
      `,

      // Jobs by source - unique jobs using MD5 hash
      sql`
        SELECT source, COUNT(*) as count FROM (
          SELECT DISTINCT
            CASE
              WHEN source_group_jid = 'kamyoon-loads@g.us' THEN 'kamyoon'
              WHEN source_group_jid = 'yukbul-loads@g.us' THEN 'yukbul'
              ELSE 'evolution'
            END as source,
            MD5(
              COALESCE(origin_province, '') || '|' ||
              COALESCE(destination_province, '') || '|' ||
              COALESCE(contact_phone, '') || '|' ||
              COALESCE(body_type, '') || '|' ||
              COALESCE(cargo_type, '')
            ) as job_hash
          FROM jobs
          WHERE created_at > NOW() - INTERVAL '24 hours'
        ) unique_jobs
        GROUP BY source
        ORDER BY count DESC
      `,

      // Hourly activity - simplified
      sql`
        SELECT TO_CHAR(created_at, 'HH24:00') as hour, COUNT(*) as count
        FROM jobs
        WHERE created_at > NOW() - INTERVAL '24 hours'
        GROUP BY 1
        ORDER BY 1
      `,

      // Top routes - simplified
      sql`
        SELECT origin_province as origin, destination_province as destination, COUNT(*) as count
        FROM jobs
        WHERE created_at > NOW() - INTERVAL '24 hours'
          AND origin_province IS NOT NULL
          AND destination_province IS NOT NULL
        GROUP BY origin_province, destination_province
        ORDER BY count DESC
        LIMIT 15
      `,

      // Body types - simplified
      sql`
        SELECT COALESCE(body_type, 'Not specified') as body_type, COUNT(*) as count
        FROM jobs
        WHERE created_at > NOW() - INTERVAL '24 hours'
        GROUP BY body_type
        ORDER BY count DESC
      `,

      // Cargo types - simplified
      sql`
        SELECT COALESCE(cargo_type, 'Not specified') as cargo_type, COUNT(*) as count
        FROM jobs
        WHERE created_at > NOW() - INTERVAL '24 hours'
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
    // Use FilterExpression to only count CONVERSATION records (not PROFILE, CALL_LIST, etc.)
    // and add a timeout to prevent blocking
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000); // 5 second timeout

    let count = 0;

    // Single scan with limit to prevent timeout
    const result = await docClient.send(
      new ScanCommand({
        TableName: process.env.CONVERSATIONS_TABLE || 'turkish-logistics-conversations',
        Select: 'COUNT',
        FilterExpression: 'sk = :sk',
        ExpressionAttributeValues: {
          ':sk': 'CONVERSATION',
        },
        // Limit the scan to prevent timeout - we'll get an approximate count
        Limit: 10000,
      })
    );

    clearTimeout(timeout);
    count = result.Count || 0;

    // If there's more data, just return what we have (approximate count)
    // This prevents timeouts on large tables
    return count;
  } catch (error) {
    console.error('DynamoDB error:', error);
    return 0;
  }
}
