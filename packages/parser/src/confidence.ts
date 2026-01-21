/**
 * Confidence scoring for parsed logistics messages.
 */

import type {
  ParsedMessage,
  ConfidenceLevel,
} from '@turkish-logistics/shared';

/**
 * Confidence weights for different parsed fields
 */
const CONFIDENCE_WEIGHTS = {
  origin: 0.25,
  destination: 0.25,
  vehicleType: 0.15,
  phone: 0.15,
  weight: 0.05,
  contactName: 0.05,
  cargoType: 0.05,
  bodyType: 0.05,

  // Bonus factors
  routeComplete: 0.10, // Bonus for having both origin and destination
  completeContact: 0.05, // Bonus for phone + name
};

/**
 * Calculate confidence score and level for a parsed message
 */
export function calculateConfidence(parsed: ParsedMessage): {
  score: number;
  level: ConfidenceLevel;
  factors: Record<string, number>;
} {
  const factors: Record<string, number> = {};
  let score = 0;

  // Core location factors
  if (parsed.origin) {
    factors.origin = CONFIDENCE_WEIGHTS.origin;
    score += CONFIDENCE_WEIGHTS.origin;
  }

  if (parsed.destination) {
    factors.destination = CONFIDENCE_WEIGHTS.destination;
    score += CONFIDENCE_WEIGHTS.destination;
  }

  // Bonus for complete route
  if (parsed.origin && parsed.destination) {
    factors.routeComplete = CONFIDENCE_WEIGHTS.routeComplete;
    score += CONFIDENCE_WEIGHTS.routeComplete;
  }

  // Vehicle factors
  if (parsed.vehicle?.vehicleType) {
    factors.vehicleType = CONFIDENCE_WEIGHTS.vehicleType;
    score += CONFIDENCE_WEIGHTS.vehicleType;
  }

  if (parsed.vehicle?.bodyType) {
    factors.bodyType = CONFIDENCE_WEIGHTS.bodyType;
    score += CONFIDENCE_WEIGHTS.bodyType;
  }

  // Contact factors
  if (parsed.phones.length > 0) {
    factors.phone = CONFIDENCE_WEIGHTS.phone;
    score += CONFIDENCE_WEIGHTS.phone;
  }

  if (parsed.contact) {
    factors.contactName = CONFIDENCE_WEIGHTS.contactName;
    score += CONFIDENCE_WEIGHTS.contactName;
  }

  // Complete contact bonus
  if (parsed.phones.length > 0 && parsed.contact) {
    factors.completeContact = CONFIDENCE_WEIGHTS.completeContact;
    score += CONFIDENCE_WEIGHTS.completeContact;
  }

  // Cargo details
  if (parsed.weight) {
    factors.weight = CONFIDENCE_WEIGHTS.weight;
    score += CONFIDENCE_WEIGHTS.weight;
  }

  if (parsed.cargoType) {
    factors.cargoType = CONFIDENCE_WEIGHTS.cargoType;
    score += CONFIDENCE_WEIGHTS.cargoType;
  }

  // Determine confidence level
  const level = determineConfidenceLevel(score, factors);

  return {
    score: Math.min(score, 1.0),
    level,
    factors,
  };
}

/**
 * Determine confidence level based on score and factors
 */
function determineConfidenceLevel(
  score: number,
  factors: Record<string, number>
): ConfidenceLevel {
  // HIGH: origin + destination + (vehicle type OR phone)
  if (
    factors.origin &&
    factors.destination &&
    (factors.vehicleType || factors.phone)
  ) {
    return 'HIGH';
  }

  // HIGH: score >= 0.7
  if (score >= 0.7) {
    return 'HIGH';
  }

  // MEDIUM: origin + destination only
  if (factors.origin && factors.destination) {
    return 'MEDIUM';
  }

  // MEDIUM: vehicle + one location
  if (factors.vehicleType && (factors.origin || factors.destination)) {
    return 'MEDIUM';
  }

  // MEDIUM: score >= 0.4
  if (score >= 0.4) {
    return 'MEDIUM';
  }

  // LOW: only phone or single location
  if (factors.phone || factors.origin || factors.destination) {
    return 'LOW';
  }

  return 'VERY_LOW';
}
