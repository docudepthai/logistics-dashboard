/**
 * Tests for location extraction
 */

import { describe, it, expect } from 'vitest';
import { extractLocations, determineOriginDestination } from '../../extractors/location.js';

describe('extractLocations', () => {
  describe('Province Extraction', () => {
    it('should extract single province', () => {
      const locations = extractLocations('ANKARA TIR');
      expect(locations.length).toBeGreaterThan(0);
      expect(locations[0].provinceName).toBe('Ankara');
    });

    it('should extract province with Turkish characters', () => {
      const locations = extractLocations('İSTANBUL yük var');
      expect(locations.length).toBeGreaterThan(0);
      expect(locations[0].provinceName).toBe('Istanbul');
    });

    it('should extract multiple provinces', () => {
      const locations = extractLocations('KONYA - ANKARA - İSTANBUL');
      expect(locations.length).toBe(3);
      const names = locations.map(l => l.provinceName);
      expect(names).toContain('Konya');
      expect(names).toContain('Ankara');
      expect(names).toContain('Istanbul');
    });

    it('should handle province with slash notation', () => {
      const locations = extractLocations('MUĞLA/FETHİYE');
      const names = locations.map(l => l.provinceName);
      expect(names).toContain('Mugla');
    });

    it('should extract provinces separated by plus', () => {
      const locations = extractLocations('AYDIN+DENİZLİ TIR');
      const names = locations.map(l => l.provinceName);
      expect(names).toContain('Aydin');
      expect(names).toContain('Denizli');
    });
  });

  describe('District Extraction', () => {
    it('should extract known districts', () => {
      const locations = extractLocations('MANAVGAT KAMYON');
      expect(locations.length).toBeGreaterThan(0);
      expect(locations[0].districtName).toBe('Manavgat');
      expect(locations[0].provinceName).toBe('Antalya');
    });

    it('should extract Kemer district', () => {
      const locations = extractLocations('KEMER yükleme');
      expect(locations.length).toBeGreaterThan(0);
      expect(locations[0].provinceName).toBe('Antalya');
    });

    it('should extract Kas district', () => {
      const locations = extractLocations('ANTALYA KAŞ 13.60 TIR');
      const names = locations.map(l => l.provinceName);
      expect(names).toContain('Antalya');
    });
  });

  describe('Route Patterns', () => {
    it('should extract locations from arrow pattern', () => {
      const locations = extractLocations('İZMİR ➡️ ANKARA');
      const names = locations.map(l => l.provinceName);
      expect(names).toContain('Izmir');
      expect(names).toContain('Ankara');
    });

    it('should extract locations from dash pattern', () => {
      const locations = extractLocations('TRABZON - İSTANBUL');
      const names = locations.map(l => l.provinceName);
      expect(names).toContain('Trabzon');
      expect(names).toContain('Istanbul');
    });

    it('should extract locations from bidirectional arrow', () => {
      const locations = extractLocations('Nevşehir ↔️ iskenderun');
      const names = locations.map(l => l.provinceName);
      expect(names).toContain('Nevsehir');
      expect(names).toContain('Hatay');
    });

    it('should extract origin with DAN suffix', () => {
      const locations = extractLocations('BAFRADAN TRABZON');
      const names = locations.map(l => l.provinceName);
      expect(names).toContain('Trabzon');
    });

    it('should extract origin with DEN suffix', () => {
      const locations = extractLocations('İZMİR DEN AFYON');
      const names = locations.map(l => l.provinceName);
      expect(names).toContain('Izmir');
      expect(names).toContain('Afyonkarahisar');
    });
  });

  describe('Complex Messages', () => {
    it('should extract multiple locations from list format', () => {
      const message = `KONYA/SARAYÖNÜ+KARATAY        TIR
AYDIN+DENİZLİ                      TIR
MUĞLA/FETHİYE        TIR
ANKARA    TIR`;
      const locations = extractLocations(message);
      expect(locations.length).toBeGreaterThanOrEqual(4);
      const names = locations.map(l => l.provinceName);
      expect(names).toContain('Konya');
      expect(names).toContain('Aydin');
      expect(names).toContain('Denizli');
      expect(names).toContain('Mugla');
      expect(names).toContain('Ankara');
    });

    it('should extract from price list format', () => {
      const message = `Diyarbakır peşin       2000+
Antalya      6               900+
Erzurum.   1.        .... 2050+
Mardin.      1.             1850+`;
      const locations = extractLocations(message);
      const names = locations.map(l => l.provinceName);
      expect(names).toContain('Diyarbakir');
      expect(names).toContain('Antalya');
      expect(names).toContain('Erzurum');
      expect(names).toContain('Mardin');
    });
  });
});

describe('determineOriginDestination', () => {
  it('should use first location as origin, last as destination', () => {
    const locations = extractLocations('İSTANBUL - ANKARA - İZMİR');
    const { origin, destination } = determineOriginDestination(locations, 'İSTANBUL - ANKARA - İZMİR');
    expect(origin?.provinceName).toBe('Istanbul');
    expect(destination?.provinceName).toBe('Izmir');
  });

  it('should detect origin from DAN/DEN suffix', () => {
    const text = 'İZMİR DEN AFYON';
    const locations = extractLocations(text);
    const { origin } = determineOriginDestination(locations, text);
    expect(origin?.provinceName).toBe('Izmir');
  });

  it('should handle single location as origin', () => {
    const locations = extractLocations('ANKARA yük var');
    const { origin, destination } = determineOriginDestination(locations, 'ANKARA yük var');
    expect(origin?.provinceName).toBe('Ankara');
    expect(destination).toBeUndefined();
  });

  it('should handle arrow notation', () => {
    const text = 'BAFRADAN ➡️➡️ TRABZON';
    const locations = extractLocations(text);
    const { destination } = determineOriginDestination(locations, text);
    expect(destination?.provinceName).toBe('Trabzon');
  });
});
