/**
 * Comprehensive list of ALL Turkish districts mapped to their provinces.
 * Auto-generated from Turkey.json
 *
 * IMPORTANT: Some district names exist in multiple provinces (e.g., Edremit in both Van and Balikesir).
 * The lookup functions return arrays to handle this ambiguity.
 */

export interface District {
  /** District name (proper case) */
  name: string;
  /** ASCII lowercase normalized name */
  normalized: string;
  /** Parent province plate code */
  provinceCode: number;
  /** Parent province name */
  provinceName: string;
}

/**
 * Complete list of Turkish districts (excluding generic "Merkez" entries)
 */
export const DISTRICTS: District[] = [
  // ADANA (1)
  { name: 'Aladağ', normalized: 'aladag', provinceCode: 1, provinceName: 'Adana' },
  { name: 'Ceyhan', normalized: 'ceyhan', provinceCode: 1, provinceName: 'Adana' },
  { name: 'Çukurova', normalized: 'cukurova', provinceCode: 1, provinceName: 'Adana' },
  { name: 'Feke', normalized: 'feke', provinceCode: 1, provinceName: 'Adana' },
  { name: 'İmamoğlu', normalized: 'imamoglu', provinceCode: 1, provinceName: 'Adana' },
  { name: 'Karai̇sali', normalized: 'karaisali', provinceCode: 1, provinceName: 'Adana' },
  { name: 'Karataş', normalized: 'karatas', provinceCode: 1, provinceName: 'Adana' },
  { name: 'Kozan', normalized: 'kozan', provinceCode: 1, provinceName: 'Adana' },
  { name: 'Pozanti', normalized: 'pozanti', provinceCode: 1, provinceName: 'Adana' },
  { name: 'Sai̇mbeyli̇', normalized: 'saimbeyli', provinceCode: 1, provinceName: 'Adana' },
  { name: 'Sariçam', normalized: 'saricam', provinceCode: 1, provinceName: 'Adana' },
  { name: 'Seyhan', normalized: 'seyhan', provinceCode: 1, provinceName: 'Adana' },
  { name: 'Tufanbeyli̇', normalized: 'tufanbeyli', provinceCode: 1, provinceName: 'Adana' },
  { name: 'Yumurtalik', normalized: 'yumurtalik', provinceCode: 1, provinceName: 'Adana' },
  { name: 'Yüreği̇r', normalized: 'yuregir', provinceCode: 1, provinceName: 'Adana' },

  // ADIYAMAN (2)
  { name: 'Besni̇', normalized: 'besni', provinceCode: 2, provinceName: 'Adiyaman' },
  { name: 'Çeli̇khan', normalized: 'celikhan', provinceCode: 2, provinceName: 'Adiyaman' },
  { name: 'Gerger', normalized: 'gerger', provinceCode: 2, provinceName: 'Adiyaman' },
  { name: 'Gölbaşi', normalized: 'golbasi', provinceCode: 2, provinceName: 'Adiyaman' },
  { name: 'Kahta', normalized: 'kahta', provinceCode: 2, provinceName: 'Adiyaman' },
  { name: 'Samsat', normalized: 'samsat', provinceCode: 2, provinceName: 'Adiyaman' },
  { name: 'Si̇nci̇k', normalized: 'sincik', provinceCode: 2, provinceName: 'Adiyaman' },
  { name: 'Tut', normalized: 'tut', provinceCode: 2, provinceName: 'Adiyaman' },

  // AFYONKARAHİSAR (3)
  { name: 'Başmakçi', normalized: 'basmakci', provinceCode: 3, provinceName: 'Afyonkarahisar' },
  { name: 'Bayat', normalized: 'bayat', provinceCode: 3, provinceName: 'Afyonkarahisar' },
  { name: 'Bolvadi̇n', normalized: 'bolvadin', provinceCode: 3, provinceName: 'Afyonkarahisar' },
  { name: 'Çay', normalized: 'cay', provinceCode: 3, provinceName: 'Afyonkarahisar' },
  { name: 'Çobanlar', normalized: 'cobanlar', provinceCode: 3, provinceName: 'Afyonkarahisar' },
  { name: 'Dazkiri', normalized: 'dazkiri', provinceCode: 3, provinceName: 'Afyonkarahisar' },
  { name: 'Di̇nar', normalized: 'dinar', provinceCode: 3, provinceName: 'Afyonkarahisar' },
  { name: 'Emi̇rdağ', normalized: 'emirdag', provinceCode: 3, provinceName: 'Afyonkarahisar' },
  { name: 'Evci̇ler', normalized: 'evciler', provinceCode: 3, provinceName: 'Afyonkarahisar' },
  { name: 'Hocalar', normalized: 'hocalar', provinceCode: 3, provinceName: 'Afyonkarahisar' },
  { name: 'İhsani̇ye', normalized: 'ihsaniye', provinceCode: 3, provinceName: 'Afyonkarahisar' },
  { name: 'İscehi̇sar', normalized: 'iscehisar', provinceCode: 3, provinceName: 'Afyonkarahisar' },
  { name: 'Kizilören', normalized: 'kiziloren', provinceCode: 3, provinceName: 'Afyonkarahisar' },
  { name: 'Sandikli', normalized: 'sandikli', provinceCode: 3, provinceName: 'Afyonkarahisar' },
  { name: 'Si̇nanpaşa', normalized: 'sinanpasa', provinceCode: 3, provinceName: 'Afyonkarahisar' },
  { name: 'Sultandaği', normalized: 'sultandagi', provinceCode: 3, provinceName: 'Afyonkarahisar' },
  { name: 'Şuhut', normalized: 'suhut', provinceCode: 3, provinceName: 'Afyonkarahisar' },

  // AĞRI (4)
  { name: 'Di̇yadi̇n', normalized: 'diyadin', provinceCode: 4, provinceName: 'Agri' },
  { name: 'Doğubayazit', normalized: 'dogubayazit', provinceCode: 4, provinceName: 'Agri' },
  { name: 'Eleşki̇rt', normalized: 'eleskirt', provinceCode: 4, provinceName: 'Agri' },
  { name: 'Hamur', normalized: 'hamur', provinceCode: 4, provinceName: 'Agri' },
  { name: 'Patnos', normalized: 'patnos', provinceCode: 4, provinceName: 'Agri' },
  { name: 'Taşliçay', normalized: 'taslicay', provinceCode: 4, provinceName: 'Agri' },
  { name: 'Tutak', normalized: 'tutak', provinceCode: 4, provinceName: 'Agri' },

  // AMASYA (5)
  { name: 'Göynücek', normalized: 'goynucek', provinceCode: 5, provinceName: 'Amasya' },
  { name: 'Gümüşhaciköy', normalized: 'gumushacikoy', provinceCode: 5, provinceName: 'Amasya' },
  { name: 'Hamamözü', normalized: 'hamamozu', provinceCode: 5, provinceName: 'Amasya' },
  { name: 'Merzi̇fon', normalized: 'merzifon', provinceCode: 5, provinceName: 'Amasya' },
  { name: 'Suluova', normalized: 'suluova', provinceCode: 5, provinceName: 'Amasya' },
  { name: 'Taşova', normalized: 'tasova', provinceCode: 5, provinceName: 'Amasya' },

  // ANKARA (6)
  { name: 'Akyurt', normalized: 'akyurt', provinceCode: 6, provinceName: 'Ankara' },
  { name: 'Altindağ', normalized: 'altindag', provinceCode: 6, provinceName: 'Ankara' },
  { name: 'Ayaş', normalized: 'ayas', provinceCode: 6, provinceName: 'Ankara' },
  { name: 'Bala', normalized: 'bala', provinceCode: 6, provinceName: 'Ankara' },
  { name: 'Beypazari', normalized: 'beypazari', provinceCode: 6, provinceName: 'Ankara' },
  { name: 'Çamlidere', normalized: 'camlidere', provinceCode: 6, provinceName: 'Ankara' },
  { name: 'Çankaya', normalized: 'cankaya', provinceCode: 6, provinceName: 'Ankara' },
  { name: 'Çubuk', normalized: 'cubuk', provinceCode: 6, provinceName: 'Ankara' },
  { name: 'Elmadağ', normalized: 'elmadag', provinceCode: 6, provinceName: 'Ankara' },
  { name: 'Eti̇mesgut', normalized: 'etimesgut', provinceCode: 6, provinceName: 'Ankara' },
  { name: 'Evren', normalized: 'evren', provinceCode: 6, provinceName: 'Ankara' },
  { name: 'Gölbaşi', normalized: 'golbasi', provinceCode: 6, provinceName: 'Ankara' },
  { name: 'Güdül', normalized: 'gudul', provinceCode: 6, provinceName: 'Ankara' },
  { name: 'Haymana', normalized: 'haymana', provinceCode: 6, provinceName: 'Ankara' },
  { name: 'Kahramankazan', normalized: 'kahramankazan', provinceCode: 6, provinceName: 'Ankara' },
  { name: 'Kaleci̇k', normalized: 'kalecik', provinceCode: 6, provinceName: 'Ankara' },
  { name: 'Keçi̇ören', normalized: 'kecioren', provinceCode: 6, provinceName: 'Ankara' },
  { name: 'Kizilcahamam', normalized: 'kizilcahamam', provinceCode: 6, provinceName: 'Ankara' },
  { name: 'Mamak', normalized: 'mamak', provinceCode: 6, provinceName: 'Ankara' },
  { name: 'Nallihan', normalized: 'nallihan', provinceCode: 6, provinceName: 'Ankara' },
  { name: 'Polatli', normalized: 'polatli', provinceCode: 6, provinceName: 'Ankara' },
  { name: 'Pursaklar', normalized: 'pursaklar', provinceCode: 6, provinceName: 'Ankara' },
  { name: 'Si̇ncan', normalized: 'sincan', provinceCode: 6, provinceName: 'Ankara' },
  { name: 'Şerefli̇koçhi̇sar', normalized: 'sereflikochisar', provinceCode: 6, provinceName: 'Ankara' },
  { name: 'Yeni̇mahalle', normalized: 'yenimahalle', provinceCode: 6, provinceName: 'Ankara' },

  // ANTALYA (7)
  { name: 'Akseki̇', normalized: 'akseki', provinceCode: 7, provinceName: 'Antalya' },
  { name: 'Aksu', normalized: 'aksu', provinceCode: 7, provinceName: 'Antalya' },
  { name: 'Alanya', normalized: 'alanya', provinceCode: 7, provinceName: 'Antalya' },
  { name: 'Demre', normalized: 'demre', provinceCode: 7, provinceName: 'Antalya' },
  { name: 'Döşemealti', normalized: 'dosemealti', provinceCode: 7, provinceName: 'Antalya' },
  { name: 'Elmali', normalized: 'elmali', provinceCode: 7, provinceName: 'Antalya' },
  { name: 'Fi̇ni̇ke', normalized: 'finike', provinceCode: 7, provinceName: 'Antalya' },
  { name: 'Gazi̇paşa', normalized: 'gazipasa', provinceCode: 7, provinceName: 'Antalya' },
  { name: 'Gündoğmuş', normalized: 'gundogmus', provinceCode: 7, provinceName: 'Antalya' },
  { name: 'İbradi', normalized: 'ibradi', provinceCode: 7, provinceName: 'Antalya' },
  { name: 'Kaş', normalized: 'kas', provinceCode: 7, provinceName: 'Antalya' },
  { name: 'Kemer', normalized: 'kemer', provinceCode: 7, provinceName: 'Antalya' },
  { name: 'Kepez', normalized: 'kepez', provinceCode: 7, provinceName: 'Antalya' },
  { name: 'Konyaalti', normalized: 'konyaalti', provinceCode: 7, provinceName: 'Antalya' },
  { name: 'Korkuteli̇', normalized: 'korkuteli', provinceCode: 7, provinceName: 'Antalya' },
  { name: 'Kumluca', normalized: 'kumluca', provinceCode: 7, provinceName: 'Antalya' },
  { name: 'Manavgat', normalized: 'manavgat', provinceCode: 7, provinceName: 'Antalya' },
  { name: 'Muratpaşa', normalized: 'muratpasa', provinceCode: 7, provinceName: 'Antalya' },
  { name: 'Seri̇k', normalized: 'serik', provinceCode: 7, provinceName: 'Antalya' },

  // ARTVİN (8)
  { name: 'Ardanuç', normalized: 'ardanuc', provinceCode: 8, provinceName: 'Artvin' },
  { name: 'Arhavi̇', normalized: 'arhavi', provinceCode: 8, provinceName: 'Artvin' },
  { name: 'Borçka', normalized: 'borcka', provinceCode: 8, provinceName: 'Artvin' },
  { name: 'Hopa', normalized: 'hopa', provinceCode: 8, provinceName: 'Artvin' },
  { name: 'Kemalpaşa', normalized: 'kemalpasa', provinceCode: 8, provinceName: 'Artvin' },
  { name: 'Murgul', normalized: 'murgul', provinceCode: 8, provinceName: 'Artvin' },
  { name: 'Şavşat', normalized: 'savsat', provinceCode: 8, provinceName: 'Artvin' },
  { name: 'Yusufeli̇', normalized: 'yusufeli', provinceCode: 8, provinceName: 'Artvin' },

  // AYDIN (9)
  { name: 'Bozdoğan', normalized: 'bozdogan', provinceCode: 9, provinceName: 'Aydin' },
  { name: 'Buharkent', normalized: 'buharkent', provinceCode: 9, provinceName: 'Aydin' },
  { name: 'Çi̇ne', normalized: 'cine', provinceCode: 9, provinceName: 'Aydin' },
  { name: 'Di̇di̇m', normalized: 'didim', provinceCode: 9, provinceName: 'Aydin' },
  { name: 'Efeler', normalized: 'efeler', provinceCode: 9, provinceName: 'Aydin' },
  { name: 'Germenci̇k', normalized: 'germencik', provinceCode: 9, provinceName: 'Aydin' },
  { name: 'İnci̇rli̇ova', normalized: 'incirliova', provinceCode: 9, provinceName: 'Aydin' },
  { name: 'Karacasu', normalized: 'karacasu', provinceCode: 9, provinceName: 'Aydin' },
  { name: 'Karpuzlu', normalized: 'karpuzlu', provinceCode: 9, provinceName: 'Aydin' },
  { name: 'Koçarli', normalized: 'kocarli', provinceCode: 9, provinceName: 'Aydin' },
  { name: 'Köşk', normalized: 'kosk', provinceCode: 9, provinceName: 'Aydin' },
  { name: 'Kuşadasi', normalized: 'kusadasi', provinceCode: 9, provinceName: 'Aydin' },
  { name: 'Kuyucak', normalized: 'kuyucak', provinceCode: 9, provinceName: 'Aydin' },
  { name: 'Nazi̇lli̇', normalized: 'nazilli', provinceCode: 9, provinceName: 'Aydin' },
  { name: 'Söke', normalized: 'soke', provinceCode: 9, provinceName: 'Aydin' },
  { name: 'Sultanhi̇sar', normalized: 'sultanhisar', provinceCode: 9, provinceName: 'Aydin' },
  { name: 'Yeni̇pazar', normalized: 'yenipazar', provinceCode: 9, provinceName: 'Aydin' },

  // BALIKESİR (10)
  { name: 'Altieylül', normalized: 'altieylul', provinceCode: 10, provinceName: 'Balikesir' },
  { name: 'Ayvalik', normalized: 'ayvalik', provinceCode: 10, provinceName: 'Balikesir' },
  { name: 'Balya', normalized: 'balya', provinceCode: 10, provinceName: 'Balikesir' },
  { name: 'Bandirma', normalized: 'bandirma', provinceCode: 10, provinceName: 'Balikesir' },
  { name: 'Bi̇gadi̇ç', normalized: 'bigadic', provinceCode: 10, provinceName: 'Balikesir' },
  { name: 'Burhani̇ye', normalized: 'burhaniye', provinceCode: 10, provinceName: 'Balikesir' },
  { name: 'Dursunbey', normalized: 'dursunbey', provinceCode: 10, provinceName: 'Balikesir' },
  { name: 'Edremi̇t', normalized: 'edremit', provinceCode: 10, provinceName: 'Balikesir' },
  { name: 'Erdek', normalized: 'erdek', provinceCode: 10, provinceName: 'Balikesir' },
  { name: 'Gömeç', normalized: 'gomec', provinceCode: 10, provinceName: 'Balikesir' },
  { name: 'Gönen', normalized: 'gonen', provinceCode: 10, provinceName: 'Balikesir' },
  { name: 'Havran', normalized: 'havran', provinceCode: 10, provinceName: 'Balikesir' },
  { name: 'İvri̇ndi̇', normalized: 'ivrindi', provinceCode: 10, provinceName: 'Balikesir' },
  { name: 'Karesi̇', normalized: 'karesi', provinceCode: 10, provinceName: 'Balikesir' },
  { name: 'Kepsut', normalized: 'kepsut', provinceCode: 10, provinceName: 'Balikesir' },
  { name: 'Manyas', normalized: 'manyas', provinceCode: 10, provinceName: 'Balikesir' },
  { name: 'Marmara', normalized: 'marmara', provinceCode: 10, provinceName: 'Balikesir' },
  { name: 'Savaştepe', normalized: 'savastepe', provinceCode: 10, provinceName: 'Balikesir' },
  { name: 'Sindirgi', normalized: 'sindirgi', provinceCode: 10, provinceName: 'Balikesir' },
  { name: 'Susurluk', normalized: 'susurluk', provinceCode: 10, provinceName: 'Balikesir' },

  // BİLECİK (11)
  { name: 'Bozüyük', normalized: 'bozuyuk', provinceCode: 11, provinceName: 'Bilecik' },
  { name: 'Gölpazari', normalized: 'golpazari', provinceCode: 11, provinceName: 'Bilecik' },
  { name: 'İnhi̇sar', normalized: 'inhisar', provinceCode: 11, provinceName: 'Bilecik' },
  { name: 'Osmaneli̇', normalized: 'osmaneli', provinceCode: 11, provinceName: 'Bilecik' },
  { name: 'Pazaryeri̇', normalized: 'pazaryeri', provinceCode: 11, provinceName: 'Bilecik' },
  { name: 'Söğüt', normalized: 'sogut', provinceCode: 11, provinceName: 'Bilecik' },
  { name: 'Yeni̇pazar', normalized: 'yenipazar', provinceCode: 11, provinceName: 'Bilecik' },

  // BİNGÖL (12)
  { name: 'Adakli', normalized: 'adakli', provinceCode: 12, provinceName: 'Bingol' },
  { name: 'Genç', normalized: 'genc', provinceCode: 12, provinceName: 'Bingol' },
  { name: 'Karliova', normalized: 'karliova', provinceCode: 12, provinceName: 'Bingol' },
  { name: 'Ki̇ği', normalized: 'kigi', provinceCode: 12, provinceName: 'Bingol' },
  { name: 'Solhan', normalized: 'solhan', provinceCode: 12, provinceName: 'Bingol' },
  { name: 'Yayladere', normalized: 'yayladere', provinceCode: 12, provinceName: 'Bingol' },
  { name: 'Yedi̇su', normalized: 'yedisu', provinceCode: 12, provinceName: 'Bingol' },

  // BİTLİS (13)
  { name: 'Adi̇lcevaz', normalized: 'adilcevaz', provinceCode: 13, provinceName: 'Bitlis' },
  { name: 'Ahlat', normalized: 'ahlat', provinceCode: 13, provinceName: 'Bitlis' },
  { name: 'Güroymak', normalized: 'guroymak', provinceCode: 13, provinceName: 'Bitlis' },
  { name: 'Hi̇zan', normalized: 'hizan', provinceCode: 13, provinceName: 'Bitlis' },
  { name: 'Mutki̇', normalized: 'mutki', provinceCode: 13, provinceName: 'Bitlis' },
  { name: 'Tatvan', normalized: 'tatvan', provinceCode: 13, provinceName: 'Bitlis' },

  // BOLU (14)
  { name: 'Dörtdi̇van', normalized: 'dortdivan', provinceCode: 14, provinceName: 'Bolu' },
  { name: 'Gerede', normalized: 'gerede', provinceCode: 14, provinceName: 'Bolu' },
  { name: 'Göynük', normalized: 'goynuk', provinceCode: 14, provinceName: 'Bolu' },
  { name: 'Kibriscik', normalized: 'kibriscik', provinceCode: 14, provinceName: 'Bolu' },
  { name: 'Mengen', normalized: 'mengen', provinceCode: 14, provinceName: 'Bolu' },
  { name: 'Mudurnu', normalized: 'mudurnu', provinceCode: 14, provinceName: 'Bolu' },
  { name: 'Seben', normalized: 'seben', provinceCode: 14, provinceName: 'Bolu' },
  { name: 'Yeni̇çağa', normalized: 'yenicaga', provinceCode: 14, provinceName: 'Bolu' },

  // BURDUR (15)
  { name: 'Ağlasun', normalized: 'aglasun', provinceCode: 15, provinceName: 'Burdur' },
  { name: 'Altinyayla', normalized: 'altinyayla', provinceCode: 15, provinceName: 'Burdur' },
  { name: 'Bucak', normalized: 'bucak', provinceCode: 15, provinceName: 'Burdur' },
  { name: 'Çavdir', normalized: 'cavdir', provinceCode: 15, provinceName: 'Burdur' },
  { name: 'Çelti̇kçi̇', normalized: 'celtikci', provinceCode: 15, provinceName: 'Burdur' },
  { name: 'Gölhi̇sar', normalized: 'golhisar', provinceCode: 15, provinceName: 'Burdur' },
  { name: 'Karamanli', normalized: 'karamanli', provinceCode: 15, provinceName: 'Burdur' },
  { name: 'Kemer', normalized: 'kemer', provinceCode: 15, provinceName: 'Burdur' },
  { name: 'Tefenni̇', normalized: 'tefenni', provinceCode: 15, provinceName: 'Burdur' },
  { name: 'Yeşi̇lova', normalized: 'yesilova', provinceCode: 15, provinceName: 'Burdur' },

  // BURSA (16)
  { name: 'Büyükorhan', normalized: 'buyukorhan', provinceCode: 16, provinceName: 'Bursa' },
  { name: 'Gemli̇k', normalized: 'gemlik', provinceCode: 16, provinceName: 'Bursa' },
  { name: 'Gürsu', normalized: 'gursu', provinceCode: 16, provinceName: 'Bursa' },
  { name: 'Harmancik', normalized: 'harmancik', provinceCode: 16, provinceName: 'Bursa' },
  { name: 'İnegöl', normalized: 'inegol', provinceCode: 16, provinceName: 'Bursa' },
  { name: 'İzni̇k', normalized: 'iznik', provinceCode: 16, provinceName: 'Bursa' },
  { name: 'Karacabey', normalized: 'karacabey', provinceCode: 16, provinceName: 'Bursa' },
  { name: 'Keles', normalized: 'keles', provinceCode: 16, provinceName: 'Bursa' },
  { name: 'Kestel', normalized: 'kestel', provinceCode: 16, provinceName: 'Bursa' },
  { name: 'Mudanya', normalized: 'mudanya', provinceCode: 16, provinceName: 'Bursa' },
  { name: 'Mustafakemalpaşa', normalized: 'mustafakemalpasa', provinceCode: 16, provinceName: 'Bursa' },
  { name: 'Ni̇lüfer', normalized: 'nilufer', provinceCode: 16, provinceName: 'Bursa' },
  { name: 'Orhaneli̇', normalized: 'orhaneli', provinceCode: 16, provinceName: 'Bursa' },
  { name: 'Orhangazi̇', normalized: 'orhangazi', provinceCode: 16, provinceName: 'Bursa' },
  { name: 'Osmangazi̇', normalized: 'osmangazi', provinceCode: 16, provinceName: 'Bursa' },
  { name: 'Yeni̇şehi̇r', normalized: 'yenisehir', provinceCode: 16, provinceName: 'Bursa' },
  { name: 'Yildirim', normalized: 'yildirim', provinceCode: 16, provinceName: 'Bursa' },

  // ÇANAKKALE (17)
  { name: 'Ayvacik', normalized: 'ayvacik', provinceCode: 17, provinceName: 'Canakkale' },
  { name: 'Bayrami̇ç', normalized: 'bayramic', provinceCode: 17, provinceName: 'Canakkale' },
  { name: 'Bi̇ga', normalized: 'biga', provinceCode: 17, provinceName: 'Canakkale' },
  { name: 'Bozcaada', normalized: 'bozcaada', provinceCode: 17, provinceName: 'Canakkale' },
  { name: 'Çan', normalized: 'can', provinceCode: 17, provinceName: 'Canakkale' },
  { name: 'Eceabat', normalized: 'eceabat', provinceCode: 17, provinceName: 'Canakkale' },
  { name: 'Ezi̇ne', normalized: 'ezine', provinceCode: 17, provinceName: 'Canakkale' },
  { name: 'Geli̇bolu', normalized: 'gelibolu', provinceCode: 17, provinceName: 'Canakkale' },
  { name: 'Gökçeada', normalized: 'gokceada', provinceCode: 17, provinceName: 'Canakkale' },
  { name: 'Lapseki̇', normalized: 'lapseki', provinceCode: 17, provinceName: 'Canakkale' },
  { name: 'Yeni̇ce', normalized: 'yenice', provinceCode: 17, provinceName: 'Canakkale' },

  // ÇANKIRI (18)
  { name: 'Atkaracalar', normalized: 'atkaracalar', provinceCode: 18, provinceName: 'Cankiri' },
  { name: 'Bayramören', normalized: 'bayramoren', provinceCode: 18, provinceName: 'Cankiri' },
  { name: 'Çerkeş', normalized: 'cerkes', provinceCode: 18, provinceName: 'Cankiri' },
  { name: 'Eldi̇van', normalized: 'eldivan', provinceCode: 18, provinceName: 'Cankiri' },
  { name: 'Ilgaz', normalized: 'ilgaz', provinceCode: 18, provinceName: 'Cankiri' },
  { name: 'Kizilirmak', normalized: 'kizilirmak', provinceCode: 18, provinceName: 'Cankiri' },
  { name: 'Korgun', normalized: 'korgun', provinceCode: 18, provinceName: 'Cankiri' },
  { name: 'Kurşunlu', normalized: 'kursunlu', provinceCode: 18, provinceName: 'Cankiri' },
  { name: 'Orta', normalized: 'orta', provinceCode: 18, provinceName: 'Cankiri' },
  { name: 'Şabanözü', normalized: 'sabanozu', provinceCode: 18, provinceName: 'Cankiri' },
  { name: 'Yaprakli', normalized: 'yaprakli', provinceCode: 18, provinceName: 'Cankiri' },

  // ÇORUM (19)
  { name: 'Alaca', normalized: 'alaca', provinceCode: 19, provinceName: 'Corum' },
  { name: 'Bayat', normalized: 'bayat', provinceCode: 19, provinceName: 'Corum' },
  { name: 'Boğazkale', normalized: 'bogazkale', provinceCode: 19, provinceName: 'Corum' },
  { name: 'Dodurga', normalized: 'dodurga', provinceCode: 19, provinceName: 'Corum' },
  { name: 'İski̇li̇p', normalized: 'iskilip', provinceCode: 19, provinceName: 'Corum' },
  { name: 'Kargi', normalized: 'kargi', provinceCode: 19, provinceName: 'Corum' },
  { name: 'Laçi̇n', normalized: 'lacin', provinceCode: 19, provinceName: 'Corum' },
  { name: 'Meci̇tözü', normalized: 'mecitozu', provinceCode: 19, provinceName: 'Corum' },
  { name: 'Oğuzlar', normalized: 'oguzlar', provinceCode: 19, provinceName: 'Corum' },
  { name: 'Ortaköy', normalized: 'ortakoy', provinceCode: 19, provinceName: 'Corum' },
  { name: 'Osmancik', normalized: 'osmancik', provinceCode: 19, provinceName: 'Corum' },
  { name: 'Sungurlu', normalized: 'sungurlu', provinceCode: 19, provinceName: 'Corum' },
  { name: 'Uğurludağ', normalized: 'ugurludag', provinceCode: 19, provinceName: 'Corum' },

  // DENİZLİ (20)
  { name: 'Acipayam', normalized: 'acipayam', provinceCode: 20, provinceName: 'Denizli' },
  { name: 'Babadağ', normalized: 'babadag', provinceCode: 20, provinceName: 'Denizli' },
  { name: 'Baklan', normalized: 'baklan', provinceCode: 20, provinceName: 'Denizli' },
  { name: 'Beki̇lli̇', normalized: 'bekilli', provinceCode: 20, provinceName: 'Denizli' },
  { name: 'Beyağaç', normalized: 'beyagac', provinceCode: 20, provinceName: 'Denizli' },
  { name: 'Bozkurt', normalized: 'bozkurt', provinceCode: 20, provinceName: 'Denizli' },
  { name: 'Buldan', normalized: 'buldan', provinceCode: 20, provinceName: 'Denizli' },
  { name: 'Çal', normalized: 'cal', provinceCode: 20, provinceName: 'Denizli' },
  { name: 'Çameli̇', normalized: 'cameli', provinceCode: 20, provinceName: 'Denizli' },
  { name: 'Çardak', normalized: 'cardak', provinceCode: 20, provinceName: 'Denizli' },
  { name: 'Çi̇vri̇l', normalized: 'civril', provinceCode: 20, provinceName: 'Denizli' },
  { name: 'Güney', normalized: 'guney', provinceCode: 20, provinceName: 'Denizli' },
  { name: 'Honaz', normalized: 'honaz', provinceCode: 20, provinceName: 'Denizli' },
  { name: 'Kale', normalized: 'kale', provinceCode: 20, provinceName: 'Denizli' },
  { name: 'Merkezefendi̇', normalized: 'merkezefendi', provinceCode: 20, provinceName: 'Denizli' },
  { name: 'Pamukkale', normalized: 'pamukkale', provinceCode: 20, provinceName: 'Denizli' },
  { name: 'Sarayköy', normalized: 'saraykoy', provinceCode: 20, provinceName: 'Denizli' },
  { name: 'Seri̇nhi̇sar', normalized: 'serinhisar', provinceCode: 20, provinceName: 'Denizli' },
  { name: 'Tavas', normalized: 'tavas', provinceCode: 20, provinceName: 'Denizli' },

  // DİYARBAKIR (21)
  { name: 'Bağlar', normalized: 'baglar', provinceCode: 21, provinceName: 'Diyarbakir' },
  { name: 'Bi̇smi̇l', normalized: 'bismil', provinceCode: 21, provinceName: 'Diyarbakir' },
  { name: 'Çermi̇k', normalized: 'cermik', provinceCode: 21, provinceName: 'Diyarbakir' },
  { name: 'Çinar', normalized: 'cinar', provinceCode: 21, provinceName: 'Diyarbakir' },
  { name: 'Çüngüş', normalized: 'cungus', provinceCode: 21, provinceName: 'Diyarbakir' },
  { name: 'Di̇cle', normalized: 'dicle', provinceCode: 21, provinceName: 'Diyarbakir' },
  { name: 'Eği̇l', normalized: 'egil', provinceCode: 21, provinceName: 'Diyarbakir' },
  { name: 'Ergani̇', normalized: 'ergani', provinceCode: 21, provinceName: 'Diyarbakir' },
  { name: 'Hani̇', normalized: 'hani', provinceCode: 21, provinceName: 'Diyarbakir' },
  { name: 'Hazro', normalized: 'hazro', provinceCode: 21, provinceName: 'Diyarbakir' },
  { name: 'Kayapinar', normalized: 'kayapinar', provinceCode: 21, provinceName: 'Diyarbakir' },
  { name: 'Kocaköy', normalized: 'kocakoy', provinceCode: 21, provinceName: 'Diyarbakir' },
  { name: 'Kulp', normalized: 'kulp', provinceCode: 21, provinceName: 'Diyarbakir' },
  { name: 'Li̇ce', normalized: 'lice', provinceCode: 21, provinceName: 'Diyarbakir' },
  { name: 'Si̇lvan', normalized: 'silvan', provinceCode: 21, provinceName: 'Diyarbakir' },
  { name: 'Sur', normalized: 'sur', provinceCode: 21, provinceName: 'Diyarbakir' },
  { name: 'Yeni̇şehi̇r', normalized: 'yenisehir', provinceCode: 21, provinceName: 'Diyarbakir' },

  // EDİRNE (22)
  { name: 'Enez', normalized: 'enez', provinceCode: 22, provinceName: 'Edirne' },
  { name: 'Havsa', normalized: 'havsa', provinceCode: 22, provinceName: 'Edirne' },
  { name: 'İpsala', normalized: 'ipsala', provinceCode: 22, provinceName: 'Edirne' },
  { name: 'Keşan', normalized: 'kesan', provinceCode: 22, provinceName: 'Edirne' },
  { name: 'Lalapaşa', normalized: 'lalapasa', provinceCode: 22, provinceName: 'Edirne' },
  { name: 'Meri̇ç', normalized: 'meric', provinceCode: 22, provinceName: 'Edirne' },
  { name: 'Süloğlu', normalized: 'suloglu', provinceCode: 22, provinceName: 'Edirne' },
  { name: 'Uzunköprü', normalized: 'uzunkopru', provinceCode: 22, provinceName: 'Edirne' },

  // ELAZIĞ (23)
  { name: 'Ağin', normalized: 'agin', provinceCode: 23, provinceName: 'Elazig' },
  { name: 'Alacakaya', normalized: 'alacakaya', provinceCode: 23, provinceName: 'Elazig' },
  { name: 'Aricak', normalized: 'aricak', provinceCode: 23, provinceName: 'Elazig' },
  { name: 'Baski̇l', normalized: 'baskil', provinceCode: 23, provinceName: 'Elazig' },
  { name: 'Karakoçan', normalized: 'karakocan', provinceCode: 23, provinceName: 'Elazig' },
  { name: 'Keban', normalized: 'keban', provinceCode: 23, provinceName: 'Elazig' },
  { name: 'Kovancilar', normalized: 'kovancilar', provinceCode: 23, provinceName: 'Elazig' },
  { name: 'Maden', normalized: 'maden', provinceCode: 23, provinceName: 'Elazig' },
  { name: 'Palu', normalized: 'palu', provinceCode: 23, provinceName: 'Elazig' },
  { name: 'Si̇vri̇ce', normalized: 'sivrice', provinceCode: 23, provinceName: 'Elazig' },

  // ERZİNCAN (24)
  { name: 'Çayirli', normalized: 'cayirli', provinceCode: 24, provinceName: 'Erzincan' },
  { name: 'İli̇ç', normalized: 'ilic', provinceCode: 24, provinceName: 'Erzincan' },
  { name: 'Kemah', normalized: 'kemah', provinceCode: 24, provinceName: 'Erzincan' },
  { name: 'Kemali̇ye', normalized: 'kemaliye', provinceCode: 24, provinceName: 'Erzincan' },
  { name: 'Otlukbeli̇', normalized: 'otlukbeli', provinceCode: 24, provinceName: 'Erzincan' },
  { name: 'Refahi̇ye', normalized: 'refahiye', provinceCode: 24, provinceName: 'Erzincan' },
  { name: 'Tercan', normalized: 'tercan', provinceCode: 24, provinceName: 'Erzincan' },
  { name: 'Üzümlü', normalized: 'uzumlu', provinceCode: 24, provinceName: 'Erzincan' },

  // ERZURUM (25)
  { name: 'Aşkale', normalized: 'askale', provinceCode: 25, provinceName: 'Erzurum' },
  { name: 'Azi̇zi̇ye', normalized: 'aziziye', provinceCode: 25, provinceName: 'Erzurum' },
  { name: 'Çat', normalized: 'cat', provinceCode: 25, provinceName: 'Erzurum' },
  { name: 'Hinis', normalized: 'hinis', provinceCode: 25, provinceName: 'Erzurum' },
  { name: 'Horasan', normalized: 'horasan', provinceCode: 25, provinceName: 'Erzurum' },
  { name: 'İspi̇r', normalized: 'ispir', provinceCode: 25, provinceName: 'Erzurum' },
  { name: 'Karaçoban', normalized: 'karacoban', provinceCode: 25, provinceName: 'Erzurum' },
  { name: 'Karayazi', normalized: 'karayazi', provinceCode: 25, provinceName: 'Erzurum' },
  { name: 'Köprüköy', normalized: 'koprukoy', provinceCode: 25, provinceName: 'Erzurum' },
  { name: 'Narman', normalized: 'narman', provinceCode: 25, provinceName: 'Erzurum' },
  { name: 'Oltu', normalized: 'oltu', provinceCode: 25, provinceName: 'Erzurum' },
  { name: 'Olur', normalized: 'olur', provinceCode: 25, provinceName: 'Erzurum' },
  { name: 'Palandöken', normalized: 'palandoken', provinceCode: 25, provinceName: 'Erzurum' },
  { name: 'Pasi̇nler', normalized: 'pasinler', provinceCode: 25, provinceName: 'Erzurum' },
  { name: 'Pazaryolu', normalized: 'pazaryolu', provinceCode: 25, provinceName: 'Erzurum' },
  { name: 'Şenkaya', normalized: 'senkaya', provinceCode: 25, provinceName: 'Erzurum' },
  { name: 'Tekman', normalized: 'tekman', provinceCode: 25, provinceName: 'Erzurum' },
  { name: 'Tortum', normalized: 'tortum', provinceCode: 25, provinceName: 'Erzurum' },
  { name: 'Uzundere', normalized: 'uzundere', provinceCode: 25, provinceName: 'Erzurum' },
  { name: 'Yakuti̇ye', normalized: 'yakutiye', provinceCode: 25, provinceName: 'Erzurum' },

  // ESKİŞEHİR (26)
  { name: 'Alpu', normalized: 'alpu', provinceCode: 26, provinceName: 'Eskisehir' },
  { name: 'Beyli̇kova', normalized: 'beylikova', provinceCode: 26, provinceName: 'Eskisehir' },
  { name: 'Çi̇fteler', normalized: 'cifteler', provinceCode: 26, provinceName: 'Eskisehir' },
  { name: 'Günyüzü', normalized: 'gunyuzu', provinceCode: 26, provinceName: 'Eskisehir' },
  { name: 'Han', normalized: 'han', provinceCode: 26, provinceName: 'Eskisehir' },
  { name: 'İnönü', normalized: 'inonu', provinceCode: 26, provinceName: 'Eskisehir' },
  { name: 'Mahmudi̇ye', normalized: 'mahmudiye', provinceCode: 26, provinceName: 'Eskisehir' },
  { name: 'Mi̇halgazi̇', normalized: 'mihalgazi', provinceCode: 26, provinceName: 'Eskisehir' },
  { name: 'Mi̇haliççik', normalized: 'mihaliccik', provinceCode: 26, provinceName: 'Eskisehir' },
  { name: 'Odunpazari', normalized: 'odunpazari', provinceCode: 26, provinceName: 'Eskisehir' },
  { name: 'Saricakaya', normalized: 'saricakaya', provinceCode: 26, provinceName: 'Eskisehir' },
  { name: 'Seyi̇tgazi̇', normalized: 'seyitgazi', provinceCode: 26, provinceName: 'Eskisehir' },
  { name: 'Si̇vri̇hi̇sar', normalized: 'sivrihisar', provinceCode: 26, provinceName: 'Eskisehir' },
  { name: 'Tepebaşi', normalized: 'tepebasi', provinceCode: 26, provinceName: 'Eskisehir' },

  // GAZİANTEP (27)
  { name: 'Araban', normalized: 'araban', provinceCode: 27, provinceName: 'Gaziantep' },
  { name: 'İslahi̇ye', normalized: 'islahiye', provinceCode: 27, provinceName: 'Gaziantep' },
  { name: 'Karkamiş', normalized: 'karkamis', provinceCode: 27, provinceName: 'Gaziantep' },
  { name: 'Ni̇zi̇p', normalized: 'nizip', provinceCode: 27, provinceName: 'Gaziantep' },
  { name: 'Nurdaği', normalized: 'nurdagi', provinceCode: 27, provinceName: 'Gaziantep' },
  { name: 'Oğuzeli̇', normalized: 'oguzeli', provinceCode: 27, provinceName: 'Gaziantep' },
  { name: 'Şahi̇nbey', normalized: 'sahinbey', provinceCode: 27, provinceName: 'Gaziantep' },
  { name: 'Şehi̇tkami̇l', normalized: 'sehitkamil', provinceCode: 27, provinceName: 'Gaziantep' },
  { name: 'Yavuzeli̇', normalized: 'yavuzeli', provinceCode: 27, provinceName: 'Gaziantep' },

  // GİRESUN (28)
  { name: 'Alucra', normalized: 'alucra', provinceCode: 28, provinceName: 'Giresun' },
  { name: 'Bulancak', normalized: 'bulancak', provinceCode: 28, provinceName: 'Giresun' },
  { name: 'Çamoluk', normalized: 'camoluk', provinceCode: 28, provinceName: 'Giresun' },
  { name: 'Çanakçi', normalized: 'canakci', provinceCode: 28, provinceName: 'Giresun' },
  { name: 'Dereli̇', normalized: 'dereli', provinceCode: 28, provinceName: 'Giresun' },
  { name: 'Doğankent', normalized: 'dogankent', provinceCode: 28, provinceName: 'Giresun' },
  { name: 'Espi̇ye', normalized: 'espiye', provinceCode: 28, provinceName: 'Giresun' },
  { name: 'Eynesi̇l', normalized: 'eynesil', provinceCode: 28, provinceName: 'Giresun' },
  { name: 'Görele', normalized: 'gorele', provinceCode: 28, provinceName: 'Giresun' },
  { name: 'Güce', normalized: 'guce', provinceCode: 28, provinceName: 'Giresun' },
  { name: 'Keşap', normalized: 'kesap', provinceCode: 28, provinceName: 'Giresun' },
  { name: 'Pi̇razi̇z', normalized: 'piraziz', provinceCode: 28, provinceName: 'Giresun' },
  { name: 'Şebi̇nkarahi̇sar', normalized: 'sebinkarahisar', provinceCode: 28, provinceName: 'Giresun' },
  { name: 'Ti̇rebolu', normalized: 'tirebolu', provinceCode: 28, provinceName: 'Giresun' },
  { name: 'Yağlidere', normalized: 'yaglidere', provinceCode: 28, provinceName: 'Giresun' },

  // GÜMÜŞHANE (29)
  { name: 'Kelki̇t', normalized: 'kelkit', provinceCode: 29, provinceName: 'Gumushane' },
  { name: 'Köse', normalized: 'kose', provinceCode: 29, provinceName: 'Gumushane' },
  { name: 'Kürtün', normalized: 'kurtun', provinceCode: 29, provinceName: 'Gumushane' },
  { name: 'Şi̇ran', normalized: 'siran', provinceCode: 29, provinceName: 'Gumushane' },
  { name: 'Torul', normalized: 'torul', provinceCode: 29, provinceName: 'Gumushane' },

  // HAKKARİ (30)
  { name: 'Çukurca', normalized: 'cukurca', provinceCode: 30, provinceName: 'Hakkari' },
  { name: 'Dereci̇k', normalized: 'derecik', provinceCode: 30, provinceName: 'Hakkari' },
  { name: 'Şemdi̇nli̇', normalized: 'semdinli', provinceCode: 30, provinceName: 'Hakkari' },
  { name: 'Yüksekova', normalized: 'yuksekova', provinceCode: 30, provinceName: 'Hakkari' },

  // HATAY (31)
  { name: 'Altinözü', normalized: 'altinozu', provinceCode: 31, provinceName: 'Hatay' },
  { name: 'Antakya', normalized: 'antakya', provinceCode: 31, provinceName: 'Hatay' },
  { name: 'Arsuz', normalized: 'arsuz', provinceCode: 31, provinceName: 'Hatay' },
  { name: 'Belen', normalized: 'belen', provinceCode: 31, provinceName: 'Hatay' },
  { name: 'Defne', normalized: 'defne', provinceCode: 31, provinceName: 'Hatay' },
  { name: 'Dörtyol', normalized: 'dortyol', provinceCode: 31, provinceName: 'Hatay' },
  { name: 'Erzi̇n', normalized: 'erzin', provinceCode: 31, provinceName: 'Hatay' },
  { name: 'Hassa', normalized: 'hassa', provinceCode: 31, provinceName: 'Hatay' },
  { name: 'İskenderun', normalized: 'iskenderun', provinceCode: 31, provinceName: 'Hatay' },
  { name: 'Kirikhan', normalized: 'kirikhan', provinceCode: 31, provinceName: 'Hatay' },
  { name: 'Kumlu', normalized: 'kumlu', provinceCode: 31, provinceName: 'Hatay' },
  { name: 'Payas', normalized: 'payas', provinceCode: 31, provinceName: 'Hatay' },
  { name: 'Reyhanli', normalized: 'reyhanli', provinceCode: 31, provinceName: 'Hatay' },
  { name: 'Samandağ', normalized: 'samandag', provinceCode: 31, provinceName: 'Hatay' },
  { name: 'Yayladaği', normalized: 'yayladagi', provinceCode: 31, provinceName: 'Hatay' },

  // ISPARTA (32)
  { name: 'Aksu', normalized: 'aksu', provinceCode: 32, provinceName: 'Isparta' },
  { name: 'Atabey', normalized: 'atabey', provinceCode: 32, provinceName: 'Isparta' },
  { name: 'Eği̇rdi̇r', normalized: 'egirdir', provinceCode: 32, provinceName: 'Isparta' },
  { name: 'Gelendost', normalized: 'gelendost', provinceCode: 32, provinceName: 'Isparta' },
  { name: 'Gönen', normalized: 'gonen', provinceCode: 32, provinceName: 'Isparta' },
  { name: 'Keçi̇borlu', normalized: 'keciborlu', provinceCode: 32, provinceName: 'Isparta' },
  { name: 'Seni̇rkent', normalized: 'senirkent', provinceCode: 32, provinceName: 'Isparta' },
  { name: 'Sütçüler', normalized: 'sutculer', provinceCode: 32, provinceName: 'Isparta' },
  { name: 'Şarki̇karaağaç', normalized: 'sarkikaraagac', provinceCode: 32, provinceName: 'Isparta' },
  { name: 'Uluborlu', normalized: 'uluborlu', provinceCode: 32, provinceName: 'Isparta' },
  { name: 'Yalvaç', normalized: 'yalvac', provinceCode: 32, provinceName: 'Isparta' },
  { name: 'Yeni̇şarbademli̇', normalized: 'yenisarbademli', provinceCode: 32, provinceName: 'Isparta' },

  // MERSİN (33)
  { name: 'Akdeni̇z', normalized: 'akdeniz', provinceCode: 33, provinceName: 'Mersin' },
  { name: 'Anamur', normalized: 'anamur', provinceCode: 33, provinceName: 'Mersin' },
  { name: 'Aydincik', normalized: 'aydincik', provinceCode: 33, provinceName: 'Mersin' },
  { name: 'Bozyazi', normalized: 'bozyazi', provinceCode: 33, provinceName: 'Mersin' },
  { name: 'Çamliyayla', normalized: 'camliyayla', provinceCode: 33, provinceName: 'Mersin' },
  { name: 'Erdemli̇', normalized: 'erdemli', provinceCode: 33, provinceName: 'Mersin' },
  { name: 'Gülnar', normalized: 'gulnar', provinceCode: 33, provinceName: 'Mersin' },
  { name: 'Mezi̇tli̇', normalized: 'mezitli', provinceCode: 33, provinceName: 'Mersin' },
  { name: 'Mut', normalized: 'mut', provinceCode: 33, provinceName: 'Mersin' },
  { name: 'Si̇li̇fke', normalized: 'silifke', provinceCode: 33, provinceName: 'Mersin' },
  { name: 'Tarsus', normalized: 'tarsus', provinceCode: 33, provinceName: 'Mersin' },
  { name: 'Toroslar', normalized: 'toroslar', provinceCode: 33, provinceName: 'Mersin' },
  { name: 'Yeni̇şehi̇r', normalized: 'yenisehir', provinceCode: 33, provinceName: 'Mersin' },

  // İSTANBUL (34)
  { name: 'Adalar', normalized: 'adalar', provinceCode: 34, provinceName: 'Istanbul' },
  { name: 'Arnavutköy', normalized: 'arnavutkoy', provinceCode: 34, provinceName: 'Istanbul' },
  { name: 'Hadımköy', normalized: 'hadimkoy', provinceCode: 34, provinceName: 'Istanbul' }, // Popular industrial area in Arnavutköy
  { name: 'Ataşehi̇r', normalized: 'atasehir', provinceCode: 34, provinceName: 'Istanbul' },
  { name: 'Avcilar', normalized: 'avcilar', provinceCode: 34, provinceName: 'Istanbul' },
  { name: 'Bağcilar', normalized: 'bagcilar', provinceCode: 34, provinceName: 'Istanbul' },
  { name: 'Bahçeli̇evler', normalized: 'bahcelievler', provinceCode: 34, provinceName: 'Istanbul' },
  { name: 'Bakirköy', normalized: 'bakirkoy', provinceCode: 34, provinceName: 'Istanbul' },
  { name: 'Başakşehi̇r', normalized: 'basaksehir', provinceCode: 34, provinceName: 'Istanbul' },
  { name: 'Bayrampaşa', normalized: 'bayrampasa', provinceCode: 34, provinceName: 'Istanbul' },
  { name: 'Beşi̇ktaş', normalized: 'besiktas', provinceCode: 34, provinceName: 'Istanbul' },
  { name: 'Beykoz', normalized: 'beykoz', provinceCode: 34, provinceName: 'Istanbul' },
  { name: 'Beyli̇kdüzü', normalized: 'beylikduzu', provinceCode: 34, provinceName: 'Istanbul' },
  { name: 'Beyoğlu', normalized: 'beyoglu', provinceCode: 34, provinceName: 'Istanbul' },
  { name: 'Büyükçekmece', normalized: 'buyukcekmece', provinceCode: 34, provinceName: 'Istanbul' },
  { name: 'Çatalca', normalized: 'catalca', provinceCode: 34, provinceName: 'Istanbul' },
  { name: 'Çekmeköy', normalized: 'cekmekoy', provinceCode: 34, provinceName: 'Istanbul' },
  { name: 'Esenler', normalized: 'esenler', provinceCode: 34, provinceName: 'Istanbul' },
  { name: 'Esenyurt', normalized: 'esenyurt', provinceCode: 34, provinceName: 'Istanbul' },
  { name: 'Eyüpsultan', normalized: 'eyupsultan', provinceCode: 34, provinceName: 'Istanbul' },
  { name: 'Fati̇h', normalized: 'fatih', provinceCode: 34, provinceName: 'Istanbul' },
  { name: 'Gazi̇osmanpaşa', normalized: 'gaziosmanpasa', provinceCode: 34, provinceName: 'Istanbul' },
  { name: 'Güngören', normalized: 'gungoren', provinceCode: 34, provinceName: 'Istanbul' },
  { name: 'Kadiköy', normalized: 'kadikoy', provinceCode: 34, provinceName: 'Istanbul' },
  { name: 'Kağithane', normalized: 'kagithane', provinceCode: 34, provinceName: 'Istanbul' },
  { name: 'Kartal', normalized: 'kartal', provinceCode: 34, provinceName: 'Istanbul' },
  { name: 'Küçükçekmece', normalized: 'kucukcekmece', provinceCode: 34, provinceName: 'Istanbul' },
  { name: 'Maltepe', normalized: 'maltepe', provinceCode: 34, provinceName: 'Istanbul' },
  { name: 'Pendi̇k', normalized: 'pendik', provinceCode: 34, provinceName: 'Istanbul' },
  { name: 'Sancaktepe', normalized: 'sancaktepe', provinceCode: 34, provinceName: 'Istanbul' },
  { name: 'Sariyer', normalized: 'sariyer', provinceCode: 34, provinceName: 'Istanbul' },
  { name: 'Si̇li̇vri̇', normalized: 'silivri', provinceCode: 34, provinceName: 'Istanbul' },
  { name: 'Sultanbeyli̇', normalized: 'sultanbeyli', provinceCode: 34, provinceName: 'Istanbul' },
  { name: 'Sultangazi̇', normalized: 'sultangazi', provinceCode: 34, provinceName: 'Istanbul' },
  { name: 'Şi̇le', normalized: 'sile', provinceCode: 34, provinceName: 'Istanbul' },
  { name: 'Şi̇şli̇', normalized: 'sisli', provinceCode: 34, provinceName: 'Istanbul' },
  { name: 'Tuzla', normalized: 'tuzla', provinceCode: 34, provinceName: 'Istanbul' },
  { name: 'Ümrani̇ye', normalized: 'umraniye', provinceCode: 34, provinceName: 'Istanbul' },
  { name: 'Üsküdar', normalized: 'uskudar', provinceCode: 34, provinceName: 'Istanbul' },
  { name: 'Zeyti̇nburnu', normalized: 'zeytinburnu', provinceCode: 34, provinceName: 'Istanbul' },

  // İZMİR (35)
  { name: 'Ali̇ağa', normalized: 'aliaga', provinceCode: 35, provinceName: 'Izmir' },
  { name: 'Balçova', normalized: 'balcova', provinceCode: 35, provinceName: 'Izmir' },
  { name: 'Bayindir', normalized: 'bayindir', provinceCode: 35, provinceName: 'Izmir' },
  { name: 'Bayrakli', normalized: 'bayrakli', provinceCode: 35, provinceName: 'Izmir' },
  { name: 'Bergama', normalized: 'bergama', provinceCode: 35, provinceName: 'Izmir' },
  { name: 'Beydağ', normalized: 'beydag', provinceCode: 35, provinceName: 'Izmir' },
  { name: 'Bornova', normalized: 'bornova', provinceCode: 35, provinceName: 'Izmir' },
  { name: 'Buca', normalized: 'buca', provinceCode: 35, provinceName: 'Izmir' },
  { name: 'Çeşme', normalized: 'cesme', provinceCode: 35, provinceName: 'Izmir' },
  { name: 'Çi̇ğli̇', normalized: 'cigli', provinceCode: 35, provinceName: 'Izmir' },
  { name: 'Di̇ki̇li̇', normalized: 'dikili', provinceCode: 35, provinceName: 'Izmir' },
  { name: 'Foça', normalized: 'foca', provinceCode: 35, provinceName: 'Izmir' },
  { name: 'Gazi̇emi̇r', normalized: 'gaziemir', provinceCode: 35, provinceName: 'Izmir' },
  { name: 'Güzelbahçe', normalized: 'guzelbahce', provinceCode: 35, provinceName: 'Izmir' },
  { name: 'Karabağlar', normalized: 'karabaglar', provinceCode: 35, provinceName: 'Izmir' },
  { name: 'Karaburun', normalized: 'karaburun', provinceCode: 35, provinceName: 'Izmir' },
  { name: 'Karşiyaka', normalized: 'karsiyaka', provinceCode: 35, provinceName: 'Izmir' },
  { name: 'Kemalpaşa', normalized: 'kemalpasa', provinceCode: 35, provinceName: 'Izmir' },
  { name: 'Kinik', normalized: 'kinik', provinceCode: 35, provinceName: 'Izmir' },
  { name: 'Ki̇raz', normalized: 'kiraz', provinceCode: 35, provinceName: 'Izmir' },
  { name: 'Konak', normalized: 'konak', provinceCode: 35, provinceName: 'Izmir' },
  { name: 'Menderes', normalized: 'menderes', provinceCode: 35, provinceName: 'Izmir' },
  { name: 'Menemen', normalized: 'menemen', provinceCode: 35, provinceName: 'Izmir' },
  { name: 'Narlidere', normalized: 'narlidere', provinceCode: 35, provinceName: 'Izmir' },
  { name: 'Ödemi̇ş', normalized: 'odemis', provinceCode: 35, provinceName: 'Izmir' },
  { name: 'Seferi̇hi̇sar', normalized: 'seferihisar', provinceCode: 35, provinceName: 'Izmir' },
  { name: 'Selçuk', normalized: 'selcuk', provinceCode: 35, provinceName: 'Izmir' },
  { name: 'Ti̇re', normalized: 'tire', provinceCode: 35, provinceName: 'Izmir' },
  { name: 'Torbali', normalized: 'torbali', provinceCode: 35, provinceName: 'Izmir' },
  { name: 'Urla', normalized: 'urla', provinceCode: 35, provinceName: 'Izmir' },

  // KARS (36)
  { name: 'Akyaka', normalized: 'akyaka', provinceCode: 36, provinceName: 'Kars' },
  { name: 'Arpaçay', normalized: 'arpacay', provinceCode: 36, provinceName: 'Kars' },
  { name: 'Di̇gor', normalized: 'digor', provinceCode: 36, provinceName: 'Kars' },
  { name: 'Kağizman', normalized: 'kagizman', provinceCode: 36, provinceName: 'Kars' },
  { name: 'Sarikamiş', normalized: 'sarikamis', provinceCode: 36, provinceName: 'Kars' },
  { name: 'Seli̇m', normalized: 'selim', provinceCode: 36, provinceName: 'Kars' },
  { name: 'Susuz', normalized: 'susuz', provinceCode: 36, provinceName: 'Kars' },

  // KASTAMONU (37)
  { name: 'Abana', normalized: 'abana', provinceCode: 37, provinceName: 'Kastamonu' },
  { name: 'Ağli', normalized: 'agli', provinceCode: 37, provinceName: 'Kastamonu' },
  { name: 'Araç', normalized: 'arac', provinceCode: 37, provinceName: 'Kastamonu' },
  { name: 'Azdavay', normalized: 'azdavay', provinceCode: 37, provinceName: 'Kastamonu' },
  { name: 'Bozkurt', normalized: 'bozkurt', provinceCode: 37, provinceName: 'Kastamonu' },
  { name: 'Ci̇de', normalized: 'cide', provinceCode: 37, provinceName: 'Kastamonu' },
  { name: 'Çatalzeyti̇n', normalized: 'catalzeytin', provinceCode: 37, provinceName: 'Kastamonu' },
  { name: 'Daday', normalized: 'daday', provinceCode: 37, provinceName: 'Kastamonu' },
  { name: 'Devrekani̇', normalized: 'devrekani', provinceCode: 37, provinceName: 'Kastamonu' },
  { name: 'Doğanyurt', normalized: 'doganyurt', provinceCode: 37, provinceName: 'Kastamonu' },
  { name: 'Hanönü', normalized: 'hanonu', provinceCode: 37, provinceName: 'Kastamonu' },
  { name: 'İhsangazi̇', normalized: 'ihsangazi', provinceCode: 37, provinceName: 'Kastamonu' },
  { name: 'İnebolu', normalized: 'inebolu', provinceCode: 37, provinceName: 'Kastamonu' },
  { name: 'Küre', normalized: 'kure', provinceCode: 37, provinceName: 'Kastamonu' },
  { name: 'Pinarbaşi', normalized: 'pinarbasi', provinceCode: 37, provinceName: 'Kastamonu' },
  { name: 'Seydi̇ler', normalized: 'seydiler', provinceCode: 37, provinceName: 'Kastamonu' },
  { name: 'Şenpazar', normalized: 'senpazar', provinceCode: 37, provinceName: 'Kastamonu' },
  { name: 'Taşköprü', normalized: 'taskopru', provinceCode: 37, provinceName: 'Kastamonu' },
  { name: 'Tosya', normalized: 'tosya', provinceCode: 37, provinceName: 'Kastamonu' },

  // KAYSERİ (38)
  { name: 'Akkişla', normalized: 'akkisla', provinceCode: 38, provinceName: 'Kayseri' },
  { name: 'Bünyan', normalized: 'bunyan', provinceCode: 38, provinceName: 'Kayseri' },
  { name: 'Develi̇', normalized: 'develi', provinceCode: 38, provinceName: 'Kayseri' },
  { name: 'Felahi̇ye', normalized: 'felahiye', provinceCode: 38, provinceName: 'Kayseri' },
  { name: 'Hacilar', normalized: 'hacilar', provinceCode: 38, provinceName: 'Kayseri' },
  { name: 'İncesu', normalized: 'incesu', provinceCode: 38, provinceName: 'Kayseri' },
  { name: 'Kocasi̇nan', normalized: 'kocasinan', provinceCode: 38, provinceName: 'Kayseri' },
  { name: 'Meli̇kgazi̇', normalized: 'melikgazi', provinceCode: 38, provinceName: 'Kayseri' },
  { name: 'Özvatan', normalized: 'ozvatan', provinceCode: 38, provinceName: 'Kayseri' },
  { name: 'Pinarbaşi', normalized: 'pinarbasi', provinceCode: 38, provinceName: 'Kayseri' },
  { name: 'Sarioğlan', normalized: 'sarioglan', provinceCode: 38, provinceName: 'Kayseri' },
  { name: 'Sariz', normalized: 'sariz', provinceCode: 38, provinceName: 'Kayseri' },
  { name: 'Talas', normalized: 'talas', provinceCode: 38, provinceName: 'Kayseri' },
  { name: 'Tomarza', normalized: 'tomarza', provinceCode: 38, provinceName: 'Kayseri' },
  { name: 'Yahyali', normalized: 'yahyali', provinceCode: 38, provinceName: 'Kayseri' },
  { name: 'Yeşi̇lhi̇sar', normalized: 'yesilhisar', provinceCode: 38, provinceName: 'Kayseri' },

  // KIRKLARELİ (39)
  { name: 'Babaeski̇', normalized: 'babaeski', provinceCode: 39, provinceName: 'Kirklareli' },
  { name: 'Demi̇rköy', normalized: 'demirkoy', provinceCode: 39, provinceName: 'Kirklareli' },
  { name: 'Kofçaz', normalized: 'kofcaz', provinceCode: 39, provinceName: 'Kirklareli' },
  { name: 'Lüleburgaz', normalized: 'luleburgaz', provinceCode: 39, provinceName: 'Kirklareli' },
  { name: 'Pehli̇vanköy', normalized: 'pehlivankoy', provinceCode: 39, provinceName: 'Kirklareli' },
  { name: 'Pinarhi̇sar', normalized: 'pinarhisar', provinceCode: 39, provinceName: 'Kirklareli' },
  { name: 'Vi̇ze', normalized: 'vize', provinceCode: 39, provinceName: 'Kirklareli' },

  // KIRŞEHİR (40)
  { name: 'Akçakent', normalized: 'akcakent', provinceCode: 40, provinceName: 'Kirsehir' },
  { name: 'Akpinar', normalized: 'akpinar', provinceCode: 40, provinceName: 'Kirsehir' },
  { name: 'Boztepe', normalized: 'boztepe', provinceCode: 40, provinceName: 'Kirsehir' },
  { name: 'Çi̇çekdaği', normalized: 'cicekdagi', provinceCode: 40, provinceName: 'Kirsehir' },
  { name: 'Kaman', normalized: 'kaman', provinceCode: 40, provinceName: 'Kirsehir' },
  { name: 'Mucur', normalized: 'mucur', provinceCode: 40, provinceName: 'Kirsehir' },

  // KOCAELİ (41)
  { name: 'Başi̇skele', normalized: 'basiskele', provinceCode: 41, provinceName: 'Kocaeli' },
  { name: 'Çayirova', normalized: 'cayirova', provinceCode: 41, provinceName: 'Kocaeli' },
  { name: 'Darica', normalized: 'darica', provinceCode: 41, provinceName: 'Kocaeli' },
  { name: 'Deri̇nce', normalized: 'derince', provinceCode: 41, provinceName: 'Kocaeli' },
  { name: 'Di̇lovasi', normalized: 'dilovasi', provinceCode: 41, provinceName: 'Kocaeli' },
  { name: 'Gebze', normalized: 'gebze', provinceCode: 41, provinceName: 'Kocaeli' },
  { name: 'Gölcük', normalized: 'golcuk', provinceCode: 41, provinceName: 'Kocaeli' },
  { name: 'İzmi̇t', normalized: 'izmit', provinceCode: 41, provinceName: 'Kocaeli' },
  { name: 'Kandira', normalized: 'kandira', provinceCode: 41, provinceName: 'Kocaeli' },
  { name: 'Karamürsel', normalized: 'karamursel', provinceCode: 41, provinceName: 'Kocaeli' },
  { name: 'Kartepe', normalized: 'kartepe', provinceCode: 41, provinceName: 'Kocaeli' },
  { name: 'Körfez', normalized: 'korfez', provinceCode: 41, provinceName: 'Kocaeli' },

  // KONYA (42)
  { name: 'Ahirli', normalized: 'ahirli', provinceCode: 42, provinceName: 'Konya' },
  { name: 'Akören', normalized: 'akoren', provinceCode: 42, provinceName: 'Konya' },
  { name: 'Akşehi̇r', normalized: 'aksehir', provinceCode: 42, provinceName: 'Konya' },
  { name: 'Altineki̇n', normalized: 'altinekin', provinceCode: 42, provinceName: 'Konya' },
  { name: 'Beyşehi̇r', normalized: 'beysehir', provinceCode: 42, provinceName: 'Konya' },
  { name: 'Bozkir', normalized: 'bozkir', provinceCode: 42, provinceName: 'Konya' },
  { name: 'Ci̇hanbeyli̇', normalized: 'cihanbeyli', provinceCode: 42, provinceName: 'Konya' },
  { name: 'Çelti̇k', normalized: 'celtik', provinceCode: 42, provinceName: 'Konya' },
  { name: 'Çumra', normalized: 'cumra', provinceCode: 42, provinceName: 'Konya' },
  { name: 'Derbent', normalized: 'derbent', provinceCode: 42, provinceName: 'Konya' },
  { name: 'Derebucak', normalized: 'derebucak', provinceCode: 42, provinceName: 'Konya' },
  { name: 'Doğanhi̇sar', normalized: 'doganhisar', provinceCode: 42, provinceName: 'Konya' },
  { name: 'Emi̇rgazi̇', normalized: 'emirgazi', provinceCode: 42, provinceName: 'Konya' },
  { name: 'Ereğli̇', normalized: 'eregli', provinceCode: 42, provinceName: 'Konya' },
  { name: 'Güneysinir', normalized: 'guneysinir', provinceCode: 42, provinceName: 'Konya' },
  { name: 'Hadi̇m', normalized: 'hadim', provinceCode: 42, provinceName: 'Konya' },
  { name: 'Halkapinar', normalized: 'halkapinar', provinceCode: 42, provinceName: 'Konya' },
  { name: 'Hüyük', normalized: 'huyuk', provinceCode: 42, provinceName: 'Konya' },
  { name: 'Ilgin', normalized: 'ilgin', provinceCode: 42, provinceName: 'Konya' },
  { name: 'Kadinhani', normalized: 'kadinhani', provinceCode: 42, provinceName: 'Konya' },
  { name: 'Karapinar', normalized: 'karapinar', provinceCode: 42, provinceName: 'Konya' },
  { name: 'Karatay', normalized: 'karatay', provinceCode: 42, provinceName: 'Konya' },
  { name: 'Kulu', normalized: 'kulu', provinceCode: 42, provinceName: 'Konya' },
  { name: 'Meram', normalized: 'meram', provinceCode: 42, provinceName: 'Konya' },
  { name: 'Sarayönü', normalized: 'sarayonu', provinceCode: 42, provinceName: 'Konya' },
  { name: 'Selçuklu', normalized: 'selcuklu', provinceCode: 42, provinceName: 'Konya' },
  { name: 'Seydi̇şehi̇r', normalized: 'seydisehir', provinceCode: 42, provinceName: 'Konya' },
  { name: 'Taşkent', normalized: 'taskent', provinceCode: 42, provinceName: 'Konya' },
  { name: 'Tuzlukçu', normalized: 'tuzlukcu', provinceCode: 42, provinceName: 'Konya' },
  { name: 'Yalihüyük', normalized: 'yalihuyuk', provinceCode: 42, provinceName: 'Konya' },
  { name: 'Yunak', normalized: 'yunak', provinceCode: 42, provinceName: 'Konya' },

  // KÜTAHYA (43)
  { name: 'Altintaş', normalized: 'altintas', provinceCode: 43, provinceName: 'Kutahya' },
  { name: 'Aslanapa', normalized: 'aslanapa', provinceCode: 43, provinceName: 'Kutahya' },
  { name: 'Çavdarhi̇sar', normalized: 'cavdarhisar', provinceCode: 43, provinceName: 'Kutahya' },
  { name: 'Domani̇ç', normalized: 'domanic', provinceCode: 43, provinceName: 'Kutahya' },
  { name: 'Dumlupinar', normalized: 'dumlupinar', provinceCode: 43, provinceName: 'Kutahya' },
  { name: 'Emet', normalized: 'emet', provinceCode: 43, provinceName: 'Kutahya' },
  { name: 'Gedi̇z', normalized: 'gediz', provinceCode: 43, provinceName: 'Kutahya' },
  { name: 'Hi̇sarcik', normalized: 'hisarcik', provinceCode: 43, provinceName: 'Kutahya' },
  { name: 'Pazarlar', normalized: 'pazarlar', provinceCode: 43, provinceName: 'Kutahya' },
  { name: 'Si̇mav', normalized: 'simav', provinceCode: 43, provinceName: 'Kutahya' },
  { name: 'Şaphane', normalized: 'saphane', provinceCode: 43, provinceName: 'Kutahya' },
  { name: 'Tavşanli', normalized: 'tavsanli', provinceCode: 43, provinceName: 'Kutahya' },

  // MALATYA (44)
  { name: 'Akçadağ', normalized: 'akcadag', provinceCode: 44, provinceName: 'Malatya' },
  { name: 'Arapgi̇r', normalized: 'arapgir', provinceCode: 44, provinceName: 'Malatya' },
  { name: 'Arguvan', normalized: 'arguvan', provinceCode: 44, provinceName: 'Malatya' },
  { name: 'Battalgazi̇', normalized: 'battalgazi', provinceCode: 44, provinceName: 'Malatya' },
  { name: 'Darende', normalized: 'darende', provinceCode: 44, provinceName: 'Malatya' },
  { name: 'Doğanşehi̇r', normalized: 'dogansehir', provinceCode: 44, provinceName: 'Malatya' },
  { name: 'Doğanyol', normalized: 'doganyol', provinceCode: 44, provinceName: 'Malatya' },
  { name: 'Heki̇mhan', normalized: 'hekimhan', provinceCode: 44, provinceName: 'Malatya' },
  { name: 'Kale', normalized: 'kale', provinceCode: 44, provinceName: 'Malatya' },
  { name: 'Kuluncak', normalized: 'kuluncak', provinceCode: 44, provinceName: 'Malatya' },
  { name: 'Pütürge', normalized: 'puturge', provinceCode: 44, provinceName: 'Malatya' },
  { name: 'Yazihan', normalized: 'yazihan', provinceCode: 44, provinceName: 'Malatya' },
  { name: 'Yeşi̇lyurt', normalized: 'yesilyurt', provinceCode: 44, provinceName: 'Malatya' },

  // MANİSA (45)
  { name: 'Ahmetli̇', normalized: 'ahmetli', provinceCode: 45, provinceName: 'Manisa' },
  { name: 'Akhi̇sar', normalized: 'akhisar', provinceCode: 45, provinceName: 'Manisa' },
  { name: 'Alaşehi̇r', normalized: 'alasehir', provinceCode: 45, provinceName: 'Manisa' },
  { name: 'Demi̇rci̇', normalized: 'demirci', provinceCode: 45, provinceName: 'Manisa' },
  { name: 'Gölmarmara', normalized: 'golmarmara', provinceCode: 45, provinceName: 'Manisa' },
  { name: 'Gördes', normalized: 'gordes', provinceCode: 45, provinceName: 'Manisa' },
  { name: 'Kirkağaç', normalized: 'kirkagac', provinceCode: 45, provinceName: 'Manisa' },
  { name: 'Köprübaşi', normalized: 'koprubasi', provinceCode: 45, provinceName: 'Manisa' },
  { name: 'Kula', normalized: 'kula', provinceCode: 45, provinceName: 'Manisa' },
  { name: 'Sali̇hli̇', normalized: 'salihli', provinceCode: 45, provinceName: 'Manisa' },
  { name: 'Sarigöl', normalized: 'sarigol', provinceCode: 45, provinceName: 'Manisa' },
  { name: 'Saruhanli', normalized: 'saruhanli', provinceCode: 45, provinceName: 'Manisa' },
  { name: 'Selendi̇', normalized: 'selendi', provinceCode: 45, provinceName: 'Manisa' },
  { name: 'Soma', normalized: 'soma', provinceCode: 45, provinceName: 'Manisa' },
  { name: 'Şehzadeler', normalized: 'sehzadeler', provinceCode: 45, provinceName: 'Manisa' },
  { name: 'Turgutlu', normalized: 'turgutlu', provinceCode: 45, provinceName: 'Manisa' },
  { name: 'Yunusemre', normalized: 'yunusemre', provinceCode: 45, provinceName: 'Manisa' },

  // KAHRAMANMARAŞ (46)
  { name: 'Afşi̇n', normalized: 'afsin', provinceCode: 46, provinceName: 'Kahramanmaras' },
  { name: 'Andirin', normalized: 'andirin', provinceCode: 46, provinceName: 'Kahramanmaras' },
  { name: 'Çağlayanceri̇t', normalized: 'caglayancerit', provinceCode: 46, provinceName: 'Kahramanmaras' },
  { name: 'Dulkadi̇roğlu', normalized: 'dulkadiroglu', provinceCode: 46, provinceName: 'Kahramanmaras' },
  { name: 'Eki̇nözü', normalized: 'ekinozu', provinceCode: 46, provinceName: 'Kahramanmaras' },
  { name: 'Elbi̇stan', normalized: 'elbistan', provinceCode: 46, provinceName: 'Kahramanmaras' },
  { name: 'Göksun', normalized: 'goksun', provinceCode: 46, provinceName: 'Kahramanmaras' },
  { name: 'Nurhak', normalized: 'nurhak', provinceCode: 46, provinceName: 'Kahramanmaras' },
  { name: 'Oni̇ki̇şubat', normalized: 'onikisubat', provinceCode: 46, provinceName: 'Kahramanmaras' },
  { name: 'Pazarcik', normalized: 'pazarcik', provinceCode: 46, provinceName: 'Kahramanmaras' },
  { name: 'Türkoğlu', normalized: 'turkoglu', provinceCode: 46, provinceName: 'Kahramanmaras' },

  // MARDİN (47)
  { name: 'Artuklu', normalized: 'artuklu', provinceCode: 47, provinceName: 'Mardin' },
  { name: 'Dargeçi̇t', normalized: 'dargecit', provinceCode: 47, provinceName: 'Mardin' },
  { name: 'Deri̇k', normalized: 'derik', provinceCode: 47, provinceName: 'Mardin' },
  { name: 'Kiziltepe', normalized: 'kiziltepe', provinceCode: 47, provinceName: 'Mardin' },
  { name: 'Mazidaği', normalized: 'mazidagi', provinceCode: 47, provinceName: 'Mardin' },
  { name: 'Mi̇dyat', normalized: 'midyat', provinceCode: 47, provinceName: 'Mardin' },
  { name: 'Nusaybi̇n', normalized: 'nusaybin', provinceCode: 47, provinceName: 'Mardin' },
  { name: 'Ömerli̇', normalized: 'omerli', provinceCode: 47, provinceName: 'Mardin' },
  { name: 'Savur', normalized: 'savur', provinceCode: 47, provinceName: 'Mardin' },
  { name: 'Yeşi̇lli̇', normalized: 'yesilli', provinceCode: 47, provinceName: 'Mardin' },

  // MUĞLA (48)
  { name: 'Bodrum', normalized: 'bodrum', provinceCode: 48, provinceName: 'Mugla' },
  { name: 'Dalaman', normalized: 'dalaman', provinceCode: 48, provinceName: 'Mugla' },
  { name: 'Datça', normalized: 'datca', provinceCode: 48, provinceName: 'Mugla' },
  { name: 'Fethi̇ye', normalized: 'fethiye', provinceCode: 48, provinceName: 'Mugla' },
  { name: 'Kavaklidere', normalized: 'kavaklidere', provinceCode: 48, provinceName: 'Mugla' },
  { name: 'Köyceği̇z', normalized: 'koycegiz', provinceCode: 48, provinceName: 'Mugla' },
  { name: 'Marmari̇s', normalized: 'marmaris', provinceCode: 48, provinceName: 'Mugla' },
  { name: 'Menteşe', normalized: 'mentese', provinceCode: 48, provinceName: 'Mugla' },
  { name: 'Mi̇las', normalized: 'milas', provinceCode: 48, provinceName: 'Mugla' },
  { name: 'Ortaca', normalized: 'ortaca', provinceCode: 48, provinceName: 'Mugla' },
  { name: 'Seydi̇kemer', normalized: 'seydikemer', provinceCode: 48, provinceName: 'Mugla' },
  { name: 'Ula', normalized: 'ula', provinceCode: 48, provinceName: 'Mugla' },
  { name: 'Yatağan', normalized: 'yatagan', provinceCode: 48, provinceName: 'Mugla' },

  // MUŞ (49)
  { name: 'Bulanik', normalized: 'bulanik', provinceCode: 49, provinceName: 'Mus' },
  { name: 'Hasköy', normalized: 'haskoy', provinceCode: 49, provinceName: 'Mus' },
  { name: 'Korkut', normalized: 'korkut', provinceCode: 49, provinceName: 'Mus' },
  { name: 'Malazgi̇rt', normalized: 'malazgirt', provinceCode: 49, provinceName: 'Mus' },
  { name: 'Varto', normalized: 'varto', provinceCode: 49, provinceName: 'Mus' },

  // NEVŞEHİR (50)
  { name: 'Acigöl', normalized: 'acigol', provinceCode: 50, provinceName: 'Nevsehir' },
  { name: 'Avanos', normalized: 'avanos', provinceCode: 50, provinceName: 'Nevsehir' },
  { name: 'Deri̇nkuyu', normalized: 'derinkuyu', provinceCode: 50, provinceName: 'Nevsehir' },
  { name: 'Gülşehi̇r', normalized: 'gulsehir', provinceCode: 50, provinceName: 'Nevsehir' },
  { name: 'Hacibektaş', normalized: 'hacibektas', provinceCode: 50, provinceName: 'Nevsehir' },
  { name: 'Kozakli', normalized: 'kozakli', provinceCode: 50, provinceName: 'Nevsehir' },
  { name: 'Ürgüp', normalized: 'urgup', provinceCode: 50, provinceName: 'Nevsehir' },

  // NİĞDE (51)
  { name: 'Altunhi̇sar', normalized: 'altunhisar', provinceCode: 51, provinceName: 'Nigde' },
  { name: 'Bor', normalized: 'bor', provinceCode: 51, provinceName: 'Nigde' },
  { name: 'Çamardi', normalized: 'camardi', provinceCode: 51, provinceName: 'Nigde' },
  { name: 'Çi̇ftli̇k', normalized: 'ciftlik', provinceCode: 51, provinceName: 'Nigde' },
  { name: 'Ulukişla', normalized: 'ulukisla', provinceCode: 51, provinceName: 'Nigde' },

  // ORDU (52)
  { name: 'Akkuş', normalized: 'akkus', provinceCode: 52, provinceName: 'Ordu' },
  { name: 'Altinordu', normalized: 'altinordu', provinceCode: 52, provinceName: 'Ordu' },
  { name: 'Aybasti', normalized: 'aybasti', provinceCode: 52, provinceName: 'Ordu' },
  { name: 'Çamaş', normalized: 'camas', provinceCode: 52, provinceName: 'Ordu' },
  { name: 'Çatalpinar', normalized: 'catalpinar', provinceCode: 52, provinceName: 'Ordu' },
  { name: 'Çaybaşi', normalized: 'caybasi', provinceCode: 52, provinceName: 'Ordu' },
  { name: 'Fatsa', normalized: 'fatsa', provinceCode: 52, provinceName: 'Ordu' },
  { name: 'Gölköy', normalized: 'golkoy', provinceCode: 52, provinceName: 'Ordu' },
  { name: 'Gülyali', normalized: 'gulyali', provinceCode: 52, provinceName: 'Ordu' },
  { name: 'Gürgentepe', normalized: 'gurgentepe', provinceCode: 52, provinceName: 'Ordu' },
  { name: 'İki̇zce', normalized: 'ikizce', provinceCode: 52, provinceName: 'Ordu' },
  { name: 'Kabadüz', normalized: 'kabaduz', provinceCode: 52, provinceName: 'Ordu' },
  { name: 'Kabataş', normalized: 'kabatas', provinceCode: 52, provinceName: 'Ordu' },
  { name: 'Korgan', normalized: 'korgan', provinceCode: 52, provinceName: 'Ordu' },
  { name: 'Kumru', normalized: 'kumru', provinceCode: 52, provinceName: 'Ordu' },
  { name: 'Mesudi̇ye', normalized: 'mesudiye', provinceCode: 52, provinceName: 'Ordu' },
  { name: 'Perşembe', normalized: 'persembe', provinceCode: 52, provinceName: 'Ordu' },
  { name: 'Ulubey', normalized: 'ulubey', provinceCode: 52, provinceName: 'Ordu' },
  { name: 'Ünye', normalized: 'unye', provinceCode: 52, provinceName: 'Ordu' },

  // RİZE (53)
  { name: 'Ardeşen', normalized: 'ardesen', provinceCode: 53, provinceName: 'Rize' },
  { name: 'Çamlihemşi̇n', normalized: 'camlihemsin', provinceCode: 53, provinceName: 'Rize' },
  { name: 'Çayeli̇', normalized: 'cayeli', provinceCode: 53, provinceName: 'Rize' },
  { name: 'Derepazari', normalized: 'derepazari', provinceCode: 53, provinceName: 'Rize' },
  { name: 'Findikli', normalized: 'findikli', provinceCode: 53, provinceName: 'Rize' },
  { name: 'Güneysu', normalized: 'guneysu', provinceCode: 53, provinceName: 'Rize' },
  { name: 'Hemşi̇n', normalized: 'hemsin', provinceCode: 53, provinceName: 'Rize' },
  { name: 'İki̇zdere', normalized: 'ikizdere', provinceCode: 53, provinceName: 'Rize' },
  { name: 'İyi̇dere', normalized: 'iyidere', provinceCode: 53, provinceName: 'Rize' },
  { name: 'Kalkandere', normalized: 'kalkandere', provinceCode: 53, provinceName: 'Rize' },
  { name: 'Pazar', normalized: 'pazar', provinceCode: 53, provinceName: 'Rize' },

  // SAKARYA (54)
  { name: 'Adapazari', normalized: 'adapazari', provinceCode: 54, provinceName: 'Sakarya' },
  { name: 'Akyazi', normalized: 'akyazi', provinceCode: 54, provinceName: 'Sakarya' },
  { name: 'Ari̇fi̇ye', normalized: 'arifiye', provinceCode: 54, provinceName: 'Sakarya' },
  { name: 'Erenler', normalized: 'erenler', provinceCode: 54, provinceName: 'Sakarya' },
  { name: 'Feri̇zli̇', normalized: 'ferizli', provinceCode: 54, provinceName: 'Sakarya' },
  { name: 'Geyve', normalized: 'geyve', provinceCode: 54, provinceName: 'Sakarya' },
  { name: 'Hendek', normalized: 'hendek', provinceCode: 54, provinceName: 'Sakarya' },
  { name: 'Karapürçek', normalized: 'karapurcek', provinceCode: 54, provinceName: 'Sakarya' },
  { name: 'Karasu', normalized: 'karasu', provinceCode: 54, provinceName: 'Sakarya' },
  { name: 'Kaynarca', normalized: 'kaynarca', provinceCode: 54, provinceName: 'Sakarya' },
  { name: 'Kocaali̇', normalized: 'kocaali', provinceCode: 54, provinceName: 'Sakarya' },
  { name: 'Pamukova', normalized: 'pamukova', provinceCode: 54, provinceName: 'Sakarya' },
  { name: 'Sapanca', normalized: 'sapanca', provinceCode: 54, provinceName: 'Sakarya' },
  { name: 'Serdi̇van', normalized: 'serdivan', provinceCode: 54, provinceName: 'Sakarya' },
  { name: 'Söğütlü', normalized: 'sogutlu', provinceCode: 54, provinceName: 'Sakarya' },
  { name: 'Tarakli', normalized: 'tarakli', provinceCode: 54, provinceName: 'Sakarya' },

  // SAMSUN (55)
  { name: '19 Mayis', normalized: '19 mayis', provinceCode: 55, provinceName: 'Samsun' },
  { name: 'Alaçam', normalized: 'alacam', provinceCode: 55, provinceName: 'Samsun' },
  { name: 'Asarcik', normalized: 'asarcik', provinceCode: 55, provinceName: 'Samsun' },
  { name: 'Atakum', normalized: 'atakum', provinceCode: 55, provinceName: 'Samsun' },
  { name: 'Ayvacik', normalized: 'ayvacik', provinceCode: 55, provinceName: 'Samsun' },
  { name: 'Bafra', normalized: 'bafra', provinceCode: 55, provinceName: 'Samsun' },
  { name: 'Cani̇k', normalized: 'canik', provinceCode: 55, provinceName: 'Samsun' },
  { name: 'Çarşamba', normalized: 'carsamba', provinceCode: 55, provinceName: 'Samsun' },
  { name: 'Havza', normalized: 'havza', provinceCode: 55, provinceName: 'Samsun' },
  { name: 'İlkadim', normalized: 'ilkadim', provinceCode: 55, provinceName: 'Samsun' },
  { name: 'Kavak', normalized: 'kavak', provinceCode: 55, provinceName: 'Samsun' },
  { name: 'Ladi̇k', normalized: 'ladik', provinceCode: 55, provinceName: 'Samsun' },
  { name: 'Salipazari', normalized: 'salipazari', provinceCode: 55, provinceName: 'Samsun' },
  { name: 'Tekkeköy', normalized: 'tekkekoy', provinceCode: 55, provinceName: 'Samsun' },
  { name: 'Terme', normalized: 'terme', provinceCode: 55, provinceName: 'Samsun' },
  { name: 'Vezi̇rköprü', normalized: 'vezirkopru', provinceCode: 55, provinceName: 'Samsun' },
  { name: 'Yakakent', normalized: 'yakakent', provinceCode: 55, provinceName: 'Samsun' },

  // SİİRT (56)
  { name: 'Baykan', normalized: 'baykan', provinceCode: 56, provinceName: 'Siirt' },
  { name: 'Eruh', normalized: 'eruh', provinceCode: 56, provinceName: 'Siirt' },
  { name: 'Kurtalan', normalized: 'kurtalan', provinceCode: 56, provinceName: 'Siirt' },
  { name: 'Pervari̇', normalized: 'pervari', provinceCode: 56, provinceName: 'Siirt' },
  { name: 'Şi̇rvan', normalized: 'sirvan', provinceCode: 56, provinceName: 'Siirt' },
  { name: 'Ti̇llo', normalized: 'tillo', provinceCode: 56, provinceName: 'Siirt' },

  // SİNOP (57)
  { name: 'Ayancik', normalized: 'ayancik', provinceCode: 57, provinceName: 'Sinop' },
  { name: 'Boyabat', normalized: 'boyabat', provinceCode: 57, provinceName: 'Sinop' },
  { name: 'Di̇kmen', normalized: 'dikmen', provinceCode: 57, provinceName: 'Sinop' },
  { name: 'Durağan', normalized: 'duragan', provinceCode: 57, provinceName: 'Sinop' },
  { name: 'Erfelek', normalized: 'erfelek', provinceCode: 57, provinceName: 'Sinop' },
  { name: 'Gerze', normalized: 'gerze', provinceCode: 57, provinceName: 'Sinop' },
  { name: 'Saraydüzü', normalized: 'sarayduzu', provinceCode: 57, provinceName: 'Sinop' },
  { name: 'Türkeli̇', normalized: 'turkeli', provinceCode: 57, provinceName: 'Sinop' },

  // SİVAS (58)
  { name: 'Akincilar', normalized: 'akincilar', provinceCode: 58, provinceName: 'Sivas' },
  { name: 'Altinyayla', normalized: 'altinyayla', provinceCode: 58, provinceName: 'Sivas' },
  { name: 'Di̇vri̇ği̇', normalized: 'divrigi', provinceCode: 58, provinceName: 'Sivas' },
  { name: 'Doğanşar', normalized: 'dogansar', provinceCode: 58, provinceName: 'Sivas' },
  { name: 'Gemerek', normalized: 'gemerek', provinceCode: 58, provinceName: 'Sivas' },
  { name: 'Gölova', normalized: 'golova', provinceCode: 58, provinceName: 'Sivas' },
  { name: 'Gürün', normalized: 'gurun', provinceCode: 58, provinceName: 'Sivas' },
  { name: 'Hafi̇k', normalized: 'hafik', provinceCode: 58, provinceName: 'Sivas' },
  { name: 'İmranli', normalized: 'imranli', provinceCode: 58, provinceName: 'Sivas' },
  { name: 'Kangal', normalized: 'kangal', provinceCode: 58, provinceName: 'Sivas' },
  { name: 'Koyulhi̇sar', normalized: 'koyulhisar', provinceCode: 58, provinceName: 'Sivas' },
  { name: 'Suşehri̇', normalized: 'susehri', provinceCode: 58, provinceName: 'Sivas' },
  { name: 'Şarkişla', normalized: 'sarkisla', provinceCode: 58, provinceName: 'Sivas' },
  { name: 'Ulaş', normalized: 'ulas', provinceCode: 58, provinceName: 'Sivas' },
  { name: 'Yildizeli̇', normalized: 'yildizeli', provinceCode: 58, provinceName: 'Sivas' },
  { name: 'Zara', normalized: 'zara', provinceCode: 58, provinceName: 'Sivas' },

  // TEKİRDAĞ (59)
  { name: 'Çerkezköy', normalized: 'cerkezkoy', provinceCode: 59, provinceName: 'Tekirdag' },
  { name: 'Çorlu', normalized: 'corlu', provinceCode: 59, provinceName: 'Tekirdag' },
  { name: 'Ergene', normalized: 'ergene', provinceCode: 59, provinceName: 'Tekirdag' },
  { name: 'Hayrabolu', normalized: 'hayrabolu', provinceCode: 59, provinceName: 'Tekirdag' },
  { name: 'Kapakli', normalized: 'kapakli', provinceCode: 59, provinceName: 'Tekirdag' },
  { name: 'Malkara', normalized: 'malkara', provinceCode: 59, provinceName: 'Tekirdag' },
  { name: 'Marmaraereğli̇si̇', normalized: 'marmaraereglisi', provinceCode: 59, provinceName: 'Tekirdag' },
  { name: 'Muratli', normalized: 'muratli', provinceCode: 59, provinceName: 'Tekirdag' },
  { name: 'Saray', normalized: 'saray', provinceCode: 59, provinceName: 'Tekirdag' },
  { name: 'Süleymanpaşa', normalized: 'suleymanpasa', provinceCode: 59, provinceName: 'Tekirdag' },
  { name: 'Şarköy', normalized: 'sarkoy', provinceCode: 59, provinceName: 'Tekirdag' },

  // TOKAT (60)
  { name: 'Almus', normalized: 'almus', provinceCode: 60, provinceName: 'Tokat' },
  { name: 'Artova', normalized: 'artova', provinceCode: 60, provinceName: 'Tokat' },
  { name: 'Başçi̇ftli̇k', normalized: 'basciftlik', provinceCode: 60, provinceName: 'Tokat' },
  { name: 'Erbaa', normalized: 'erbaa', provinceCode: 60, provinceName: 'Tokat' },
  { name: 'Ni̇ksar', normalized: 'niksar', provinceCode: 60, provinceName: 'Tokat' },
  { name: 'Pazar', normalized: 'pazar', provinceCode: 60, provinceName: 'Tokat' },
  { name: 'Reşadi̇ye', normalized: 'resadiye', provinceCode: 60, provinceName: 'Tokat' },
  { name: 'Sulusaray', normalized: 'sulusaray', provinceCode: 60, provinceName: 'Tokat' },
  { name: 'Turhal', normalized: 'turhal', provinceCode: 60, provinceName: 'Tokat' },
  { name: 'Yeşi̇lyurt', normalized: 'yesilyurt', provinceCode: 60, provinceName: 'Tokat' },
  { name: 'Zi̇le', normalized: 'zile', provinceCode: 60, provinceName: 'Tokat' },

  // TRABZON (61)
  { name: 'Akçaabat', normalized: 'akcaabat', provinceCode: 61, provinceName: 'Trabzon' },
  { name: 'Arakli', normalized: 'arakli', provinceCode: 61, provinceName: 'Trabzon' },
  { name: 'Arsi̇n', normalized: 'arsin', provinceCode: 61, provinceName: 'Trabzon' },
  { name: 'Beşi̇kdüzü', normalized: 'besikduzu', provinceCode: 61, provinceName: 'Trabzon' },
  { name: 'Çarşibaşi', normalized: 'carsibasi', provinceCode: 61, provinceName: 'Trabzon' },
  { name: 'Çaykara', normalized: 'caykara', provinceCode: 61, provinceName: 'Trabzon' },
  { name: 'Dernekpazari', normalized: 'dernekpazari', provinceCode: 61, provinceName: 'Trabzon' },
  { name: 'Düzköy', normalized: 'duzkoy', provinceCode: 61, provinceName: 'Trabzon' },
  { name: 'Hayrat', normalized: 'hayrat', provinceCode: 61, provinceName: 'Trabzon' },
  { name: 'Köprübaşi', normalized: 'koprubasi', provinceCode: 61, provinceName: 'Trabzon' },
  { name: 'Maçka', normalized: 'macka', provinceCode: 61, provinceName: 'Trabzon' },
  { name: 'Of', normalized: 'of', provinceCode: 61, provinceName: 'Trabzon' },
  { name: 'Ortahi̇sar', normalized: 'ortahisar', provinceCode: 61, provinceName: 'Trabzon' },
  { name: 'Sürmene', normalized: 'surmene', provinceCode: 61, provinceName: 'Trabzon' },
  { name: 'Şalpazari', normalized: 'salpazari', provinceCode: 61, provinceName: 'Trabzon' },
  { name: 'Tonya', normalized: 'tonya', provinceCode: 61, provinceName: 'Trabzon' },
  { name: 'Vakfikebi̇r', normalized: 'vakfikebir', provinceCode: 61, provinceName: 'Trabzon' },
  { name: 'Yomra', normalized: 'yomra', provinceCode: 61, provinceName: 'Trabzon' },

  // TUNCELİ (62)
  { name: 'Çemi̇şgezek', normalized: 'cemisgezek', provinceCode: 62, provinceName: 'Tunceli' },
  { name: 'Hozat', normalized: 'hozat', provinceCode: 62, provinceName: 'Tunceli' },
  { name: 'Mazgi̇rt', normalized: 'mazgirt', provinceCode: 62, provinceName: 'Tunceli' },
  { name: 'Nazimi̇ye', normalized: 'nazimiye', provinceCode: 62, provinceName: 'Tunceli' },
  { name: 'Ovacik', normalized: 'ovacik', provinceCode: 62, provinceName: 'Tunceli' },
  { name: 'Pertek', normalized: 'pertek', provinceCode: 62, provinceName: 'Tunceli' },
  { name: 'Pülümür', normalized: 'pulumur', provinceCode: 62, provinceName: 'Tunceli' },

  // ŞANLIURFA (63)
  { name: 'Akçakale', normalized: 'akcakale', provinceCode: 63, provinceName: 'Sanliurfa' },
  { name: 'Bi̇reci̇k', normalized: 'birecik', provinceCode: 63, provinceName: 'Sanliurfa' },
  { name: 'Bozova', normalized: 'bozova', provinceCode: 63, provinceName: 'Sanliurfa' },
  { name: 'Ceylanpinar', normalized: 'ceylanpinar', provinceCode: 63, provinceName: 'Sanliurfa' },
  { name: 'Eyyübi̇ye', normalized: 'eyyubiye', provinceCode: 63, provinceName: 'Sanliurfa' },
  { name: 'Halfeti̇', normalized: 'halfeti', provinceCode: 63, provinceName: 'Sanliurfa' },
  { name: 'Hali̇li̇ye', normalized: 'haliliye', provinceCode: 63, provinceName: 'Sanliurfa' },
  { name: 'Harran', normalized: 'harran', provinceCode: 63, provinceName: 'Sanliurfa' },
  { name: 'Hi̇lvan', normalized: 'hilvan', provinceCode: 63, provinceName: 'Sanliurfa' },
  { name: 'Karaköprü', normalized: 'karakopru', provinceCode: 63, provinceName: 'Sanliurfa' },
  { name: 'Si̇verek', normalized: 'siverek', provinceCode: 63, provinceName: 'Sanliurfa' },
  { name: 'Suruç', normalized: 'suruc', provinceCode: 63, provinceName: 'Sanliurfa' },
  { name: 'Vi̇ranşehi̇r', normalized: 'viransehir', provinceCode: 63, provinceName: 'Sanliurfa' },

  // UŞAK (64)
  { name: 'Banaz', normalized: 'banaz', provinceCode: 64, provinceName: 'Usak' },
  { name: 'Eşme', normalized: 'esme', provinceCode: 64, provinceName: 'Usak' },
  { name: 'Karahalli', normalized: 'karahalli', provinceCode: 64, provinceName: 'Usak' },
  { name: 'Si̇vasli', normalized: 'sivasli', provinceCode: 64, provinceName: 'Usak' },
  { name: 'Ulubey', normalized: 'ulubey', provinceCode: 64, provinceName: 'Usak' },

  // VAN (65)
  { name: 'Bahçesaray', normalized: 'bahcesaray', provinceCode: 65, provinceName: 'Van' },
  { name: 'Başkale', normalized: 'baskale', provinceCode: 65, provinceName: 'Van' },
  { name: 'Çaldiran', normalized: 'caldiran', provinceCode: 65, provinceName: 'Van' },
  { name: 'Çatak', normalized: 'catak', provinceCode: 65, provinceName: 'Van' },
  { name: 'Edremi̇t', normalized: 'edremit', provinceCode: 65, provinceName: 'Van' },
  { name: 'Erci̇ş', normalized: 'ercis', provinceCode: 65, provinceName: 'Van' },
  { name: 'Gevaş', normalized: 'gevas', provinceCode: 65, provinceName: 'Van' },
  { name: 'Gürpinar', normalized: 'gurpinar', provinceCode: 65, provinceName: 'Van' },
  { name: 'İpekyolu', normalized: 'ipekyolu', provinceCode: 65, provinceName: 'Van' },
  { name: 'Muradi̇ye', normalized: 'muradiye', provinceCode: 65, provinceName: 'Van' },
  { name: 'Özalp', normalized: 'ozalp', provinceCode: 65, provinceName: 'Van' },
  { name: 'Saray', normalized: 'saray', provinceCode: 65, provinceName: 'Van' },
  { name: 'Tuşba', normalized: 'tusba', provinceCode: 65, provinceName: 'Van' },

  // YOZGAT (66)
  { name: 'Akdağmadeni̇', normalized: 'akdagmadeni', provinceCode: 66, provinceName: 'Yozgat' },
  { name: 'Aydincik', normalized: 'aydincik', provinceCode: 66, provinceName: 'Yozgat' },
  { name: 'Boğazliyan', normalized: 'bogazliyan', provinceCode: 66, provinceName: 'Yozgat' },
  { name: 'Çandir', normalized: 'candir', provinceCode: 66, provinceName: 'Yozgat' },
  { name: 'Çayiralan', normalized: 'cayiralan', provinceCode: 66, provinceName: 'Yozgat' },
  { name: 'Çekerek', normalized: 'cekerek', provinceCode: 66, provinceName: 'Yozgat' },
  { name: 'Kadişehri̇', normalized: 'kadisehri', provinceCode: 66, provinceName: 'Yozgat' },
  { name: 'Saraykent', normalized: 'saraykent', provinceCode: 66, provinceName: 'Yozgat' },
  { name: 'Sarikaya', normalized: 'sarikaya', provinceCode: 66, provinceName: 'Yozgat' },
  { name: 'Sorgun', normalized: 'sorgun', provinceCode: 66, provinceName: 'Yozgat' },
  { name: 'Şefaatli̇', normalized: 'sefaatli', provinceCode: 66, provinceName: 'Yozgat' },
  { name: 'Yeni̇fakili', normalized: 'yenifakili', provinceCode: 66, provinceName: 'Yozgat' },
  { name: 'Yerköy', normalized: 'yerkoy', provinceCode: 66, provinceName: 'Yozgat' },

  // ZONGULDAK (67)
  { name: 'Alapli', normalized: 'alapli', provinceCode: 67, provinceName: 'Zonguldak' },
  { name: 'Çaycuma', normalized: 'caycuma', provinceCode: 67, provinceName: 'Zonguldak' },
  { name: 'Devrek', normalized: 'devrek', provinceCode: 67, provinceName: 'Zonguldak' },
  { name: 'Ereğli̇', normalized: 'eregli', provinceCode: 67, provinceName: 'Zonguldak' },
  { name: 'Gökçebey', normalized: 'gokcebey', provinceCode: 67, provinceName: 'Zonguldak' },
  { name: 'Ki̇li̇mli̇', normalized: 'kilimli', provinceCode: 67, provinceName: 'Zonguldak' },
  { name: 'Kozlu', normalized: 'kozlu', provinceCode: 67, provinceName: 'Zonguldak' },

  // AKSARAY (68)
  { name: 'Ağaçören', normalized: 'agacoren', provinceCode: 68, provinceName: 'Aksaray' },
  { name: 'Eski̇l', normalized: 'eskil', provinceCode: 68, provinceName: 'Aksaray' },
  { name: 'Gülağaç', normalized: 'gulagac', provinceCode: 68, provinceName: 'Aksaray' },
  { name: 'Güzelyurt', normalized: 'guzelyurt', provinceCode: 68, provinceName: 'Aksaray' },
  { name: 'Ortaköy', normalized: 'ortakoy', provinceCode: 68, provinceName: 'Aksaray' },
  { name: 'Sariyahşi̇', normalized: 'sariyahsi', provinceCode: 68, provinceName: 'Aksaray' },
  { name: 'Sultanhani', normalized: 'sultanhani', provinceCode: 68, provinceName: 'Aksaray' },

  // BAYBURT (69)
  { name: 'Aydintepe', normalized: 'aydintepe', provinceCode: 69, provinceName: 'Bayburt' },
  { name: 'Demi̇rözü', normalized: 'demirozu', provinceCode: 69, provinceName: 'Bayburt' },

  // KARAMAN (70)
  { name: 'Ayranci', normalized: 'ayranci', provinceCode: 70, provinceName: 'Karaman' },
  { name: 'Başyayla', normalized: 'basyayla', provinceCode: 70, provinceName: 'Karaman' },
  { name: 'Ermenek', normalized: 'ermenek', provinceCode: 70, provinceName: 'Karaman' },
  { name: 'Kazimkarabeki̇r', normalized: 'kazimkarabekir', provinceCode: 70, provinceName: 'Karaman' },
  { name: 'Sariveli̇ler', normalized: 'sariveliler', provinceCode: 70, provinceName: 'Karaman' },

  // KIRIKKALE (71)
  { name: 'Bahşili', normalized: 'bahsili', provinceCode: 71, provinceName: 'Kirikkale' },
  { name: 'Balişeyh', normalized: 'baliseyh', provinceCode: 71, provinceName: 'Kirikkale' },
  { name: 'Çelebi̇', normalized: 'celebi', provinceCode: 71, provinceName: 'Kirikkale' },
  { name: 'Deli̇ce', normalized: 'delice', provinceCode: 71, provinceName: 'Kirikkale' },
  { name: 'Karakeçi̇li̇', normalized: 'karakecili', provinceCode: 71, provinceName: 'Kirikkale' },
  { name: 'Keski̇n', normalized: 'keskin', provinceCode: 71, provinceName: 'Kirikkale' },
  { name: 'Sulakyurt', normalized: 'sulakyurt', provinceCode: 71, provinceName: 'Kirikkale' },
  { name: 'Yahşi̇han', normalized: 'yahsihan', provinceCode: 71, provinceName: 'Kirikkale' },

  // BATMAN (72)
  { name: 'Beşi̇ri̇', normalized: 'besiri', provinceCode: 72, provinceName: 'Batman' },
  { name: 'Gercüş', normalized: 'gercus', provinceCode: 72, provinceName: 'Batman' },
  { name: 'Hasankeyf', normalized: 'hasankeyf', provinceCode: 72, provinceName: 'Batman' },
  { name: 'Kozluk', normalized: 'kozluk', provinceCode: 72, provinceName: 'Batman' },
  { name: 'Sason', normalized: 'sason', provinceCode: 72, provinceName: 'Batman' },

  // ŞIRNAK (73)
  { name: 'Beytüşşebap', normalized: 'beytussebap', provinceCode: 73, provinceName: 'Sirnak' },
  { name: 'Ci̇zre', normalized: 'cizre', provinceCode: 73, provinceName: 'Sirnak' },
  { name: 'Güçlükonak', normalized: 'guclukonak', provinceCode: 73, provinceName: 'Sirnak' },
  { name: 'İdi̇l', normalized: 'idil', provinceCode: 73, provinceName: 'Sirnak' },
  { name: 'Si̇lopi̇', normalized: 'silopi', provinceCode: 73, provinceName: 'Sirnak' },
  { name: 'Uludere', normalized: 'uludere', provinceCode: 73, provinceName: 'Sirnak' },

  // BARTIN (74)
  { name: 'Amasra', normalized: 'amasra', provinceCode: 74, provinceName: 'Bartin' },
  { name: 'Kurucaşi̇le', normalized: 'kurucasile', provinceCode: 74, provinceName: 'Bartin' },
  { name: 'Ulus', normalized: 'ulus', provinceCode: 74, provinceName: 'Bartin' },

  // ARDAHAN (75)
  { name: 'Çildir', normalized: 'cildir', provinceCode: 75, provinceName: 'Ardahan' },
  { name: 'Damal', normalized: 'damal', provinceCode: 75, provinceName: 'Ardahan' },
  { name: 'Göle', normalized: 'gole', provinceCode: 75, provinceName: 'Ardahan' },
  { name: 'Hanak', normalized: 'hanak', provinceCode: 75, provinceName: 'Ardahan' },
  { name: 'Posof', normalized: 'posof', provinceCode: 75, provinceName: 'Ardahan' },

  // IĞDIR (76)
  { name: 'Aralik', normalized: 'aralik', provinceCode: 76, provinceName: 'Igdir' },
  { name: 'Karakoyunlu', normalized: 'karakoyunlu', provinceCode: 76, provinceName: 'Igdir' },
  { name: 'Tuzluca', normalized: 'tuzluca', provinceCode: 76, provinceName: 'Igdir' },

  // YALOVA (77)
  { name: 'Altinova', normalized: 'altinova', provinceCode: 77, provinceName: 'Yalova' },
  { name: 'Armutlu', normalized: 'armutlu', provinceCode: 77, provinceName: 'Yalova' },
  { name: 'Çinarcik', normalized: 'cinarcik', provinceCode: 77, provinceName: 'Yalova' },
  { name: 'Çi̇ftli̇kköy', normalized: 'ciftlikkoy', provinceCode: 77, provinceName: 'Yalova' },
  { name: 'Termal', normalized: 'termal', provinceCode: 77, provinceName: 'Yalova' },

  // KARABÜK (78)
  { name: 'Eflani̇', normalized: 'eflani', provinceCode: 78, provinceName: 'Karabuk' },
  { name: 'Eski̇pazar', normalized: 'eskipazar', provinceCode: 78, provinceName: 'Karabuk' },
  { name: 'Ovacik', normalized: 'ovacik', provinceCode: 78, provinceName: 'Karabuk' },
  { name: 'Safranbolu', normalized: 'safranbolu', provinceCode: 78, provinceName: 'Karabuk' },
  { name: 'Yeni̇ce', normalized: 'yenice', provinceCode: 78, provinceName: 'Karabuk' },

  // KİLİS (79)
  { name: 'Elbeyli̇', normalized: 'elbeyli', provinceCode: 79, provinceName: 'Kilis' },
  { name: 'Musabeyli̇', normalized: 'musabeyli', provinceCode: 79, provinceName: 'Kilis' },
  { name: 'Polateli̇', normalized: 'polateli', provinceCode: 79, provinceName: 'Kilis' },

  // OSMANİYE (80)
  { name: 'Bahçe', normalized: 'bahce', provinceCode: 80, provinceName: 'Osmaniye' },
  { name: 'Düzi̇çi̇', normalized: 'duzici', provinceCode: 80, provinceName: 'Osmaniye' },
  { name: 'Hasanbeyli̇', normalized: 'hasanbeyli', provinceCode: 80, provinceName: 'Osmaniye' },
  { name: 'Kadi̇rli̇', normalized: 'kadirli', provinceCode: 80, provinceName: 'Osmaniye' },
  { name: 'Sumbas', normalized: 'sumbas', provinceCode: 80, provinceName: 'Osmaniye' },
  { name: 'Toprakkale', normalized: 'toprakkale', provinceCode: 80, provinceName: 'Osmaniye' },

  // DÜZCE (81)
  { name: 'Akçakoca', normalized: 'akcakoca', provinceCode: 81, provinceName: 'Duzce' },
  { name: 'Cumayeri̇', normalized: 'cumayeri', provinceCode: 81, provinceName: 'Duzce' },
  { name: 'Çi̇li̇mli̇', normalized: 'cilimli', provinceCode: 81, provinceName: 'Duzce' },
  { name: 'Gölyaka', normalized: 'golyaka', provinceCode: 81, provinceName: 'Duzce' },
  { name: 'Gümüşova', normalized: 'gumusova', provinceCode: 81, provinceName: 'Duzce' },
  { name: 'Kaynaşli', normalized: 'kaynasli', provinceCode: 81, provinceName: 'Duzce' },
  { name: 'Yiğilca', normalized: 'yigilca', provinceCode: 81, provinceName: 'Duzce' },

];

/**
 * Lookup map: normalized district name -> Array of Districts
 * Some districts exist in multiple provinces, so we return an array
 */
export const DISTRICTS_BY_NAME: Map<string, District[]> = new Map();

// Build lookup map
for (const district of DISTRICTS) {
  const existing = DISTRICTS_BY_NAME.get(district.normalized) || [];
  existing.push(district);
  DISTRICTS_BY_NAME.set(district.normalized, existing);
}

/**
 * Set of all normalized district names for fast lookup
 */
export const DISTRICT_NAMES: Set<string> = new Set(DISTRICTS_BY_NAME.keys());

/**
 * Set of district names that exist in multiple provinces
 */
export const AMBIGUOUS_DISTRICT_NAMES: Set<string> = new Set(
  [...DISTRICTS_BY_NAME.entries()]
    .filter(([_, districts]) => districts.length > 1)
    .map(([name, _]) => name)
);

/**
 * Get all districts matching a normalized name
 * Returns empty array if not found
 */
export function getDistrictsByName(name: string): District[] {
  return DISTRICTS_BY_NAME.get(name.toLowerCase()) || [];
}

/**
 * Get a single district by name (returns first match for ambiguous names)
 * @deprecated Use getDistrictsByName for proper ambiguity handling
 */
export function getDistrictByName(name: string): District | undefined {
  const districts = getDistrictsByName(name);
  return districts[0];
}

/**
 * Check if a string is a valid district name
 */
export function isDistrictName(name: string): boolean {
  return DISTRICT_NAMES.has(name.toLowerCase());
}

/**
 * Check if a district name is ambiguous (exists in multiple provinces)
 */
export function isAmbiguousDistrict(name: string): boolean {
  return AMBIGUOUS_DISTRICT_NAMES.has(name.toLowerCase());
}

/**
 * Get all districts for a given province code
 */
export function getDistrictsByProvinceCode(provinceCode: number): District[] {
  return DISTRICTS.filter((d) => d.provinceCode === provinceCode);
}
