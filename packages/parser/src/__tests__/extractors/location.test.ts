/**
 * Tests for location extraction
 */

import { describe, it, expect } from 'vitest';
import { extractLocations, determineOriginDestination, extractAllRoutes } from '../../extractors/location.js';

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

describe('Bug Fixes - Plate Code False Positives', () => {
  it('should NOT extract plate code 67 (Zonguldak) from phone number ending', () => {
    const message = `ÇATALCA YÜKLER
İZMİT ALİKAHYA OSB
6 PALET//2200 KG
0 541 281 09 67`;
    const locations = extractLocations(message);
    const names = locations.map(l => l.provinceName);
    // Should have Çatalca (Istanbul) and İzmit (Kocaeli), but NOT Zonguldak (67)
    expect(names).not.toContain('Zonguldak');
  });

  it('should NOT extract plate code 72 (Batman) from phone number +90 543 977 72 96', () => {
    const message = `🚛 YÜKLEME LİSTESİ
(Çıkış:AYDIN)
🏁 ORDU
📞 İletişim: +90 543 977 72 96 -TAYFUN`;
    const locations = extractLocations(message);
    const names = locations.map(l => l.provinceName);
    // Should have Aydin and Ordu, but NOT Batman (72)
    expect(names).not.toContain('Batman');
  });

  it('should NOT extract plate code 10 (Balikesir) from "10 TEKER"', () => {
    const message = `ADANA_ANKARA HAFİF KAPALI TIR
ADANA_İSTlYEŞİLKÖY HAFİF KAPALI 10 TEKER
0553 390 99 21`;
    const locations = extractLocations(message);
    const names = locations.map(l => l.provinceName);
    // Should have Adana and Ankara, but NOT Balikesir (10)
    expect(names).not.toContain('Balikesir');
  });

  it('should NOT extract plate code 40 (Kirsehir) from phone context', () => {
    const message = `BURSA ALAADDİNBEY - HADIMKÖY
6 PALET 3100 KG
0 531 399 23 23`;
    const locations = extractLocations(message);
    const names = locations.map(l => l.provinceName);
    // Should NOT have Kirsehir (40) from phone number
    expect(names).not.toContain('Kirsehir');
  });
});

describe('Bug Fix - Hadımköy District', () => {
  it('should resolve Hadımköy to Istanbul', () => {
    const locations = extractLocations('BURSA - HADIMKÖY');
    const names = locations.map(l => l.provinceName);
    expect(names).toContain('Bursa');
    expect(names).toContain('Istanbul');
  });

  it('should extract Hadımköy as Istanbul district', () => {
    const locations = extractLocations('HADIMKÖY yükleme');
    expect(locations.length).toBeGreaterThan(0);
    expect(locations[0].provinceName).toBe('Istanbul');
    expect(locations[0].districtName).toBe('Hadımköy');
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

describe('extractAllRoutes', () => {
  describe('Standard Route Patterns', () => {
    it('should extract routes from arrow notation', () => {
      const routes = extractAllRoutes('KAYSERI > ISTANBUL TIR');
      expect(routes.length).toBeGreaterThan(0);
      expect(routes[0].origin).toBe('Kayseri');
      expect(routes[0].destination).toBe('Istanbul');
    });

    it('should extract multiple routes from multi-line message', () => {
      const message = `Kayseri > Çanakkale tır
Kayseri > Bursa tır
Kayseri > hatay tır`;
      const routes = extractAllRoutes(message);
      expect(routes.length).toBe(3);
      const destinations = routes.map(r => r.destination);
      expect(destinations).toContain('Canakkale');
      expect(destinations).toContain('Bursa');
      expect(destinations).toContain('Hatay');
    });

    it('should extract routes from emoji arrow notation', () => {
      const routes = extractAllRoutes('İzmir➡İstanbul Ataşehir');
      expect(routes.length).toBeGreaterThan(0);
      expect(routes[0].origin).toBe('Izmir');
      expect(routes[0].destination).toBe('Istanbul');
    });
  });

  describe('YÜKLER Header Pattern', () => {
    it('should extract routes from YÜKLER header format', () => {
      const message = `*ÇORLU YÜKLER*
ELAZIĞ TIR
BAŞAKŞEHİR TIR
TUZLA TIR`;
      const routes = extractAllRoutes(message);
      // Origin should be Çorlu (Tekirdag), destinations should be listed cities
      expect(routes.length).toBeGreaterThan(0);
      // All routes should have same origin from header
      const origins = [...new Set(routes.map(r => r.origin))];
      expect(origins).toContain('Tekirdag'); // Çorlu is in Tekirdag
    });

    it('should handle multiple YÜKLER sections', () => {
      const message = `*ÇORLU YÜKLER*
ELAZIĞ TIR

*GEBZE YÜKLER*
KONYA TIR
TRABZON TIR`;
      const routes = extractAllRoutes(message);
      expect(routes.length).toBeGreaterThan(0);
    });
  });

  describe('Çıkış Format Pattern', () => {
    it('should extract routes from (Çıkış:CITY) format with 🏁 destination', () => {
      const message = `🚛 *YÜKLEME LİSTESİ
(Çıkış:AYDIN)
🏁 ORDU`;
      const routes = extractAllRoutes(message);
      expect(routes.length).toBeGreaterThan(0);
      expect(routes[0].origin).toBe('Aydin');
      expect(routes[0].destination).toBe('Ordu');
    });

    it('should handle Çıkış format without 🏁 marker', () => {
      const message = `(Çıkış:ANKARA) TRABZON`;
      const routes = extractAllRoutes(message);
      expect(routes.length).toBeGreaterThan(0);
      expect(routes[0].origin).toBe('Ankara');
      expect(routes[0].destination).toBe('Trabzon');
    });
  });
});
