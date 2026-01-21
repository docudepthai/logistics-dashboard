// Turkish text normalization
export {
  normalizeToAscii,
  stripSuffix,
  normalizeLocationName,
  hasOriginSuffix,
  hasDestinationSuffix,
  extractDirectionIndicators,
} from './turkish.js';

// Phone number utilities
export type { PhoneMatch } from './phone.js';
export {
  extractPhoneNumbers,
  normalizePhoneNumber,
  formatPhoneNumber,
  isValidTurkishMobile,
  maskPhoneNumber,
  maskPhoneNumbersInText,
} from './phone.js';
