// Main parser
export { parse, parseMany, isLikelyLogisticsMessage } from './parser.js';

// AI-powered parser
export { parseWithAI, isAIParsingAvailable } from './ai-parser.js';

// Confidence scoring
export { calculateConfidence } from './confidence.js';

// Individual extractors (for advanced usage)
export {
  extractLocations,
  determineOriginDestination,
  extractAllRoutes,
  type ExtractedRoute,
  extractVehicle,
  isVehicleWanted,
  isVehicleAvailable,
  extractPhoneNumbers,
  extractPrimaryPhone,
  extractWeight,
  extractContact,
  extractUrgency,
  extractCargoType,
  hasCargoAvailable,
} from './extractors/index.js';
