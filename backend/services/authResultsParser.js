// SPF / DKIM / DMARC sonuclarini header'lardan cikaran servis.
// Oncelikle "Authentication-Results" header'ina bakar (birden fazla varsa en ustteki/en yeni
// hop'a oncelik verilir), SPF icin bulunamazsa "Received-SPF" header'ina geri duser.

const { findAllHeaderValues } = require('../utils/headerUtils');

/**
 * Verilen metin icinde "anahtar=sonuc" formatindaki bir kimlik dogrulama sonucunu arar.
 * Ornek: "spf=pass (google.com: domain of ...) smtp.mailfrom=..."
 * @returns {{result: string, raw: string}|null}
 */
function extractResult(text, keyword) {
  const regex = new RegExp(`\\b${keyword}=([a-zA-Z]+)([^;]*)`, 'i');
  const match = text.match(regex);

  if (!match) return null;

  const result = match[1].toLowerCase();
  const raw = `${match[1]}${match[2]}`.trim();

  return { result, raw };
}

/**
 * "Received-SPF" header'indan SPF sonucunu okur (Authentication-Results'ta bulunamadiginda yedek yol).
 * Ornek: "Pass (google.com: domain of ... designates ...) client-ip=1.2.3.4;"
 */
function extractSpfFromReceivedSpf(headerLines) {
  const values = findAllHeaderValues(headerLines, 'Received-SPF');
  if (values.length === 0) return null;

  const value = values[0];
  const wordMatch = value.match(/^([a-zA-Z]+)/);
  if (!wordMatch) return null;

  const raw = value.trim().replace(/;\s*$/, '');
  return { result: wordMatch[1].toLowerCase(), raw };
}

const EMPTY_RESULT = { result: null, raw: null };

/**
 * Header satirlarindan SPF, DKIM ve DMARC kimlik dogrulama sonuclarini cikarir.
 * @param {Array<{name: string, value: string}>} headerLines
 * @returns {{spf: object, dkim: object, dmarc: object}}
 */
function parseAuthResults(headerLines) {
  const authResultsValues = findAllHeaderValues(headerLines, 'Authentication-Results');
  // Birden fazla Authentication-Results varsa siralarini koruyarak birlestir; ilk eslesme
  // (en ustteki/en oncelikli header) kazanir.
  const combined = authResultsValues.join('; ');

  const spfFromAuthResults = extractResult(combined, 'spf');
  const dkim = extractResult(combined, 'dkim');
  const dmarc = extractResult(combined, 'dmarc');

  const spf = spfFromAuthResults || extractSpfFromReceivedSpf(headerLines);

  return {
    spf: spf || EMPTY_RESULT,
    dkim: dkim || EMPTY_RESULT,
    dmarc: dmarc || EMPTY_RESULT,
  };
}

module.exports = { parseAuthResults };
