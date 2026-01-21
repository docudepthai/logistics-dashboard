// Messages
export {
  rawMessages,
  type RawMessageInsert,
  type RawMessageSelect,
} from './messages.js';

// Jobs
export { jobs, type JobInsert, type JobSelect } from './jobs.js';

// Source Groups
export {
  sourceGroups,
  type SourceGroupInsert,
  type SourceGroupSelect,
} from './source-groups.js';

// Reference tables
export {
  provinces,
  districts,
  type ProvinceInsert,
  type ProvinceSelect,
  type DistrictInsert,
  type DistrictSelect,
} from './reference.js';

// Contacts
export {
  contacts,
  type ContactInsert,
  type ContactSelect,
} from './contacts.js';

// Processing logs
export {
  processingLogs,
  processingStatusEnum,
  type ProcessingLogInsert,
  type ProcessingLogSelect,
} from './processing-logs.js';
