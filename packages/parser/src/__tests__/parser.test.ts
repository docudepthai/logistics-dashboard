/**
 * Comprehensive tests for the Turkish logistics message parser.
 * Based on real-world message samples.
 */

import { describe, it, expect } from 'vitest';
import { parse, isLikelyLogisticsMessage } from '../parser.js';

describe('parse', () => {
  describe('Antalya Organize Yükleme Messages', () => {
    const antalyaMessage = `Antalya / Organize / Ankutsan(Paletli Karton) Yüklemeleri
ISG  malzemeleri (yelek,ayakkabi) ZORUNLUDUR.

KONYA/SARAYÖNÜ+KARATAY        TIR
KARACULA+KUMLUOVA        TIR
EĞİRDİR+GELENDOST        TIR
GAZİPAŞA+MERSİN/TARSUS    TIR
AYDIN+DENİZLİ                      TIR
MUĞLA/KARADERE        TIR
ISPARTA/GELENDOST        TIR
MUĞLA/FETHİYE        TIR
KINIK        TIR
ÇORUM    TIR
EĞİRDİR    TIR
ANKARA    TIR
DEMRE        TIR

//////////////////////////////////////////

KEMER+KUMLUCA        KAMYON
KUMLUCA        KAMYON
MANAVGAT        KAMYON

☎ 0507 142 9907
BU İŞLERİ NAKLİYE UYGULAMALARINDA PAYLAŞMAYIN
PAYLAŞANLAR HAKKINDA SUÇ DUYURUSUNDA BULUNULACAKTIR`;

    it('should detect as logistics message', () => {
      expect(isLikelyLogisticsMessage(antalyaMessage)).toBe(true);
    });

    it('should extract phone number', () => {
      const result = parse(antalyaMessage);
      expect(result.phones.length).toBeGreaterThan(0);
      expect(result.phones[0].normalized).toBe('05071429907');
    });

    it('should extract Antalya as origin', () => {
      const result = parse(antalyaMessage);
      expect(result.origin?.provinceName).toBe('Antalya');
    });

    it('should extract multiple destination locations', () => {
      const result = parse(antalyaMessage);
      expect(result.mentionedLocations.length).toBeGreaterThan(5);

      const provinceNames = result.mentionedLocations.map(l => l.provinceName);
      expect(provinceNames).toContain('Konya');
      expect(provinceNames).toContain('Ankara');
      expect(provinceNames).toContain('Isparta');
    });

    it('should extract vehicle type TIR', () => {
      const result = parse(antalyaMessage);
      expect(result.vehicle?.vehicleType).toBe('TIR');
    });

    it('should extract cargo type palet', () => {
      const result = parse(antalyaMessage);
      expect(result.cargoType).toBe('palet');
    });

    it('should have cargo available message type', () => {
      const result = parse(antalyaMessage);
      expect(result.messageType).toBe('CARGO_AVAILABLE');
    });
  });

  describe('Bozüyük Yükler Messages', () => {
    const bozuyukMessage = `📢BOZÜYÜK YÜKLER📢

🚛ANTALYA KAŞ 13.60 TIR
🚛ÇİĞLİ - İZMİR TIR

🇹🇷AÇIK KAPALI FARKETMEZ 🇹🇷

☎️ 0 533 480 89 40 ☎️`;

    it('should detect as logistics message', () => {
      expect(isLikelyLogisticsMessage(bozuyukMessage)).toBe(true);
    });

    it('should extract phone number', () => {
      const result = parse(bozuyukMessage);
      expect(result.phones.length).toBeGreaterThan(0);
      expect(result.phones[0].normalized).toBe('05334808940');
    });

    it('should extract Antalya location', () => {
      const result = parse(bozuyukMessage);
      const provinceNames = result.mentionedLocations.map(l => l.provinceName);
      expect(provinceNames).toContain('Antalya');
    });

    it('should extract Izmir location', () => {
      const result = parse(bozuyukMessage);
      const provinceNames = result.mentionedLocations.map(l => l.provinceName);
      expect(provinceNames).toContain('Izmir');
    });

    it('should extract TIR vehicle type', () => {
      const result = parse(bozuyukMessage);
      expect(result.vehicle?.vehicleType).toBe('TIR');
    });

    it('should have cargo available message type', () => {
      const result = parse(bozuyukMessage);
      expect(result.messageType).toBe('CARGO_AVAILABLE');
    });
  });

  describe('Çanakkale Çan Multiple Route Message', () => {
    const canakkaleMessage = `👉 *ÇANAKKALE ÇAN DAN*
Cizre.4 tir  peşin       2000+
Dargeçit.   peşin.      2100+
Diyarbakır peşin       2000+
Nudaybin  peşin       1700+
Antalya      6               900+
Adıyaman 5.             1700+
Diyarbakır 5 tır.         1950+
Bismil        1 tir.         2000+
Siverek.     1.             1800+
Erzurum.   1.        .... 2050+
Mardin.      1.             1850+
Giresun.     1.            1500+
Akçaabat.  2.        .. .1650+
Ordu.          1.             1450+

0536 771 8431 yasemin
Biga kaygısız loj`;

    it('should detect as logistics message', () => {
      expect(isLikelyLogisticsMessage(canakkaleMessage)).toBe(true);
    });

    it('should extract phone number', () => {
      const result = parse(canakkaleMessage);
      expect(result.phones.length).toBeGreaterThan(0);
      expect(result.phones[0].normalized).toBe('05367718431');
    });

    it('should extract Çanakkale as origin', () => {
      const result = parse(canakkaleMessage);
      expect(result.origin?.provinceName).toBe('Canakkale');
    });

    it('should extract multiple destinations', () => {
      const result = parse(canakkaleMessage);
      const provinceNames = result.mentionedLocations.map(l => l.provinceName);
      expect(provinceNames).toContain('Diyarbakir');
      expect(provinceNames).toContain('Antalya');
      expect(provinceNames).toContain('Erzurum');
      expect(provinceNames).toContain('Mardin');
      expect(provinceNames).toContain('Giresun');
      expect(provinceNames).toContain('Ordu');
    });

    it('should extract contact name', () => {
      const result = parse(canakkaleMessage);
      expect(result.contact?.name?.toLowerCase()).toContain('yasemin');
    });

    it('should extract TIR vehicle type', () => {
      const result = parse(canakkaleMessage);
      expect(result.vehicle?.vehicleType).toBe('TIR');
    });
  });

  describe('Nevşehir İskenderun Route Message', () => {
    const nevsehirMessage = `📢Nevşehir ↔️ iskendurun
Hammadde Kirkayak
🌕turgutlu ↔️ Gömeç tuğla
13.60 açık tenteli
🌕Turgutlu ↔️ gönen tuğla
13.60 açık tenteli
🌕Turgutlu ↔️ bandırma tuğla
13.60 açık tenteli

0533 524 47 45`;

    it('should detect as logistics message', () => {
      expect(isLikelyLogisticsMessage(nevsehirMessage)).toBe(true);
    });

    it('should extract phone number', () => {
      const result = parse(nevsehirMessage);
      expect(result.phones.length).toBeGreaterThan(0);
      expect(result.phones[0].normalized).toBe('05335244745');
    });

    it('should extract Nevsehir location', () => {
      const result = parse(nevsehirMessage);
      const provinceNames = result.mentionedLocations.map(l => l.provinceName);
      expect(provinceNames).toContain('Nevsehir');
    });

    it('should extract body type tenteli', () => {
      const result = parse(nevsehirMessage);
      expect(result.vehicle?.bodyType).toBeDefined();
    });
  });

  describe('Trabzon Frigo Route Message', () => {
    const trabzonMessage = `YARIN İZMİR

YÜKLEME TRABZON

BOŞALTMA

TERMOKİNLİ TIR



MEGA FRİGO
05425922879
05324547862`;

    it('should detect as logistics message', () => {
      expect(isLikelyLogisticsMessage(trabzonMessage)).toBe(true);
    });

    it('should extract phone numbers', () => {
      const result = parse(trabzonMessage);
      expect(result.phones.length).toBe(2);
      expect(result.phones.map(p => p.normalized)).toContain('05425922879');
      expect(result.phones.map(p => p.normalized)).toContain('05324547862');
    });

    it('should extract Izmir as destination', () => {
      const result = parse(trabzonMessage);
      const provinceNames = result.mentionedLocations.map(l => l.provinceName);
      expect(provinceNames).toContain('Izmir');
    });

    it('should extract Trabzon as origin', () => {
      const result = parse(trabzonMessage);
      const provinceNames = result.mentionedLocations.map(l => l.provinceName);
      expect(provinceNames).toContain('Trabzon');
    });

    it('should detect refrigerated vehicle', () => {
      const result = parse(trabzonMessage);
      expect(result.vehicle?.vehicleType).toBe('TIR');
      expect(result.vehicle?.isRefrigerated).toBe(true);
    });

    it('should have cargo available message type', () => {
      const result = parse(trabzonMessage);
      expect(result.messageType).toBe('CARGO_AVAILABLE');
    });
  });

  describe('Bafra Trabzon Frigo Message', () => {
    const bafraMessage = `BAFRADAN ➡️➡️ TRABZON
FRİGO TIR İHTİYACI VARDIR
ödeme yüklendiği yerden nakit
05325809828`;

    it('should detect as logistics message', () => {
      expect(isLikelyLogisticsMessage(bafraMessage)).toBe(true);
    });

    it('should extract phone number', () => {
      const result = parse(bafraMessage);
      expect(result.phones.length).toBeGreaterThan(0);
      expect(result.phones[0].normalized).toBe('05325809828');
    });

    it('should extract Trabzon as destination', () => {
      const result = parse(bafraMessage);
      const provinceNames = result.mentionedLocations.map(l => l.provinceName);
      expect(provinceNames).toContain('Trabzon');
    });

    it('should detect refrigerated vehicle', () => {
      const result = parse(bafraMessage);
      expect(result.vehicle?.vehicleType).toBe('TIR');
      expect(result.vehicle?.isRefrigerated).toBe(true);
    });

    it('should detect vehicle wanted message type', () => {
      const result = parse(bafraMessage);
      // Contains "ihtiyaci vardir" which indicates vehicle wanted
      expect(result.messageType).toBe('VEHICLE_WANTED');
    });
  });

  describe('Izmir Afyon Route Message', () => {
    const izmirAfyonMessage = `İZMİR DEN ➡️➡️ AFYON ŞUHUT
KISA DORSE İHTİYACI VARDIR
05325809828
SALI GÜNÜ YÜKLEME OLACAK`;

    it('should detect as logistics message', () => {
      expect(isLikelyLogisticsMessage(izmirAfyonMessage)).toBe(true);
    });

    it('should extract phone number', () => {
      const result = parse(izmirAfyonMessage);
      expect(result.phones.length).toBeGreaterThan(0);
      expect(result.phones[0].normalized).toBe('05325809828');
    });

    it('should extract Izmir as origin', () => {
      const result = parse(izmirAfyonMessage);
      expect(result.origin?.provinceName).toBe('Izmir');
    });

    it('should extract Afyonkarahisar as destination', () => {
      const result = parse(izmirAfyonMessage);
      const provinceNames = result.mentionedLocations.map(l => l.provinceName);
      expect(provinceNames).toContain('Afyonkarahisar');
    });
  });

  describe('Bursa Balikesir Machine Transport', () => {
    const bursaMessage = `🚩Bursa Çıkışlı Yükleme
Araç Tipi : 13/60 Açık Kasa
Malzeme : Makina Ekipman
Ağırlık : 0-21 TON
🚛 Balıkesir

☎️ 0 (530) 220 00 55
☎️ 0 (533) 926 62 49

https://whatsapp.com/channel/0029VafMwqCC1FuAaArZXh3Z`;

    it('should detect as logistics message', () => {
      expect(isLikelyLogisticsMessage(bursaMessage)).toBe(true);
    });

    it('should extract phone numbers', () => {
      const result = parse(bursaMessage);
      expect(result.phones.length).toBe(2);
      expect(result.phones.map(p => p.normalized)).toContain('05302200055');
      expect(result.phones.map(p => p.normalized)).toContain('05339266249');
    });

    it('should extract Bursa as origin', () => {
      const result = parse(bursaMessage);
      expect(result.origin?.provinceName).toBe('Bursa');
    });

    it('should extract Balikesir as destination', () => {
      const result = parse(bursaMessage);
      const provinceNames = result.mentionedLocations.map(l => l.provinceName);
      expect(provinceNames).toContain('Balikesir');
    });

    it('should extract weight', () => {
      const result = parse(bursaMessage);
      expect(result.weight).toBeDefined();
      expect(result.weight?.value).toBe(21);
    });

    it('should extract cargo type makine', () => {
      const result = parse(bursaMessage);
      expect(result.cargoType).toBe('makine');
    });

    it('should have cargo available message type', () => {
      const result = parse(bursaMessage);
      expect(result.messageType).toBe('CARGO_AVAILABLE');
    });
  });

  describe('Karabük Ankara Short Route', () => {
    const karabukMessage = `Karabük Ankara uzun kısa olur

05432980340`;

    it('should detect as logistics message', () => {
      expect(isLikelyLogisticsMessage(karabukMessage)).toBe(true);
    });

    it('should extract phone number', () => {
      const result = parse(karabukMessage);
      expect(result.phones.length).toBeGreaterThan(0);
      expect(result.phones[0].normalized).toBe('05432980340');
    });

    it('should extract Karabuk', () => {
      const result = parse(karabukMessage);
      const provinceNames = result.mentionedLocations.map(l => l.provinceName);
      expect(provinceNames).toContain('Karabuk');
    });

    it('should extract Ankara', () => {
      const result = parse(karabukMessage);
      const provinceNames = result.mentionedLocations.map(l => l.provinceName);
      expect(provinceNames).toContain('Ankara');
    });
  });
});

describe('isLikelyLogisticsMessage', () => {
  it('should return true for messages with locations', () => {
    expect(isLikelyLogisticsMessage('İstanbul yük var')).toBe(true);
  });

  it('should return true for messages with vehicle types', () => {
    expect(isLikelyLogisticsMessage('TIR aranıyor')).toBe(true);
  });

  it('should return true for messages with phone numbers', () => {
    expect(isLikelyLogisticsMessage('Bilgi için: 0532 123 45 67')).toBe(true);
  });

  it('should return false for random text', () => {
    expect(isLikelyLogisticsMessage('Merhaba nasılsın?')).toBe(false);
  });

  it('should return false for empty messages', () => {
    expect(isLikelyLogisticsMessage('')).toBe(false);
  });
});

describe('Confidence Scoring', () => {
  it('should have HIGH confidence for complete messages', () => {
    const message = `İSTANBUL - ANKARA TIR
Yükleme yarın
05321234567`;
    const result = parse(message);
    expect(result.confidenceLevel).toBe('HIGH');
  });

  it('should have MEDIUM confidence for messages with some info', () => {
    const message = `Konya yük var 05551234567`;
    const result = parse(message);
    expect(['HIGH', 'MEDIUM']).toContain(result.confidenceLevel);
  });

  it('should have LOW confidence for sparse messages', () => {
    const message = `TIR lazım`;
    const result = parse(message);
    expect(['MEDIUM', 'LOW']).toContain(result.confidenceLevel);
  });
});
