// RFC 2047 encoded-word cozucu (ornek: =?UTF-8?B?VMO8cmvDp2U=?=)
// Subject gibi alanlarda gecen kodlanmis metinleri okunabilir hale getirir.

const ENCODED_WORD_REGEX = /=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g;

function decodeQuotedPrintableWord(text) {
  // Encoded-word icindeki '_' karakteri bosluk anlamina gelir (RFC 2047)
  const withSpaces = text.replace(/_/g, ' ');
  const bytes = [];

  for (let i = 0; i < withSpaces.length; i += 1) {
    if (withSpaces[i] === '=' && i + 2 < withSpaces.length) {
      const hex = withSpaces.slice(i + 1, i + 3);
      if (/^[0-9A-Fa-f]{2}$/.test(hex)) {
        bytes.push(parseInt(hex, 16));
        i += 2;
        continue;
      }
    }
    bytes.push(withSpaces.charCodeAt(i));
  }

  return Buffer.from(bytes);
}

function decodeToCharset(buffer, charset) {
  try {
    return new TextDecoder(charset).decode(buffer);
  } catch (err) {
    // Desteklenmeyen/bilinmeyen charset durumunda UTF-8'e geri don
    return buffer.toString('utf8');
  }
}

/**
 * Header degerlerinde gecen RFC 2047 encoded-word bloklarini insan tarafindan
 * okunabilir metne cevirir. Kodlama bulunamazsa metni oldugu gibi dondurur.
 */
function decodeMimeWords(rawValue) {
  if (!rawValue || typeof rawValue !== 'string') return rawValue;

  return rawValue.replace(ENCODED_WORD_REGEX, (match, charset, encoding, encodedText) => {
    try {
      let buffer;
      if (encoding.toLowerCase() === 'b') {
        buffer = Buffer.from(encodedText, 'base64');
      } else {
        buffer = decodeQuotedPrintableWord(encodedText);
      }
      return decodeToCharset(buffer, charset);
    } catch (err) {
      return match; // Cozulemezse orijinal metni koru
    }
  });
}

module.exports = { decodeMimeWords };
