/**
 * Generate training data for Patron Parser model
 * Input: raw WhatsApp messages
 * Output: Structured job extractions
 */

import { Pool } from 'pg';
import * as fs from 'fs';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

interface Job {
  origin_province: string | null;
  origin_district: string | null;
  destination_province: string | null;
  destination_district: string | null;
  weight: number | null;
  weight_unit: string | null;
  vehicle_type: string | null;
  body_type: string | null;
  cargo_type: string | null;
  contact_phone: string | null;
  is_refrigerated: boolean;
  is_urgent: boolean;
}

interface TrainingExample {
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
}

const SYSTEM_PROMPT = `Sen bir lojistik mesaj ayrıştırıcısısın. WhatsApp grup mesajlarından yük ilanlarını çıkarıyorsun.

Her mesajda birden fazla yük olabilir. Her yük için JSON döndür.

Çıkarılacak alanlar:
- origin: Yükleme şehri/ilçesi
- destination: Teslim şehri/ilçesi
- weight: Tonaj (varsa)
- weight_unit: ton/kg
- vehicle_type: tır/kamyon/kamyonet/doblo
- body_type: açık/kapalı/tenteli
- cargo_type: Yük tipi
- phone: Telefon numarası
- is_refrigerated: Soğuk zincir mi
- is_urgent: Acil mi

SADECE JSON array döndür, başka bir şey yazma.`;

async function generateTrainingData() {
  const client = await pool.connect();

  try {
    // Get messages with their extracted jobs
    const result = await client.query(`
      WITH message_jobs AS (
        SELECT
          rm.message_id,
          rm.content as raw_text,
          json_agg(json_build_object(
            'origin', COALESCE(j.origin_district, j.origin_province),
            'destination', COALESCE(j.destination_district, j.destination_province),
            'weight', j.weight,
            'weight_unit', j.weight_unit,
            'vehicle_type', j.vehicle_type,
            'body_type', j.body_type,
            'cargo_type', j.cargo_type,
            'phone', j.contact_phone,
            'is_refrigerated', j.is_refrigerated,
            'is_urgent', j.is_urgent
          ) ORDER BY j.created_at) as jobs
        FROM raw_messages rm
        JOIN jobs j ON j.message_id LIKE rm.message_id || '%'
        WHERE rm.content IS NOT NULL
          AND LENGTH(rm.content) > 20
          AND j.origin_province IS NOT NULL
          AND j.destination_province IS NOT NULL
        GROUP BY rm.message_id, rm.content
      )
      SELECT raw_text, jobs, json_array_length(jobs) as job_count
      FROM message_jobs
      WHERE json_array_length(jobs) >= 1
      ORDER BY RANDOM()
      LIMIT 10000
    `);

    console.log(`Found ${result.rows.length} training examples`);

    const trainingData: TrainingExample[] = [];
    const stats = { single: 0, multi: 0 };

    for (const row of result.rows) {
      const rawText = row.raw_text;
      const jobs = row.jobs;

      // Clean up jobs - remove null values
      const cleanedJobs = jobs.map((job: any) => {
        const cleaned: any = {};
        for (const [key, value] of Object.entries(job)) {
          if (value !== null && value !== undefined && value !== '') {
            cleaned[key] = value;
          }
        }
        return cleaned;
      }).filter((job: any) => job.origin && job.destination);

      if (cleanedJobs.length === 0) continue;

      const example: TrainingExample = {
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: rawText },
          { role: 'assistant', content: JSON.stringify(cleanedJobs, null, 0) }
        ]
      };

      trainingData.push(example);

      if (cleanedJobs.length === 1) stats.single++;
      else stats.multi++;
    }

    // Write to JSONL file
    const outputPath = '/Users/caglarbinici/Whatsapp_Aggregator_Bot/atlas/training/parser-training.jsonl';
    const jsonlContent = trainingData.map(ex => JSON.stringify(ex)).join('\n');
    fs.writeFileSync(outputPath, jsonlContent);

    console.log(`\n=== Training Data Generated ===`);
    console.log(`Total examples: ${trainingData.length}`);
    console.log(`Single-job messages: ${stats.single}`);
    console.log(`Multi-job messages: ${stats.multi}`);
    console.log(`Output: ${outputPath}`);

    // Also create a validation split (10%)
    const shuffled = trainingData.sort(() => Math.random() - 0.5);
    const splitIdx = Math.floor(shuffled.length * 0.9);
    const train = shuffled.slice(0, splitIdx);
    const val = shuffled.slice(splitIdx);

    fs.writeFileSync(
      '/Users/caglarbinici/Whatsapp_Aggregator_Bot/atlas/training/parser-train.jsonl',
      train.map(ex => JSON.stringify(ex)).join('\n')
    );
    fs.writeFileSync(
      '/Users/caglarbinici/Whatsapp_Aggregator_Bot/atlas/training/parser-val.jsonl',
      val.map(ex => JSON.stringify(ex)).join('\n')
    );

    console.log(`\nSplit: ${train.length} train / ${val.length} validation`);

  } finally {
    client.release();
  }

  await pool.end();
}

generateTrainingData().catch(console.error);
