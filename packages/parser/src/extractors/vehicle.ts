/**
 * Vehicle type extraction from Turkish logistics messages.
 */

import {
  normalizeToAscii,
  VEHICLE_TYPES,
  BODY_TYPES,
  type ParsedVehicle,
} from '@turkish-logistics/shared';

/**
 * Extract vehicle information from text
 */
export function extractVehicle(text: string): ParsedVehicle | null {
  const normalizedText = normalizeToAscii(text);
  const lowerText = normalizedText.toLowerCase();

  let vehicleType: string | undefined;
  let bodyType: string | undefined;
  let isRefrigerated = false;
  const matchedParts: string[] = [];

  // Find vehicle type
  for (const vehicle of VEHICLE_TYPES) {
    for (const pattern of vehicle.patterns) {
      const normalizedPattern = normalizeToAscii(pattern).toLowerCase();
      if (lowerText.includes(normalizedPattern)) {
        vehicleType = vehicle.key;
        matchedParts.push(pattern);
        break;
      }
    }
    if (vehicleType) break;
  }

  // Find body type
  for (const body of BODY_TYPES) {
    for (const pattern of body.patterns) {
      const normalizedPattern = normalizeToAscii(pattern).toLowerCase();
      if (lowerText.includes(normalizedPattern)) {
        bodyType = body.key;
        isRefrigerated = body.isRefrigerated;
        matchedParts.push(pattern);
        break;
      }
    }
    if (bodyType) break;
  }

  // If neither found, return null
  if (!vehicleType && !bodyType) {
    return null;
  }

  return {
    vehicleType,
    bodyType,
    originalText: matchedParts.join(' '),
    isRefrigerated,
  };
}

/**
 * Check if the message is looking for a vehicle
 */
export function isVehicleWanted(text: string): boolean {
  const normalizedText = normalizeToAscii(text).toLowerCase();
  const wantedPatterns = [
    'araniyor',
    'aranıyor',
    'lazim',
    'lazım',
    'gerek',
    'gerekli',
    'istiyorum',
    'isteniyor',
    'bulmak',
    'bulunuyor',
    'ihtiyaci',
    'ihtiyacı',
    'ihtiyac var',
    'ihtiyaç var',
  ];

  return wantedPatterns.some((pattern) =>
    normalizedText.includes(normalizeToAscii(pattern))
  );
}

/**
 * Check if a vehicle is available
 */
export function isVehicleAvailable(text: string): boolean {
  const normalizedText = normalizeToAscii(text).toLowerCase();
  const availablePatterns = [
    'bos arac',
    'boş araç',
    'bos tir',
    'boş tır',
    'bos kamyon',
    'boş kamyon',
    'musait',
    'müsait',
    'uygun',
    'mevcut',
  ];

  return availablePatterns.some((pattern) =>
    normalizedText.includes(normalizeToAscii(pattern))
  );
}
