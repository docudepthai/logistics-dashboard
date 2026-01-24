/**
 * Turkish logistics vehicle types and body types.
 */

export interface VehicleType {
  /** Unique identifier */
  key: string;
  /** Display name */
  name: string;
  /** All patterns to match (normalized) */
  patterns: string[];
  /** Description */
  description: string;
}

export interface BodyType {
  /** Unique identifier */
  key: string;
  /** Display name */
  name: string;
  /** All patterns to match (normalized) */
  patterns: string[];
  /** Description */
  description: string;
  /** Is this refrigerated */
  isRefrigerated: boolean;
}

/**
 * Main vehicle types used in Turkish logistics
 */
export const VEHICLE_TYPES: VehicleType[] = [
  {
    key: 'TIR',
    name: 'TIR',
    patterns: ['tir', 'tirci', 'tırci', 'tır', '40 ayak', '45 ayak', '40ayak', '45ayak'],
    description: 'Large semi-trailer truck (international road transport)',
  },
  {
    key: 'KAMYON',
    name: 'Kamyon',
    patterns: ['kamyon', 'kamyoncu'],
    description: 'Standard truck',
  },
  {
    key: 'KAMYONET',
    name: 'Kamyonet',
    patterns: ['kamyonet', 'kamyonetci'],
    description: 'Small truck/van',
  },
  {
    key: 'TREYLER',
    name: 'Treyler',
    patterns: ['treyler', 'trailer'],
    description: 'Trailer',
  },
  {
    key: 'DORSE',
    name: 'Dorse',
    patterns: ['dorse', 'dorseci'],
    description: 'Semi-trailer',
  },
  {
    key: 'TANKER',
    name: 'Tanker',
    patterns: ['tanker', 'tankerci'],
    description: 'Tanker truck',
  },
  {
    key: 'LOWBED',
    name: 'Lowbed',
    patterns: ['lowbed', 'low bed', 'low-bed', 'alçak'],
    description: 'Low-bed trailer (for heavy machinery)',
  },
  {
    key: 'MEGA',
    name: 'Mega',
    patterns: ['mega', 'mega tir', 'mega dorse'],
    description: 'Mega trailer (100m3 capacity)',
  },
  {
    key: 'JUMBO',
    name: 'Jumbo',
    patterns: ['jumbo', 'jumbo tir'],
    description: 'Jumbo trailer (extra-large)',
  },
  {
    key: 'KONTEYNER',
    name: 'Konteyner',
    patterns: ['konteyner', 'container', 'kontainer'],
    description: 'Container carrier',
  },
];

/**
 * Body/cargo types used in Turkish logistics
 */
export const BODY_TYPES: BodyType[] = [
  {
    key: 'TENTELI',
    name: 'Tenteli',
    patterns: ['tenteli', 'tente', 'tenteli tir', 'tenteli kamyon'],
    description: 'Tarpaulin/curtainside cover',
    isRefrigerated: false,
  },
  {
    key: 'ACIK_KASA',
    name: 'Acik Kasa',
    patterns: ['acik kasa', 'acık kasa', 'acik', 'açık', 'acik tir', 'açık tır'],
    description: 'Open/flatbed truck',
    isRefrigerated: false,
  },
  {
    key: 'KAPALI_KASA',
    name: 'Kapali Kasa',
    patterns: ['kapali kasa', 'kapalı kasa', 'kapali', 'kapalı'],
    description: 'Closed box truck',
    isRefrigerated: false,
  },
  {
    key: 'FRIGO',
    name: 'Frigo',
    patterns: [
      'frigo',
      'frigorifik',
      'termokin',
      'termokinli',
      'sogutuculu',
      'soğutuculu',
      'sogutmali',
      'soğutmalı',
      'soguk',
      'soğuk',
      'frigolu',
    ],
    description: 'Refrigerated truck',
    isRefrigerated: true,
  },
  {
    key: 'IZOLELI',
    name: 'Izoleli',
    patterns: ['izoleli', 'izole', 'izotermal'],
    description: 'Insulated (not actively cooled)',
    isRefrigerated: false,
  },
  {
    key: 'SAC_KASA',
    name: 'Sac Kasa',
    patterns: ['sac kasa', 'saç kasa', 'sac kasali', 'saç kasalı'],
    description: 'Sheet metal body',
    isRefrigerated: false,
  },
  {
    key: 'DAMPERLI',
    name: 'Damperli',
    patterns: ['damperli', 'damper', 'damperli kamyon'],
    description: 'Dump truck/tipper',
    isRefrigerated: false,
  },
  {
    key: 'PLATFORM',
    name: 'Platform',
    patterns: ['platform', 'platform dorse', 'platformlu'],
    description: 'Platform/flatbed trailer',
    isRefrigerated: false,
  },
];

/**
 * Build lookup maps for fast matching
 */
export const VEHICLE_TYPE_PATTERNS: Map<string, VehicleType> = new Map();
export const BODY_TYPE_PATTERNS: Map<string, BodyType> = new Map();

for (const vehicleType of VEHICLE_TYPES) {
  for (const pattern of vehicleType.patterns) {
    VEHICLE_TYPE_PATTERNS.set(pattern.toLowerCase(), vehicleType);
  }
}

for (const bodyType of BODY_TYPES) {
  for (const pattern of bodyType.patterns) {
    BODY_TYPE_PATTERNS.set(pattern.toLowerCase(), bodyType);
  }
}

/**
 * Get vehicle type by pattern
 */
export function getVehicleTypeByPattern(pattern: string): VehicleType | undefined {
  return VEHICLE_TYPE_PATTERNS.get(pattern.toLowerCase());
}

/**
 * Get body type by pattern
 */
export function getBodyTypeByPattern(pattern: string): BodyType | undefined {
  return BODY_TYPE_PATTERNS.get(pattern.toLowerCase());
}
