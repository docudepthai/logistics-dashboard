/**
 * Tests for vehicle extraction
 */

import { describe, it, expect } from 'vitest';
import { extractVehicle, isVehicleWanted, isVehicleAvailable } from '../../extractors/vehicle.js';

describe('extractVehicle', () => {
  describe('TIR Detection', () => {
    it('should detect TIR', () => {
      const vehicle = extractVehicle('ANKARA TIR');
      expect(vehicle?.vehicleType).toBe('TIR');
    });

    it('should detect TIR with Turkish character', () => {
      const vehicle = extractVehicle('ANKARA TIR yükleme');
      expect(vehicle?.vehicleType).toBe('TIR');
    });

    it('should detect TIR in sentence', () => {
      const vehicle = extractVehicle('5 tır.         1950+');
      expect(vehicle?.vehicleType).toBe('TIR');
    });
  });

  describe('KAMYON Detection', () => {
    it('should detect KAMYON', () => {
      const vehicle = extractVehicle('MANAVGAT KAMYON');
      expect(vehicle?.vehicleType).toBe('KAMYON');
    });

    it('should detect kamyon lowercase', () => {
      const vehicle = extractVehicle('kamyon lazım');
      expect(vehicle?.vehicleType).toBe('KAMYON');
    });
  });

  describe('Body Types', () => {
    it('should detect tenteli (tarpaulin)', () => {
      const vehicle = extractVehicle('13.60 açık tenteli');
      expect(vehicle?.bodyType).toBeDefined();
    });

    it('should detect frigo (refrigerated)', () => {
      const vehicle = extractVehicle('FRİGO TIR İHTİYACI VARDIR');
      expect(vehicle?.vehicleType).toBe('TIR');
      expect(vehicle?.isRefrigerated).toBe(true);
    });

    it('should detect termokinli (refrigerated)', () => {
      const vehicle = extractVehicle('TERMOKİNLİ TIR');
      expect(vehicle?.vehicleType).toBe('TIR');
      expect(vehicle?.isRefrigerated).toBe(true);
    });

    it('should detect MEGA FRİGO', () => {
      const vehicle = extractVehicle('MEGA FRİGO');
      expect(vehicle?.isRefrigerated).toBe(true);
    });

    it('should detect açık kasa (open body)', () => {
      const vehicle = extractVehicle('Araç Tipi : 13/60 Açık Kasa');
      expect(vehicle?.bodyType).toBeDefined();
    });
  });

  describe('Dimensions', () => {
    it('should handle 13.60 dimension mentions', () => {
      // The parser should still extract vehicle type even with dimension
      const vehicle = extractVehicle('ANTALYA KAŞ 13.60 TIR');
      expect(vehicle?.vehicleType).toBe('TIR');
    });
  });

  describe('No Vehicle', () => {
    it('should return null for no vehicle text', () => {
      const vehicle = extractVehicle('Merhaba nasılsın');
      expect(vehicle).toBeNull();
    });
  });
});

describe('isVehicleWanted', () => {
  it('should detect aranıyor pattern', () => {
    expect(isVehicleWanted('TIR aranıyor')).toBe(true);
  });

  it('should detect lazım pattern', () => {
    expect(isVehicleWanted('Kamyon lazım')).toBe(true);
  });

  it('should detect ihtiyacı pattern', () => {
    expect(isVehicleWanted('FRİGO TIR İHTİYACI VARDIR')).toBe(true);
  });

  it('should detect KISA DORSE İHTİYACI VARDIR', () => {
    expect(isVehicleWanted('KISA DORSE İHTİYACI VARDIR')).toBe(true);
  });

  it('should return false for cargo messages', () => {
    expect(isVehicleWanted('İSTANBUL yük var')).toBe(false);
  });
});

describe('isVehicleAvailable', () => {
  it('should detect boş araç pattern', () => {
    expect(isVehicleAvailable('boş araç var')).toBe(true);
  });

  it('should detect müsait pattern', () => {
    expect(isVehicleAvailable('TIR müsait')).toBe(true);
  });

  it('should detect uygun pattern', () => {
    expect(isVehicleAvailable('Kamyon uygun')).toBe(true);
  });

  it('should return false for cargo wanted messages', () => {
    expect(isVehicleAvailable('TIR aranıyor')).toBe(false);
  });
});
