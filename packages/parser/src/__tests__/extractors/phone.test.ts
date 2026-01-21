/**
 * Tests for phone number extraction
 *
 * Note: Phone normalization returns format: 05XXXXXXXXX (local format)
 */

import { describe, it, expect } from 'vitest';
import { extractPhoneNumbers, extractPrimaryPhone } from '../../extractors/phone.js';

describe('extractPhoneNumbers', () => {
  describe('Standard Formats', () => {
    it('should extract phone with spaces', () => {
      const phones = extractPhoneNumbers('☎ 0507 142 9907');
      expect(phones.length).toBe(1);
      expect(phones[0].normalized).toBe('05071429907');
    });

    it('should extract continuous phone number', () => {
      const phones = extractPhoneNumbers('05325809828');
      expect(phones.length).toBe(1);
      expect(phones[0].normalized).toBe('05325809828');
    });

    it('should extract phone with dashes', () => {
      const phones = extractPhoneNumbers('0533-480-89-40');
      expect(phones.length).toBe(1);
      expect(phones[0].normalized).toBe('05334808940');
    });

    it('should extract phone with dots', () => {
      const phones = extractPhoneNumbers('0533.480.89.40');
      expect(phones.length).toBe(1);
      expect(phones[0].normalized).toBe('05334808940');
    });
  });

  describe('Multiple Phone Numbers', () => {
    it('should extract multiple phones from message', () => {
      const message = `MEGA FRİGO
05425922879
05324547862`;
      const phones = extractPhoneNumbers(message);
      expect(phones.length).toBe(2);
      expect(phones.map(p => p.normalized)).toContain('05425922879');
      expect(phones.map(p => p.normalized)).toContain('05324547862');
    });
  });

  describe('Phone with Context', () => {
    it('should extract phone after contact name', () => {
      const phones = extractPhoneNumbers('0536 771 8431 yasemin');
      expect(phones.length).toBe(1);
      expect(phones[0].normalized).toBe('05367718431');
    });

    it('should extract phone from message', () => {
      const phones = extractPhoneNumbers('0533 524 47 45');
      expect(phones.length).toBe(1);
      expect(phones[0].normalized).toBe('05335244745');
    });
  });

  describe('Edge Cases', () => {
    it('should not extract numbers that are not phone numbers', () => {
      const phones = extractPhoneNumbers('Ağırlık : 0-21 TON');
      expect(phones.length).toBe(0);
    });

    it('should not extract short numbers as phone numbers', () => {
      const phones = extractPhoneNumbers('Antalya 6 900+');
      expect(phones.length).toBe(0);
    });

    it('should handle emojis around phone numbers', () => {
      const phones = extractPhoneNumbers('☎️ 0533 480 89 40 ☎️');
      expect(phones.length).toBe(1);
      expect(phones[0].normalized).toBe('05334808940');
    });

    it('should preserve original format', () => {
      const phones = extractPhoneNumbers('0507 142 9907');
      expect(phones.length).toBe(1);
      expect(phones[0].original).toBe('0507 142 9907');
    });
  });

  describe('Masked Phone Numbers', () => {
    it('should detect masked phone with xx', () => {
      const phones = extractPhoneNumbers('05xx xxx xx xx');
      expect(phones.length).toBe(1);
      expect(phones[0].isMasked).toBe(true);
    });
  });

  describe('Country Code', () => {
    it('should normalize +90 prefix', () => {
      const phones = extractPhoneNumbers('+90 532 123 45 67');
      expect(phones.length).toBe(1);
      expect(phones[0].normalized).toBe('05321234567');
    });
  });
});

describe('extractPrimaryPhone', () => {
  it('should return first phone number', () => {
    const message = `0536 771 8431 yasemin
Biga kaygısız loj`;
    const phone = extractPrimaryPhone(message);
    expect(phone?.normalized).toBe('05367718431');
  });

  it('should return undefined when no phones', () => {
    const phone = extractPrimaryPhone('Merhaba nasılsın');
    expect(phone).toBeUndefined();
  });

  it('should return first of multiple phones', () => {
    const message = `05425922879
05324547862`;
    const phone = extractPrimaryPhone(message);
    expect(phone?.normalized).toBe('05425922879');
  });
});
