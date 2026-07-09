// Ham email header metnini islenebilir hale getiren yardimci fonksiyonlar.

/**
 * RFC 5322'ye gore bir header degeri birden fazla satira "katlanabilir" (folding).
 * Devam satirlari bosluk/tab ile baslar. Bu fonksiyon katlanmis satirlari
 * tek bir mantiksal satira birlestirir.
 */
function unfoldHeader(rawHeader) {
  const normalized = rawHeader.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized.split('\n');
  const unfolded = [];

  lines.forEach((line) => {
    if (/^[ \t]/.test(line) && unfolded.length > 0) {
      // Onceki satirin devami: bosluklarla birlestir
      unfolded[unfolded.length - 1] += ` ${line.trim()}`;
    } else {
      unfolded.push(line);
    }
  });

  return unfolded;
}

/**
 * Unfold edilmis satirlari { name, value } ciftlerine ayirir.
 * Header blogu bos satira (boş satır = header/body ayraci) rastlarsa durur.
 */
function parseHeaderLines(rawHeader) {
  const lines = unfoldHeader(rawHeader);
  const result = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];

    if (line.trim() === '') break; // Header blogu bitti (body baslangici)

    const separatorIndex = line.indexOf(':');
    if (separatorIndex === -1) continue; // Gecersiz/parse edilemeyen satir, atla

    const name = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();

    if (name) {
      result.push({ name, value });
    }
  }

  return result;
}

/**
 * Verilen header adiyla (case-insensitive) eslesen ilk degeri dondurur.
 */
function findFirstHeaderValue(headerLines, name) {
  const match = headerLines.find((h) => h.name.toLowerCase() === name.toLowerCase());
  return match ? match.value : null;
}

/**
 * Verilen header adiyla (case-insensitive) eslesen tum degerleri, orijinal
 * sirayla dondurur.
 */
function findAllHeaderValues(headerLines, name) {
  return headerLines
    .filter((h) => h.name.toLowerCase() === name.toLowerCase())
    .map((h) => h.value);
}

module.exports = {
  unfoldHeader,
  parseHeaderLines,
  findFirstHeaderValue,
  findAllHeaderValues,
};
