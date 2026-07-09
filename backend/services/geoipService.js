// GeoIP servisi - ip-api.com kullanarak IP adresinin cografi/ISP bilgilerini getirir.
// Ucretsiz katman bir API anahtari gerektirmez.

const GEOIP_BASE_URL = process.env.GEOIP_BASE_URL || 'http://ip-api.com/json';
const REQUEST_TIMEOUT_MS = 5000;

/**
 * fetch cagrisini belirli bir sure sonra iptal eden yardimci fonksiyon.
 */
async function fetchWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Verilen IP adresi icin GeoIP bilgilerini (ulke, sehir, ISP) getirir.
 * Servis erisilemez veya IP gecersizse null degerli alanlarla birlikte
 * bir hata mesaji dondurur, exception firlatmaz.
 * @param {string} ip
 * @returns {Promise<{country: string|null, city: string|null, isp: string|null, error: string|null}>}
 */
async function getGeoIpInfo(ip) {
  const emptyResult = { country: null, city: null, isp: null, error: null };

  if (!ip) {
    return { ...emptyResult, error: 'IP adresi bulunamadi.' };
  }

  try {
    const url = `${GEOIP_BASE_URL}/${ip}?fields=status,message,country,city,isp,query`;
    const response = await fetchWithTimeout(url, REQUEST_TIMEOUT_MS);

    if (!response.ok) {
      return { ...emptyResult, error: `GeoIP servisi ${response.status} durum kodu dondurdu.` };
    }

    const data = await response.json();

    if (data.status !== 'success') {
      return { ...emptyResult, error: data.message || 'GeoIP sorgusu basarisiz oldu.' };
    }

    return {
      country: data.country || null,
      city: data.city || null,
      isp: data.isp || null,
      error: null,
    };
  } catch (err) {
    const message = err.name === 'AbortError' ? 'GeoIP servisi zaman asimina ugradi.' : 'GeoIP servisine erisilemedi.';
    return { ...emptyResult, error: message };
  }
}

module.exports = { getGeoIpInfo };
