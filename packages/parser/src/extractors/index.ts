// Location extraction
export {
  extractLocations,
  determineOriginDestination,
  extractAllRoutes,
  type ExtractedRoute,
} from './location.js';

// Vehicle extraction
export {
  extractVehicle,
  isVehicleWanted,
  isVehicleAvailable,
} from './vehicle.js';

// Phone extraction
export { extractPhoneNumbers, extractPrimaryPhone } from './phone.js';

// Weight extraction
export { extractWeight } from './weight.js';

// Contact extraction
export { extractContact } from './contact.js';

// Urgency extraction
export { extractUrgency } from './urgency.js';

// Cargo extraction
export { extractCargoType, hasCargoAvailable } from './cargo.js';

// Load type extraction (FTL/LTL)
export { extractLoadType, type LoadType, type ParsedLoadType } from './loadType.js';
