// Reverse DNS (PTR) sorgulama servisi.

const dns = require('dns').promises;

/**
 * Verilen IP adresi icin Reverse DNS (PTR) sorgusu yapar.
 * PTR kaydi bulunamazsa veya sorgu basarisiz olursa null dondurur (hata firlatmaz).
 * @param {string} ip
 * @returns {Promise<string|null>} Hostname veya bulunamadiysa null
 */
async function reverseDnsLookup(ip) {
  if (!ip) return null;

  try {
    const hostnames = await dns.reverse(ip);
    return hostnames && hostnames.length > 0 ? hostnames[0] : null;
  } catch (err) {
    // ENOTFOUND / ENODATA: PTR kaydi yok, bu bir hata degil, normal bir durumdur
    return null;
  }
}

module.exports = { reverseDnsLookup };
