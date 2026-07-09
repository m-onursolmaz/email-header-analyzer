// Risk Score hesaplama servisi.
// SPF/DKIM/DMARC sonuclari, Reverse DNS varligi ve AbuseIPDB itibar puanini
// agirlikli olarak birlestirip 0-100 araliginda tek bir risk skoru uretir.
// Agirliklar en kotu senaryoda toplam tam olarak 100'e ulasacak sekilde tasarlandi:
//   SPF (max 20) + DKIM (max 15) + DMARC (max 15) + Reverse DNS (max 10) + AbuseIPDB (max 40)

const SPF_POINTS = {
  pass: 0,
  neutral: 6,
  none: 10,
  softfail: 15,
  fail: 20,
  temperror: 8,
  permerror: 8,
};
const SPF_MAX = 20;
const SPF_UNKNOWN_POINTS = 10; // Header'da SPF sonucu hic bulunamadiysa belirsizlik puani

const DKIM_POINTS = { pass: 0, fail: 15, none: 9 };
const DKIM_MAX = 15;
const DKIM_UNKNOWN_POINTS = 9;

const DMARC_POINTS = { pass: 0, fail: 15, none: 9 };
const DMARC_MAX = 15;
const DMARC_UNKNOWN_POINTS = 9;

const REVERSE_DNS_MAX = 10;
const REVERSE_DNS_MISSING_POINTS = 10; // PTR kaydi yok -> supheli
const REVERSE_DNS_UNKNOWN_POINTS = 5; // Gonderen IP tespit edilemediyse belirsizlik

const ABUSEIPDB_MAX = 40;
const ABUSEIPDB_UNAVAILABLE_POINTS = 15; // Sorgu yapilamadiysa (key yok, hata vb.) orta seviye belirsizlik

/**
 * Risk seviyesine gore renk/etiket dondurur (frontend bu bilgiyle renklendirme yapar).
 */
function getRiskLevel(score) {
  if (score <= 25) return { level: 'low', label: 'Dusuk Risk', color: 'green' };
  if (score <= 50) return { level: 'medium', label: 'Orta Risk', color: 'yellow' };
  if (score <= 75) return { level: 'high', label: 'Yuksek Risk', color: 'orange' };
  return { level: 'critical', label: 'Kritik Risk', color: 'red' };
}

/**
 * Verilen analiz sonuclarindan 0-100 araliginda bir risk skoru hesaplar.
 * @param {object} params
 * @param {object} params.authResults - { spf, dkim, dmarc } sonuclari
 * @param {string|null} params.senderIp - Tespit edilen gonderen IP
 * @param {string|null} params.reverseDns - Reverse DNS sonucu (varsa hostname)
 * @param {object} params.abuseIpDb - AbuseIPDB sorgu sonucu
 * @returns {{score: number, level: string, label: string, color: string, breakdown: Array}}
 */
function calculateRiskScore({ authResults, senderIp, reverseDns, abuseIpDb }) {
  const breakdown = [];
  let score = 0;

  // --- SPF ---
  const spfResult = authResults?.spf?.result || null;
  const spfPoints = spfResult && spfResult in SPF_POINTS ? SPF_POINTS[spfResult] : SPF_UNKNOWN_POINTS;
  score += spfPoints;
  breakdown.push({ factor: 'SPF', value: spfResult || 'bulunamadi', points: spfPoints, max: SPF_MAX });

  // --- DKIM ---
  const dkimResult = authResults?.dkim?.result || null;
  const dkimPoints = dkimResult && dkimResult in DKIM_POINTS ? DKIM_POINTS[dkimResult] : DKIM_UNKNOWN_POINTS;
  score += dkimPoints;
  breakdown.push({ factor: 'DKIM', value: dkimResult || 'bulunamadi', points: dkimPoints, max: DKIM_MAX });

  // --- DMARC ---
  const dmarcResult = authResults?.dmarc?.result || null;
  const dmarcPoints = dmarcResult && dmarcResult in DMARC_POINTS ? DMARC_POINTS[dmarcResult] : DMARC_UNKNOWN_POINTS;
  score += dmarcPoints;
  breakdown.push({ factor: 'DMARC', value: dmarcResult || 'bulunamadi', points: dmarcPoints, max: DMARC_MAX });

  // --- Reverse DNS ---
  let reverseDnsPoints;
  let reverseDnsValue;
  if (!senderIp) {
    reverseDnsPoints = REVERSE_DNS_UNKNOWN_POINTS;
    reverseDnsValue = 'gonderen IP bulunamadi';
  } else if (!reverseDns) {
    reverseDnsPoints = REVERSE_DNS_MISSING_POINTS;
    reverseDnsValue = 'PTR kaydi yok';
  } else {
    reverseDnsPoints = 0;
    reverseDnsValue = reverseDns;
  }
  score += reverseDnsPoints;
  breakdown.push({ factor: 'Reverse DNS', value: reverseDnsValue, points: reverseDnsPoints, max: REVERSE_DNS_MAX });

  // --- AbuseIPDB ---
  let abuseIpDbPoints;
  let abuseIpDbValue;
  if (abuseIpDb?.available) {
    abuseIpDbPoints = Math.round((abuseIpDb.reputationScore / 100) * ABUSEIPDB_MAX);
    abuseIpDbValue = `itibar puani: ${abuseIpDb.reputationScore}/100`;
  } else {
    abuseIpDbPoints = ABUSEIPDB_UNAVAILABLE_POINTS;
    abuseIpDbValue = 'sorgu yapilamadi';
  }
  score += abuseIpDbPoints;
  breakdown.push({ factor: 'AbuseIPDB', value: abuseIpDbValue, points: abuseIpDbPoints, max: ABUSEIPDB_MAX });

  // Guvenlik amacli sinir kontrolu (tasarim geregi zaten 0-100 arasinda kalir)
  const finalScore = Math.max(0, Math.min(100, score));
  const { level, label, color } = getRiskLevel(finalScore);

  return { score: finalScore, level, label, color, breakdown };
}

module.exports = { calculateRiskScore };
