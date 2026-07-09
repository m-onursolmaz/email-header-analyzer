// Email Header Analyzer - Frontend mantigi
// Kullanici girdisini dogrular, backend'e gonderir ve donen sonucu ekrana basar.

const headerInput = document.getElementById('headerInput');
const analyzeBtn = document.getElementById('analyzeBtn');
const clearBtn = document.getElementById('clearBtn');
const errorBox = document.getElementById('errorBox');
const loadingSection = document.getElementById('loadingSection');
const resultsSection = document.getElementById('resultsSection');

const riskScoreValueEl = document.getElementById('riskScoreValue');
const riskScoreCircleEl = document.getElementById('riskScoreCircle');
const riskLabelBadgeEl = document.getElementById('riskLabelBadge');
const riskBarFillEl = document.getElementById('riskBarFill');
const riskBreakdownEl = document.getElementById('riskBreakdown');

const fieldsTableEl = document.getElementById('fieldsTable');
const authGridEl = document.getElementById('authGrid');
const ipTableEl = document.getElementById('ipTable');
const abuseTableEl = document.getElementById('abuseTable');
const receivedListEl = document.getElementById('receivedList');

const exportJsonBtn = document.getElementById('exportJsonBtn');
const exportPdfBtn = document.getElementById('exportPdfBtn');
const clearHistoryBtn = document.getElementById('clearHistoryBtn');
const historyTableBody = document.getElementById('historyTableBody');
const historyEmptyMessage = document.getElementById('historyEmptyMessage');
const themeToggleBtn = document.getElementById('themeToggleBtn');

const HISTORY_STORAGE_KEY = 'emailHeaderAnalyzerHistory';
const HISTORY_MAX_ENTRIES = 100;

const THEME_STORAGE_KEY = 'emailHeaderAnalyzerTheme';
const THEME_CYBER_DARK = 'cyberdark';
const THEME_MIDNIGHT = 'midnight';
const THEME_LABELS = { [THEME_CYBER_DARK]: 'Cyber Dark', [THEME_MIDNIGHT]: 'Midnight' };
// Buton sadece aktif temayi temsil eden ikonu gosterir (metin yok)
const THEME_ICONS = { [THEME_CYBER_DARK]: '🌌', [THEME_MIDNIGHT]: '🌙' };

// En son basarili analiz sonucu (JSON/PDF disa aktarma icin bellekte tutulur)
let currentAnalysisData = null;

const FIELD_LABELS = {
  from: 'From',
  returnPath: 'Return-Path',
  replyTo: 'Reply-To',
  messageId: 'Message-ID',
  subject: 'Subject',
  date: 'Date',
  mimeVersion: 'MIME-Version',
};

const AUTH_LABELS = { spf: 'SPF', dkim: 'DKIM', dmarc: 'DMARC' };

/** HTML ozel karakterlerini kacirir (XSS'e karsi guvenli metin gosterimi icin). */
function escapeHtml(value) {
  const div = document.createElement('div');
  div.textContent = value;
  return div.innerHTML;
}

/** Bos/null degerler icin tutarli bir gosterim dondurur. */
function displayValue(value) {
  if (value === null || value === undefined || value === '') {
    return '<span class="field-empty">Bulunamadi</span>';
  }
  return escapeHtml(String(value));
}

/** Auth sonucuna (pass/fail/softfail/...) gore renk sinifi dondurur. */
function getAuthColorClass(result) {
  if (result === 'pass') return 'green';
  if (result === 'fail') return 'red';
  if (result === 'softfail') return 'orange';
  if (!result) return 'gray';
  return 'yellow'; // neutral, none, temperror, permerror vb.
}

function setLoading(isLoading) {
  loadingSection.classList.toggle('hidden', !isLoading);
  analyzeBtn.disabled = isLoading;
  if (isLoading) {
    resultsSection.classList.add('hidden');
    errorBox.classList.add('hidden');
  }
}

function showError(message) {
  errorBox.textContent = message;
  errorBox.classList.remove('hidden');
  resultsSection.classList.add('hidden');
}

function renderFields(fields) {
  const rows = Object.entries(FIELD_LABELS)
    .map(([key, label]) => `<tr><td>${label}</td><td>${displayValue(fields[key])}</td></tr>`)
    .join('');
  fieldsTableEl.innerHTML = rows;
}

function renderAuthResults(authResults) {
  const html = Object.entries(AUTH_LABELS)
    .map(([key, label]) => {
      const entry = authResults[key] || { result: null, raw: null };
      const colorClass = getAuthColorClass(entry.result);
      const resultText = entry.result ? entry.result.toUpperCase() : 'YOK';
      const detail = entry.raw ? escapeHtml(entry.raw) : 'Header icinde bilgi bulunamadi.';

      return `
        <div class="auth-item">
          <span class="auth-name">${label}</span>
          <span class="auth-result-badge badge-${colorClass}">${resultText}</span>
          <span class="auth-detail">${detail}</span>
        </div>
      `;
    })
    .join('');
  authGridEl.innerHTML = html;
}

function renderSenderIp(senderIp) {
  const geo = senderIp.geoIp || {};
  const rows = [
    ['Gonderen IP', senderIp.address],
    ['Tespit Kaynagi', senderIp.source],
    ['Reverse DNS', senderIp.reverseDns],
    ['Ulke', geo.country],
    ['Sehir', geo.city],
    ['ISP', geo.isp],
  ];

  if (geo.error) {
    rows.push(['GeoIP Notu', geo.error]);
  }

  ipTableEl.innerHTML = rows
    .map(([label, value]) => `<tr><td>${label}</td><td>${displayValue(value)}</td></tr>`)
    .join('');
}

function formatLastReported(value) {
  if (!value) return 'Hic raporlanmamis';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('tr-TR');
}

function renderAbuseIpDb(abuseIpDb) {
  if (!abuseIpDb.available) {
    abuseTableEl.innerHTML = `<tr><td>Durum</td><td>${displayValue(abuseIpDb.error || 'Sorgu yapilamadi.')}</td></tr>`;
    return;
  }

  const rows = [
    ['Reputation Score', `${abuseIpDb.reputationScore} / 100`],
    ['Report Count', abuseIpDb.reportCount],
    ['Last Reported', formatLastReported(abuseIpDb.lastReported)],
  ];

  abuseTableEl.innerHTML = rows
    .map(([label, value]) => `<tr><td>${label}</td><td>${displayValue(value)}</td></tr>`)
    .join('');
}

function renderReceived(received) {
  if (!received || received.length === 0) {
    receivedListEl.innerHTML = '<li class="field-empty">Received satiri bulunamadi.</li>';
    return;
  }

  receivedListEl.innerHTML = received
    .map((item) => `<li>${escapeHtml(item.raw)}</li>`)
    .join('');
}

function renderRiskScore(riskScore) {
  const { score, label, color, breakdown } = riskScore;

  riskScoreValueEl.textContent = score;
  riskScoreCircleEl.className = `risk-score-circle risk-${color}`;

  riskLabelBadgeEl.textContent = label;
  riskLabelBadgeEl.className = `risk-label-badge badge-${color}`;

  riskBarFillEl.style.width = `${score}%`;
  riskBarFillEl.className = `risk-bar-fill bar-${color}`;

  riskBreakdownEl.innerHTML = breakdown
    .map(
      (item) => `
        <li>
          <span class="factor-name">${escapeHtml(item.factor)}</span>
          ${escapeHtml(String(item.value))} &middot; ${item.points}/${item.max} puan
        </li>
      `,
    )
    .join('');
}

function renderResults(data) {
  currentAnalysisData = data;

  renderRiskScore(data.riskScore);
  renderFields(data.fields);
  renderAuthResults(data.authResults);
  renderSenderIp(data.senderIp);
  renderAbuseIpDb(data.senderIp.abuseIpDb);
  renderReceived(data.received);

  resultsSection.classList.remove('hidden');

  addHistoryEntry(data);
}

/* ==========================================================================
   Analiz Gecmisi (localStorage)
   ========================================================================== */

function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    return [];
  }
}

function saveHistory(entries) {
  localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(entries));
}

/** Yeni bir analiz sonucunu gecmise (en basa) ekler ve listeyi yeniden cizer. */
function addHistoryEntry(data) {
  const entries = loadHistory();

  entries.unshift({
    timestamp: new Date().toISOString(),
    subject: data.fields.subject,
    from: data.fields.from,
    senderIp: data.senderIp.address,
    riskScore: data.riskScore.score,
    riskColor: data.riskScore.color,
    riskLabel: data.riskScore.label,
  });

  saveHistory(entries.slice(0, HISTORY_MAX_ENTRIES));
  renderHistory();
}

function formatHistoryTimestamp(isoString) {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return isoString;
  return date.toLocaleString('tr-TR');
}

function renderHistory() {
  const entries = loadHistory();

  if (entries.length === 0) {
    historyTableBody.innerHTML = '';
    historyEmptyMessage.classList.remove('hidden');
    return;
  }

  historyEmptyMessage.classList.add('hidden');
  historyTableBody.innerHTML = entries
    .map(
      (entry) => `
        <tr>
          <td>${escapeHtml(formatHistoryTimestamp(entry.timestamp))}</td>
          <td>${displayValue(entry.subject)}</td>
          <td>${displayValue(entry.from)}</td>
          <td>${displayValue(entry.senderIp)}</td>
          <td><span class="history-risk-badge badge-${entry.riskColor || 'gray'}">${entry.riskScore} - ${escapeHtml(entry.riskLabel || '')}</span></td>
        </tr>
      `,
    )
    .join('');
}

function clearHistory() {
  if (!confirm('Tum analiz gecmisi kalici olarak silinecek. Emin misiniz?')) return;
  localStorage.removeItem(HISTORY_STORAGE_KEY);
  renderHistory();
}

/* ==========================================================================
   Disa Aktarma (JSON / PDF)
   ========================================================================== */

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function exportJson() {
  if (!currentAnalysisData) {
    showError('Disa aktarmadan once bir analiz sonucu olmasi gerekiyor.');
    return;
  }

  const blob = new Blob([JSON.stringify(currentAnalysisData, null, 2)], { type: 'application/json' });
  downloadBlob(blob, `email-header-analiz-${Date.now()}.json`);
}

function exportPdf() {
  if (!currentAnalysisData) {
    showError('Disa aktarmadan once bir analiz sonucu olmasi gerekiyor.');
    return;
  }

  if (!window.jspdf || !window.jspdf.jsPDF) {
    showError('PDF kutuphanesi yuklenemedi. Internet baglantinizi kontrol edin.');
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 14;
  const maxWidth = pageWidth - marginX * 2;
  let y = 18;

  function ensureSpace(lineHeight) {
    if (y + lineHeight > pageHeight - 14) {
      doc.addPage();
      y = 18;
    }
  }

  function addHeading(text) {
    ensureSpace(10);
    doc.setFont(undefined, 'bold');
    doc.setFontSize(13);
    doc.text(text, marginX, y);
    y += 7;
    doc.setDrawColor(200);
    doc.line(marginX, y - 4, pageWidth - marginX, y - 4);
  }

  function addLine(label, value) {
    const text = `${label}: ${value === null || value === undefined || value === '' ? 'Bulunamadi' : value}`;
    const lines = doc.splitTextToSize(text, maxWidth);
    doc.setFont(undefined, 'normal');
    doc.setFontSize(10);
    lines.forEach((line) => {
      ensureSpace(6);
      doc.text(line, marginX, y);
      y += 6;
    });
  }

  const data = currentAnalysisData;

  doc.setFont(undefined, 'bold');
  doc.setFontSize(18);
  doc.text('Email Header Analiz Raporu', marginX, y);
  y += 6;
  doc.setFont(undefined, 'normal');
  doc.setFontSize(10);
  doc.text(`Olusturulma: ${new Date().toLocaleString('tr-TR')}`, marginX, y);
  y += 10;

  addHeading('Risk Skoru');
  addLine('Skor', `${data.riskScore.score} / 100`);
  addLine('Seviye', data.riskScore.label);
  data.riskScore.breakdown.forEach((item) => {
    addLine(item.factor, `${item.value} (${item.points}/${item.max} puan)`);
  });
  y += 4;

  addHeading('Header Bilgileri');
  Object.entries(FIELD_LABELS).forEach(([key, label]) => {
    addLine(label, data.fields[key]);
  });
  y += 4;

  addHeading('Kimlik Dogrulama');
  Object.entries(AUTH_LABELS).forEach(([key, label]) => {
    const entry = data.authResults[key] || {};
    addLine(label, entry.result ? entry.result.toUpperCase() : 'Bulunamadi');
  });
  y += 4;

  addHeading('Gonderen IP Bilgisi');
  addLine('IP Adresi', data.senderIp.address);
  addLine('Tespit Kaynagi', data.senderIp.source);
  addLine('Reverse DNS', data.senderIp.reverseDns);
  addLine('Ulke', data.senderIp.geoIp?.country);
  addLine('Sehir', data.senderIp.geoIp?.city);
  addLine('ISP', data.senderIp.geoIp?.isp);
  y += 4;

  addHeading('AbuseIPDB');
  if (data.senderIp.abuseIpDb?.available) {
    addLine('Reputation Score', `${data.senderIp.abuseIpDb.reputationScore} / 100`);
    addLine('Report Count', data.senderIp.abuseIpDb.reportCount);
    addLine('Last Reported', formatLastReported(data.senderIp.abuseIpDb.lastReported));
  } else {
    addLine('Durum', data.senderIp.abuseIpDb?.error || 'Sorgu yapilamadi.');
  }
  y += 4;

  addHeading('Received Satirlari');
  if (data.received.length === 0) {
    addLine('Bilgi', 'Received satiri bulunamadi.');
  } else {
    data.received.forEach((item) => {
      addLine(`#${item.order}`, item.raw);
    });
  }

  doc.save(`email-header-analiz-${Date.now()}.pdf`);
}

// Analiz baslamadan once girdide bu alanlardan en az birinin (satir basinda) bulunmasi beklenir.
const REQUIRED_HEADER_FIELD_PATTERN = /^(received|from|return-path|subject|message-id|date|authentication-results):/im;
const INVALID_HEADER_MESSAGE = 'Geçerli bir email header tespit edilemedi. Lütfen ham (raw) email header bilgisini yapıştırın.';

async function analyzeHeader() {
  const rawHeader = headerInput.value;

  if (!rawHeader || !rawHeader.trim()) {
    showError('Lutfen analiz etmeden once bir email header metni yapistirin.');
    return;
  }

  if (!REQUIRED_HEADER_FIELD_PATTERN.test(rawHeader)) {
    showError(INVALID_HEADER_MESSAGE);
    return;
  }

  setLoading(true);

  try {
    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawHeader }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Analiz sirasinda bir hata olustu.');
    }

    renderResults(data);
  } catch (err) {
    showError(err.message || 'Sunucuya baglanilamadi. Sunucunun calistigindan emin olun.');
  } finally {
    setLoading(false);
  }
}

function clearAll() {
  headerInput.value = '';
  errorBox.classList.add('hidden');
  resultsSection.classList.add('hidden');
  headerInput.focus();
}

/* ==========================================================================
   Tema Sistemi (Cyber Dark <-> Midnight)
   ========================================================================== */

/** Verilen temayi <html data-theme> uzerinden uygular ve buton ikonunu gunceller. */
function applyTheme(theme) {
  if (theme === THEME_MIDNIGHT) {
    document.documentElement.setAttribute('data-theme', THEME_MIDNIGHT);
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
  themeToggleBtn.textContent = THEME_ICONS[theme];
  themeToggleBtn.setAttribute('aria-label', `Tema: ${THEME_LABELS[theme]} (degistirmek icin tikla)`);
  themeToggleBtn.title = `Tema: ${THEME_LABELS[theme]}`;
}

/** Aktif temayi diger temaya gecirir ve secimi localStorage'a kaydeder. */
function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') === THEME_MIDNIGHT
    ? THEME_MIDNIGHT
    : THEME_CYBER_DARK;
  const next = current === THEME_CYBER_DARK ? THEME_MIDNIGHT : THEME_CYBER_DARK;

  applyTheme(next);
  localStorage.setItem(THEME_STORAGE_KEY, next);
}

function initTheme() {
  let savedTheme = THEME_CYBER_DARK;
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === THEME_MIDNIGHT || stored === THEME_CYBER_DARK) {
      savedTheme = stored;
    }
  } catch (err) {
    /* localStorage erisilemezse varsayilan tema kullanilir */
  }
  applyTheme(savedTheme);
}

analyzeBtn.addEventListener('click', analyzeHeader);
clearBtn.addEventListener('click', clearAll);
exportJsonBtn.addEventListener('click', exportJson);
exportPdfBtn.addEventListener('click', exportPdf);
clearHistoryBtn.addEventListener('click', clearHistory);
themeToggleBtn.addEventListener('click', toggleTheme);

// Ctrl+Enter ile hizli analiz kisayolu
headerInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
    analyzeHeader();
  }
});

// Sayfa ilk yuklendiginde daha onceki analiz gecmisini ve tema tercihini yukle
renderHistory();
initTheme();
