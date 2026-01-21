// Provinces
export type { Province, TurkishRegion } from './provinces.js';
export {
  PROVINCES,
  PROVINCE_BY_NAME,
  PROVINCE_BY_CODE,
  PROVINCE_NAMES,
  getProvinceByName,
  getProvinceByCode,
  isProvinceName,
} from './provinces.js';

// Districts
export type { District } from './districts.js';
export {
  DISTRICTS,
  DISTRICTS_BY_NAME,
  DISTRICT_NAMES,
  AMBIGUOUS_DISTRICT_NAMES,
  getDistrictsByName,
  getDistrictByName,
  isDistrictName,
  isAmbiguousDistrict,
  getDistrictsByProvinceCode,
} from './districts.js';

// Vehicles
export type { VehicleType, BodyType } from './vehicles.js';
export {
  VEHICLE_TYPES,
  BODY_TYPES,
  VEHICLE_TYPE_PATTERNS,
  BODY_TYPE_PATTERNS,
  getVehicleTypeByPattern,
  getBodyTypeByPattern,
} from './vehicles.js';
