import { parseLocationsFromMessage } from '../packages/agent/src/location-parser';

const tests = [
  "istanbul ankara",
  "istanbuldan ankaraya",
  "nevşehir hatay",
  "istanbul içi",
  "izmir ici yuk",
  "antalyadan izmire",
  "konya izmir bursa",
  "karadeniz bolgesi",
  "güneydoğuya",
  "ankaradan ist",
  "kocaeliden izmire yük var mı",
  // Vehicle type tests (NEW!)
  "ankara kamyonet",
  "istanbul izmir tır",
  "13 60 bursa istanbul",
  "kayseri marmara bolgesi 6 teker kamyonet",
  "çıkış ankara panelvan",
  "10 teker kapalı için",
  "istanbul izmir tenteli",
  "damperli kamyon ankara",
  "panel araç için istanbul",
  "frigorifik izmir antalya",
];

console.log("Testing local location parser:");
console.log("==============================\n");

for (const msg of tests) {
  const result = parseLocationsFromMessage(msg);
  console.log(`"${msg}"`);
  console.log(`  origin: ${result.origin || "null"} | dest: ${result.destination || "null"}`);
  if (result.vehicleType) console.log(`  vehicleType: ${result.vehicleType}`);
  if (result.bodyType) console.log(`  bodyType: ${result.bodyType}`);
  if (result.sameProvinceSearch) console.log(`  sameProvinceSearch: true`);
  if (result.destinations && result.destinations.length > 1) console.log(`  destinations: ${result.destinations.join(", ")}`);
  if (result.destinationRegion) console.log(`  destinationRegion: ${result.destinationRegion}`);
  console.log("");
}
