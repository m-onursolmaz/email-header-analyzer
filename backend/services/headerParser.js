// Email header parse servisi.
// Ham header metnini alir, temel alanlari ve Received satirlarini yapilandirilmis
// bir nesne olarak dondurur.

const { parseHeaderLines, findFirstHeaderValue, findAllHeaderValues } = require('../utils/headerUtils');
const { decodeMimeWords } = require('../utils/mimeDecoder');
const { parseAuthResults } = require('./authResultsParser');

// Tek bir kez gecmesi beklenen, dogrudan gosterilecek alanlar
const SIMPLE_FIELDS = {
  from: 'From',
  returnPath: 'Return-Path',
  replyTo: 'Reply-To',
  messageId: 'Message-ID',
  subject: 'Subject',
  date: 'Date',
  mimeVersion: 'MIME-Version',
};

/**
 * Ham email header metnini parse eder.
 * @param {string} rawHeader - Kullanicinin yapistirdigi ham header metni
 * @returns {object} Parse edilmis alanlar ve Received satirlari
 */
function parseHeaders(rawHeader) {
  const headerLines = parseHeaderLines(rawHeader);

  const fields = {};
  Object.entries(SIMPLE_FIELDS).forEach(([key, headerName]) => {
    const rawValue = findFirstHeaderValue(headerLines, headerName);
    fields[key] = rawValue ? decodeMimeWords(rawValue) : null;
  });

  // Received satirlari: header blogunda gorunme sirasiyla (en ustteki = son hop / alicinin en yakini)
  const receivedRaw = findAllHeaderValues(headerLines, 'Received');
  const received = receivedRaw.map((value, index) => ({
    order: index + 1,
    raw: value,
  }));

  const authResults = parseAuthResults(headerLines);

  return {
    fields,
    received,
    authResults,
    totalHeaderLinesFound: headerLines.length,
  };
}

module.exports = { parseHeaders };
