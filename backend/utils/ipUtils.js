// IP adresi tespiti ve siniflandirmasi icin yardimci fonksiyonlar.

const net = require('net');

// Aday IP metinlerini yakalamak icin gevsek bir karakter sinifi kullanilir (rakam, hex harf, ':' ve '.');
// gercek gecerlilik kontrolu Node'un yerlesik net.isIP() fonksiyonuyla yapilir. Bu sayede "17:15:18" gibi
// saat ifadeleri IPv6 sanilmaz (net.isIP saat formatini gecersiz sayar).
const IP_CANDIDATE_REGEX = /[0-9a-fA-F:.]+/g;

/**
 * Bir Received satirinda gecen tum gecerli IP adreslerini (IPv4 + IPv6), metindeki
 * gorunme sirasina gore dondurur. Gecersiz adaylar (saat, versiyon numarasi vb.) elenir.
 */
function extractAllIps(text) {
  if (!text) return [];

  const results = [];
  let match = IP_CANDIDATE_REGEX.exec(text);

  while (match !== null) {
    const candidate = match[0];

    if (net.isIP(candidate) !== 0) {
      results.push(candidate);
    }

    match = IP_CANDIDATE_REGEX.exec(text);
  }

  return results;
}

/**
 * Verilen IPv4 adresinin ozel/rezerve/local bir aralikta olup olmadigini kontrol eder.
 * (RFC 1918 ozel aliklar, loopback, link-local, dokumantasyon araliklari)
 */
function isPrivateOrReservedIpv4(ip) {
  const octets = ip.split('.').map(Number);
  const [a, b] = octets;

  if (a === 10) return true; // 10.0.0.0/8
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 127) return true; // 127.0.0.0/8 (loopback)
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 (link-local)
  if (a === 0) return true; // 0.0.0.0/8
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 (carrier-grade NAT)

  return false;
}

function isPrivateOrReservedIpv6(ip) {
  const normalized = ip.toLowerCase();
  return normalized === '::1' || normalized.startsWith('fe80:') || normalized.startsWith('fc') || normalized.startsWith('fd');
}

/**
 * Bir IP adresinin ozel/local/rezerve bir adres olup olmadigini kontrol eder
 * (IPv4 ve IPv6 destekler).
 */
function isPrivateOrReservedIp(ip) {
  if (ip.includes(':')) return isPrivateOrReservedIpv6(ip);
  return isPrivateOrReservedIpv4(ip);
}

/**
 * Received satirlari (en yeni -> en eski sirayla) icinden gercek gonderen IP'yi tahmin eder.
 * Mantik: zincirin en eski (en alttaki) halkasindan baslayarak yukari dogru tarar,
 * ilk bulunan PUBLIC (ozel olmayan) IP adresini gercek gonderen olarak kabul eder.
 * Bu, e-posta sunucularinin kendi ic aktarimlarinda (localhost, dahili NAT) kullandigi
 * ozel IP'lerin yanlislikla "gonderen" sanilmasini engeller.
 *
 * @param {Array<{order: number, raw: string}>} receivedLines - En yeniden en eskiye sirali Received satirlari
 * @returns {{ip: string|null, source: string|null}}
 */
function findOriginatingIp(receivedLines) {
  if (!Array.isArray(receivedLines) || receivedLines.length === 0) {
    return { ip: null, source: null };
  }

  // En eskiden (zincirin sonu) en yeniye dogru tara
  const reversed = [...receivedLines].sort((a, b) => b.order - a.order);

  for (const line of reversed) {
    const ips = extractAllIps(line.raw);
    const publicIp = ips.find((ip) => !isPrivateOrReservedIp(ip));
    if (publicIp) {
      return { ip: publicIp, source: `Received #${line.order}` };
    }
  }

  return { ip: null, source: null };
}

module.exports = {
  extractAllIps,
  isPrivateOrReservedIp,
  findOriginatingIp,
};
