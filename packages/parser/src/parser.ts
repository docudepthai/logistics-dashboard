/**
 * Main parser for Turkish logistics messages.
 */

import {
  createEmptyParsedMessage,
  type ParsedMessage,
  type MessageType,
} from '@turkish-logistics/shared';

import {
  extractLocations,
  determineOriginDestination,
  extractVehicle,
  isVehicleWanted,
  isVehicleAvailable,
  extractPhoneNumbers,
  extractWeight,
  extractContact,
  extractUrgency,
  extractCargoType,
  hasCargoAvailable,
  extractLoadType,
} from './extractors/index.js';

import { calculateConfidence } from './confidence.js';

/**
 * Parse a Turkish logistics message and extract structured data.
 *
 * @example
 * const result = parse("ANTALYA - ISTANBUL TIR ARANIYOR 05xx xxx xx xx");
 * console.log(result.origin?.provinceName); // "Antalya"
 * console.log(result.destination?.provinceName); // "Istanbul"
 * console.log(result.vehicle?.vehicleType); // "TIR"
 */
export function parse(message: string): ParsedMessage {
  // Initialize empty result
  const result = createEmptyParsedMessage(message);

  // Skip empty messages
  if (!message || message.trim().length === 0) {
    result.warnings.push('Empty message');
    return result;
  }

  // Extract locations
  const locations = extractLocations(message);
  result.mentionedLocations = locations;

  // Determine origin and destination
  const { origin, destination } = determineOriginDestination(
    locations,
    message
  );
  result.origin = origin;
  result.destination = destination;

  // Extract vehicle information
  const vehicle = extractVehicle(message);
  if (vehicle) {
    result.vehicle = vehicle;
  }

  // Extract phone numbers
  result.phones = extractPhoneNumbers(message);

  // Extract weight
  const weight = extractWeight(message);
  if (weight) {
    result.weight = weight;
  }

  // Extract contact
  const contact = extractContact(message);
  if (contact) {
    result.contact = contact;
  }

  // Extract urgency
  const urgency = extractUrgency(message);
  result.isUrgent = urgency.isUrgent;
  result.urgencyIndicators = urgency.indicators;

  // Extract cargo type
  const cargoType = extractCargoType(message);
  if (cargoType) {
    result.cargoType = cargoType;
  }

  // Extract load type (FTL/LTL)
  const loadTypeResult = extractLoadType(message);
  if (loadTypeResult) {
    result.loadType = loadTypeResult.loadType;
  }

  // Determine message type
  result.messageType = determineMessageType(message);

  // Calculate confidence
  const confidence = calculateConfidence(result);
  result.confidenceScore = confidence.score;
  result.confidenceLevel = confidence.level;
  result.confidenceFactors = confidence.factors;

  return result;
}

/**
 * Determine the type of logistics message
 */
function determineMessageType(text: string): MessageType {
  // Check for vehicle wanted
  if (isVehicleWanted(text)) {
    return 'VEHICLE_WANTED';
  }

  // Check for vehicle available
  if (isVehicleAvailable(text)) {
    return 'VEHICLE_AVAILABLE';
  }

  // Check for cargo available
  if (hasCargoAvailable(text)) {
    return 'CARGO_AVAILABLE';
  }

  return 'UNKNOWN';
}

/**
 * Parse multiple messages
 */
export function parseMany(messages: string[]): ParsedMessage[] {
  return messages.map(parse);
}

/**
 * Quick check if a message is likely a logistics message
 */
export function isLikelyLogisticsMessage(text: string): boolean {
  const result = parse(text);

  // Consider it a logistics message if:
  // - Has at least one location
  // - OR has a vehicle type
  // - OR has a phone number
  return (
    result.mentionedLocations.length > 0 ||
    result.vehicle !== undefined ||
    result.phones.length > 0
  );
}
