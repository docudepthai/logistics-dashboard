/**
 * Cargo type extraction from Turkish logistics messages.
 */

import { normalizeToAscii } from '@turkish-logistics/shared';

/**
 * Common cargo types in Turkish logistics
 */
const CARGO_TYPES = [
  // Pallets - check early (common in logistics)
  { key: 'palet', patterns: ['palet', 'paletli'] },

  // Machinery - check before construction (ekipman is specific)
  { key: 'makine', patterns: ['makine', 'makina', 'ekipman', 'is makinesi', 'iş makinesi'] },

  // Textiles - check before kum (kumaş contains kum)
  { key: 'tekstil', patterns: ['tekstil', 'kumas', 'kumaş', 'giyim', 'konfeksiyon'] },

  // General goods
  { key: 'parsiyel', patterns: ['parsiyel', 'parsek', 'parça'] },
  { key: 'komple', patterns: ['komple', 'full', 'tam'] },

  // Food & Agriculture
  { key: 'gida', patterns: ['gida', 'gıda', 'yiyecek'] },
  { key: 'meyve', patterns: ['meyve', 'sebze', 'meyve-sebze'] },
  { key: 'tahil', patterns: ['tahil', 'tahıl', 'bugday', 'buğday', 'arpa', 'misir', 'mısır'] },
  { key: 'pamuk', patterns: ['pamuk'] },

  // Construction - check after more specific types
  { key: 'demir', patterns: ['demir', 'celik', 'çelik', 'profil', 'boru'] },
  { key: 'cimento', patterns: ['cimento', 'çimento', 'beton'] },
  { key: 'mermer', patterns: ['mermer', 'granit'] },
  { key: 'kum', patterns: ['kum', 'cakil', 'çakıl', 'agrega'] },
  { key: 'insaat', patterns: ['insaat', 'inşaat', 'yapi', 'yapı'] },

  // Furniture & Household
  { key: 'mobilya', patterns: ['mobilya', 'esya', 'eşya', 'ev esyasi'] },
  { key: 'beyaz_esya', patterns: ['beyaz esya', 'beyaz eşya', 'elektrikli'] },

  // Automotive
  { key: 'otomotiv', patterns: ['otomotiv', 'yedek parca', 'yedek parça'] },

  // Chemicals & Liquids
  { key: 'kimyasal', patterns: ['kimyasal', 'kimya', 'asit'] },
  { key: 'sivi', patterns: ['sivi', 'sıvı', 'tank'] },

  // Electronics
  { key: 'elektronik', patterns: ['elektronik', 'elektrik', 'kablo'] },

  // Containers
  { key: 'konteyner', patterns: ['konteyner', 'container', '20\'', '40\'', '20 feet', '40 feet', 'hc'] },
];

/**
 * Extract cargo type from text
 */
export function extractCargoType(text: string): string | undefined {
  const normalizedText = normalizeToAscii(text).toLowerCase();

  for (const cargo of CARGO_TYPES) {
    for (const pattern of cargo.patterns) {
      const normalizedPattern = normalizeToAscii(pattern).toLowerCase();
      if (normalizedText.includes(normalizedPattern)) {
        return cargo.key;
      }
    }
  }

  return undefined;
}

/**
 * Check if message mentions cargo availability
 */
export function hasCargoAvailable(text: string): boolean {
  const normalizedText = normalizeToAscii(text).toLowerCase();
  const availablePatterns = [
    'yuk var',
    'yük var',
    'yukumuz var',
    'yükümüz var',
    'yukleme',
    'yükleme',
    'yuklenecek',
    'yüklenecek',
    'hazir yuk',
    'hazır yük',
  ];

  return availablePatterns.some((pattern) =>
    normalizedText.includes(normalizeToAscii(pattern))
  );
}
