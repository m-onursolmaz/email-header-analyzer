// /api/analyze route'u
// Gonderilen ham email header metnini parse edip yapilandirilmis sonuc dondurur.

const express = require('express');
const { parseHeaders } = require('../services/headerParser');
const { findOriginatingIp } = require('../utils/ipUtils');
const { reverseDnsLookup } = require('../services/dnsService');
const { getGeoIpInfo } = require('../services/geoipService');
const { checkAbuseIpDb } = require('../services/abuseIpDbService');
const { calculateRiskScore } = require('../services/riskScoreService');

const router = express.Router();

const MAX_HEADER_LENGTH = 200000; // Asiri buyuk girdilere karsi makul bir ust sinir

// Girdinin gercek bir email header oldugunu varsaymadan once, bu alanlardan
// en az birinin (satir basinda) bulunmasi beklenir.
const REQUIRED_HEADER_FIELD_PATTERN = /^(received|from|return-path|subject|message-id|date|authentication-results):/im;
const INVALID_HEADER_MESSAGE = 'Geçerli bir email header tespit edilemedi. Lütfen ham (raw) email header bilgisini yapıştırın.';

router.post('/', async (req, res, next) => {
  try {
    const { rawHeader } = req.body;

    if (!rawHeader || typeof rawHeader !== 'string' || !rawHeader.trim()) {
      return res.status(400).json({ error: 'Gecerli bir email header metni gonderilmedi.' });
    }

    if (rawHeader.length > MAX_HEADER_LENGTH) {
      return res.status(400).json({ error: 'Header metni cok uzun.' });
    }

    if (!REQUIRED_HEADER_FIELD_PATTERN.test(rawHeader)) {
      return res.status(400).json({ error: INVALID_HEADER_MESSAGE });
    }

    const parsed = parseHeaders(rawHeader);
    const { ip: senderIp, source: senderIpSource } = findOriginatingIp(parsed.received);

    // Reverse DNS, GeoIP ve AbuseIPDB sorgulari birbirinden bagimsiz oldugu icin paralel calistirilir
    const [reverseDns, geoIp, abuseIpDb] = await Promise.all([
      reverseDnsLookup(senderIp),
      getGeoIpInfo(senderIp),
      checkAbuseIpDb(senderIp),
    ]);

    const riskScore = calculateRiskScore({
      authResults: parsed.authResults,
      senderIp,
      reverseDns,
      abuseIpDb,
    });

    res.json({
      fields: parsed.fields,
      received: parsed.received,
      authResults: parsed.authResults,
      senderIp: {
        address: senderIp,
        source: senderIpSource,
        reverseDns,
        geoIp,
        abuseIpDb,
      },
      riskScore,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
