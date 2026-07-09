// AbuseIPDB entegrasyonu - gonderen IP'nin kotuye kullanim gecmisini sorgular.
// https://docs.abuseipdb.com/#check-endpoint

const ABUSEIPDB_CHECK_URL = 'https://api.abuseipdb.com/api/v2/check';
const REQUEST_TIMEOUT_MS = 7000;
const MAX_AGE_IN_DAYS = 90; // Son 90 gundeki raporlari dikkate al

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

const EMPTY_RESULT = {
  available: false,
  reputationScore: null,
  reportCount: null,
  lastReported: null,
  error: null,
};

/**
 * Verilen IP adresini AbuseIPDB uzerinden sorgular.
 * API anahtari tanimli degilse veya sorgu basarisiz olursa, hata firlatmadan
 * `available: false` ve aciklayici bir `error` mesaji dondurur.
 * @param {string} ip
 * @returns {Promise<{available: boolean, reputationScore: number|null, reportCount: number|null, lastReported: string|null, error: string|null}>}
 */
async function checkAbuseIpDb(ip) {
  if (!ip) {
    return { ...EMPTY_RESULT, error: 'IP adresi bulunamadi.' };
  }

  const apiKey = process.env.ABUSEIPDB_API_KEY;
  if (!apiKey) {
    return { ...EMPTY_RESULT, error: 'AbuseIPDB API anahtari yapilandirilmamis (.env dosyasina ABUSEIPDB_API_KEY ekleyin).' };
  }

  try {
    const url = `${ABUSEIPDB_CHECK_URL}?ipAddress=${encodeURIComponent(ip)}&maxAgeInDays=${MAX_AGE_IN_DAYS}`;
    const response = await fetchWithTimeout(
      url,
      { headers: { Key: apiKey, Accept: 'application/json' } },
      REQUEST_TIMEOUT_MS,
    );

    if (response.status === 401) {
      return { ...EMPTY_RESULT, error: 'AbuseIPDB API anahtari gecersiz.' };
    }
    if (response.status === 429) {
      return { ...EMPTY_RESULT, error: 'AbuseIPDB istek limiti asildi, daha sonra tekrar deneyin.' };
    }
    if (!response.ok) {
      return { ...EMPTY_RESULT, error: `AbuseIPDB servisi ${response.status} durum kodu dondurdu.` };
    }

    const body = await response.json();
    const data = body.data || {};

    return {
      available: true,
      reputationScore: typeof data.abuseConfidenceScore === 'number' ? data.abuseConfidenceScore : 0,
      reportCount: typeof data.totalReports === 'number' ? data.totalReports : 0,
      lastReported: data.lastReportedAt || null,
      error: null,
    };
  } catch (err) {
    const message = err.name === 'AbortError' ? 'AbuseIPDB servisi zaman asimina ugradi.' : 'AbuseIPDB servisine erisilemedi.';
    return { ...EMPTY_RESULT, error: message };
  }
}

module.exports = { checkAbuseIpDb };
