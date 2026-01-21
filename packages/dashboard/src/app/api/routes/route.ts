import { NextResponse } from 'next/server';
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL || '', {
  ssl: 'require',
  max: 1,
  idle_timeout: 20,
});

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Turkish province coordinates (using ASCII names to match database)
const provinceCoords: Record<string, { lat: number; lng: number }> = {
  'Adana': { lat: 37.0, lng: 35.32 },
  'Adiyaman': { lat: 37.76, lng: 38.28 },
  'Afyonkarahisar': { lat: 38.74, lng: 30.54 },
  'Agri': { lat: 39.72, lng: 43.05 },
  'Aksaray': { lat: 38.37, lng: 34.03 },
  'Amasya': { lat: 40.65, lng: 35.83 },
  'Ankara': { lat: 39.93, lng: 32.86 },
  'Antalya': { lat: 36.88, lng: 30.70 },
  'Ardahan': { lat: 41.11, lng: 42.70 },
  'Artvin': { lat: 41.18, lng: 41.82 },
  'Aydin': { lat: 37.85, lng: 27.85 },
  'Balikesir': { lat: 39.65, lng: 27.89 },
  'Bartin': { lat: 41.64, lng: 32.34 },
  'Batman': { lat: 37.88, lng: 41.13 },
  'Bayburt': { lat: 40.26, lng: 40.23 },
  'Bilecik': { lat: 40.14, lng: 29.98 },
  'Bingol': { lat: 38.88, lng: 40.50 },
  'Bitlis': { lat: 38.40, lng: 42.11 },
  'Bolu': { lat: 40.73, lng: 31.61 },
  'Burdur': { lat: 37.72, lng: 30.29 },
  'Bursa': { lat: 40.19, lng: 29.06 },
  'Canakkale': { lat: 40.15, lng: 26.41 },
  'Cankiri': { lat: 40.60, lng: 33.62 },
  'Corum': { lat: 40.55, lng: 34.96 },
  'Denizli': { lat: 37.77, lng: 29.09 },
  'Diyarbakir': { lat: 37.91, lng: 40.24 },
  'Duzce': { lat: 40.84, lng: 31.16 },
  'Edirne': { lat: 41.68, lng: 26.56 },
  'Elazig': { lat: 38.67, lng: 39.22 },
  'Erzincan': { lat: 39.75, lng: 39.49 },
  'Erzurum': { lat: 39.90, lng: 41.27 },
  'Eskisehir': { lat: 39.78, lng: 30.52 },
  'Gaziantep': { lat: 37.07, lng: 37.38 },
  'Giresun': { lat: 40.91, lng: 38.39 },
  'Gumushane': { lat: 40.46, lng: 39.48 },
  'Hakkari': { lat: 37.58, lng: 43.74 },
  'Hatay': { lat: 36.20, lng: 36.16 },
  'Igdir': { lat: 39.92, lng: 44.05 },
  'Isparta': { lat: 37.76, lng: 30.55 },
  'Istanbul': { lat: 41.01, lng: 28.98 },
  'Izmir': { lat: 38.42, lng: 27.14 },
  'Kahramanmaras': { lat: 37.58, lng: 36.94 },
  'Karabuk': { lat: 41.20, lng: 32.62 },
  'Karaman': { lat: 37.18, lng: 33.23 },
  'Kars': { lat: 40.60, lng: 43.10 },
  'Kastamonu': { lat: 41.39, lng: 33.78 },
  'Kayseri': { lat: 38.73, lng: 35.48 },
  'Kirikkale': { lat: 39.85, lng: 33.51 },
  'Kirklareli': { lat: 41.73, lng: 27.22 },
  'Kirsehir': { lat: 39.15, lng: 34.16 },
  'Kilis': { lat: 36.72, lng: 37.12 },
  'Kocaeli': { lat: 40.85, lng: 29.88 },
  'Konya': { lat: 37.87, lng: 32.48 },
  'Kutahya': { lat: 39.42, lng: 29.98 },
  'Malatya': { lat: 38.35, lng: 38.31 },
  'Manisa': { lat: 38.61, lng: 27.43 },
  'Mardin': { lat: 37.31, lng: 40.73 },
  'Mersin': { lat: 36.80, lng: 34.64 },
  'Mugla': { lat: 37.21, lng: 28.36 },
  'Mus': { lat: 38.74, lng: 41.51 },
  'Nevsehir': { lat: 38.62, lng: 34.71 },
  'Nigde': { lat: 37.97, lng: 34.68 },
  'Ordu': { lat: 40.98, lng: 37.88 },
  'Osmaniye': { lat: 37.07, lng: 36.25 },
  'Rize': { lat: 41.02, lng: 40.52 },
  'Sakarya': { lat: 40.69, lng: 30.40 },
  'Samsun': { lat: 41.29, lng: 36.33 },
  'Sanliurfa': { lat: 37.16, lng: 38.79 },
  'Siirt': { lat: 37.93, lng: 41.94 },
  'Sinop': { lat: 42.03, lng: 35.15 },
  'Sivas': { lat: 39.75, lng: 37.02 },
  'Sirnak': { lat: 37.52, lng: 42.46 },
  'Tekirdag': { lat: 41.00, lng: 27.51 },
  'Tokat': { lat: 40.31, lng: 36.55 },
  'Trabzon': { lat: 41.00, lng: 39.73 },
  'Tunceli': { lat: 39.11, lng: 39.55 },
  'Usak': { lat: 38.67, lng: 29.41 },
  'Van': { lat: 38.49, lng: 43.38 },
  'Yalova': { lat: 40.65, lng: 29.28 },
  'Yozgat': { lat: 39.82, lng: 34.80 },
  'Zonguldak': { lat: 41.45, lng: 31.79 },
};

export async function GET() {
  try {
    // Get routes with counts - unique jobs only
    const routes = await sql`
      SELECT origin, destination, COUNT(*) as count FROM (
        SELECT DISTINCT
          origin_province as origin,
          destination_province as destination,
          COALESCE(vehicle_type, ''), COALESCE(body_type, ''), COALESCE(cargo_type, ''),
          COALESCE(weight::text, ''), COALESCE(contact_phone, ''),
          COALESCE(is_urgent::text, ''), COALESCE(is_refrigerated::text, '')
        FROM jobs
        WHERE
          created_at > NOW() - INTERVAL '24 hours'
          AND origin_province IS NOT NULL
          AND destination_province IS NOT NULL
      ) unique_jobs
      GROUP BY origin, destination
      ORDER BY count DESC
      LIMIT 50
    `;

    // Get province activity - unique jobs only
    const provinceActivity = await sql`
      SELECT
        province,
        SUM(origin_count) as origins,
        SUM(dest_count) as destinations
      FROM (
        SELECT origin_province as province, COUNT(*) as origin_count, 0 as dest_count
        FROM (
          SELECT DISTINCT origin_province,
            COALESCE(destination_province, ''), COALESCE(vehicle_type, ''), COALESCE(body_type, ''),
            COALESCE(cargo_type, ''), COALESCE(weight::text, ''), COALESCE(contact_phone, ''),
            COALESCE(is_urgent::text, ''), COALESCE(is_refrigerated::text, '')
          FROM jobs WHERE created_at > NOW() - INTERVAL '24 hours' AND origin_province IS NOT NULL
        ) uo
        GROUP BY origin_province
        UNION ALL
        SELECT destination_province as province, 0 as origin_count, COUNT(*) as dest_count
        FROM (
          SELECT DISTINCT destination_province,
            COALESCE(origin_province, ''), COALESCE(vehicle_type, ''), COALESCE(body_type, ''),
            COALESCE(cargo_type, ''), COALESCE(weight::text, ''), COALESCE(contact_phone, ''),
            COALESCE(is_urgent::text, ''), COALESCE(is_refrigerated::text, '')
          FROM jobs WHERE created_at > NOW() - INTERVAL '24 hours' AND destination_province IS NOT NULL
        ) ud
        GROUP BY destination_province
      ) combined
      GROUP BY province
      ORDER BY (SUM(origin_count) + SUM(dest_count)) DESC
    `;

    // Format routes with coordinates
    const formattedRoutes = routes
      .filter(r => provinceCoords[r.origin] && provinceCoords[r.destination])
      .map(r => ({
        origin: r.origin,
        destination: r.destination,
        count: Number(r.count),
        originCoords: provinceCoords[r.origin],
        destCoords: provinceCoords[r.destination],
      }));

    // Format province data
    const provinces = Object.entries(provinceCoords).map(([name, coords]) => {
      const activity = provinceActivity.find(p => p.province === name);
      return {
        name,
        coords,
        origins: Number(activity?.origins) || 0,
        destinations: Number(activity?.destinations) || 0,
        total: (Number(activity?.origins) || 0) + (Number(activity?.destinations) || 0),
      };
    });

    return NextResponse.json({
      routes: formattedRoutes,
      provinces,
      totalRoutes: routes.length,
    });
  } catch (error) {
    console.error('Routes API error:', error);
    return NextResponse.json({ error: 'Failed to fetch routes' }, { status: 500 });
  }
}
