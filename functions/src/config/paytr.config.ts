import { defineSecret } from 'firebase-functions/params';

// Define secrets for PayTR credentials
export const PAYTR_MERCHANT_ID = defineSecret('PAYTR_MERCHANT_ID');
export const PAYTR_MERCHANT_KEY = defineSecret('PAYTR_MERCHANT_KEY');
export const PAYTR_MERCHANT_SALT = defineSecret('PAYTR_MERCHANT_SALT');

export const getPayTRConfig = () => {
  // Check if running in Firebase Emulator
  const isDevelopment = process.env.FUNCTIONS_EMULATOR === 'true';

  // Log environment for debugging
  console.log('PayTR Config Environment:', {
    FUNCTIONS_EMULATOR: process.env.FUNCTIONS_EMULATOR,
    PAYTR_TEST_MODE: process.env.PAYTR_TEST_MODE,
    isDevelopment,
    FORCED_MODE: 'PRODUCTION (0)'
  });

  if (isDevelopment) {
    console.log('Using PayTR PRODUCTION mode (forced to 0) in emulator environment');
    return {
      merchant_id: process.env.PAYTR_MERCHANT_ID || 'TEST_MERCHANT_ID',
      merchant_key: process.env.PAYTR_MERCHANT_KEY || 'TEST_KEY',
      merchant_salt: process.env.PAYTR_MERCHANT_SALT || 'TEST_SALT',
      test_mode: '0'  // ⚠️ FORCED TO PRODUCTION MODE
    };
  }

  // Production uses Secret Manager
  // ⚠️ ALWAYS FORCE PRODUCTION MODE regardless of environment variables
  console.log('Using PayTR PRODUCTION mode (forced to 0) in deployed environment');

  return {
    merchant_id: PAYTR_MERCHANT_ID.value(),
    merchant_key: PAYTR_MERCHANT_KEY.value(),
    merchant_salt: PAYTR_MERCHANT_SALT.value(),
    test_mode: '0'  // ⚠️ FORCED TO PRODUCTION MODE
  };
};