const priceLists = {
  plastik: [],
  metal: [],
  diger: [],
};

let convertedItems = [];
let latestOffer = null;

const refs = {
  goOfferPage: document.getElementById('goOfferPage'),
  goPricePage: document.getElementById('goPricePage'),
  goOfferPageInline: document.getElementById('goOfferPageInline'),
  goPricePageInline: document.getElementById('goPricePageInline'),
  offerPage: document.getElementById('offerPage'),
  pricePage: document.getElementById('pricePage'),
  listCountBody: document.getElementById('listCountBody'),
  listType: document.getElementById('listType'),
  excelUpload: document.getElementById('excelUpload'),
  loadExcelBtn: document.getElementById('loadExcelBtn'),
  clearListsBtn: document.getElementById('clearListsBtn'),
  listStatus: document.getElementById('listStatus'),
  textRequest: document.getElementById('textRequest'),
  pdfRequest: document.getElementById('pdfRequest'),
  imageRequest: document.getElementById('imageRequest'),
  imageNotes: document.getElementById('imageNotes'),
  clearRequestBtn: document.getElementById('clearRequestBtn'),
  convertBtn: document.getElementById('convertBtn'),
  convertStatus: document.getElementById('convertStatus'),
  resultTableBody: document.querySelector('#resultTable tbody'),
  subtotal: document.getElementById('subtotal'),
  companyName: document.getElementById('companyName'),
  offerNo: document.getElementById('offerNo'),
  offerDate: document.getElementById('offerDate'),
  paymentType: document.getElementById('paymentType'),
  discount: document.getElementById('discount'),
  vat: document.getElementById('vat'),
  note: document.getElementById('note'),
  discountAmount: document.getElementById('discountAmount'),
  vatAmount: document.getElementById('vatAmount'),
  grandTotal: document.getElementById('grandTotal'),
  createOfferBtn: document.getElementById('createOfferBtn'),
  downloadPdfBtn: document.getElementById('downloadPdfBtn'),
};

refs.offerDate.valueAsDate = new Date();
bindEvents();
renderListCounts();

function bindEvents() {
  refs.goOfferPage.addEventListener('click', () => switchPage('offer'));
  refs.goPricePage.addEventListener('click', () => switchPage('price'));
  refs.goOfferPageInline.addEventListener('click', () => switchPage('offer'));
  refs.goPricePageInline.addEventListener('click', () => switchPage('price'));

  refs.loadExcelBtn.addEventListener('click', loadExcelList);
  refs.clearListsBtn.addEventListener('click', () => {
    priceLists.plastik = [];
    priceLists.metal = [];
    priceLists.diger = [];
    refs.listStatus.textContent = 'Tüm fiyat listeleri temizlendi.';
    renderListCounts();
  });

  refs.clearRequestBtn.addEventListener('click', () => {
    refs.textRequest.value = '';
    refs.pdfRequest.value = '';
    refs.imageRequest.value = '';
    refs.imageNotes.value = '';
    refs.convertStatus.textContent = 'Talep alanları temizlendi.';
  });

  refs.convertBtn.addEventListener('click', convertRequests);
  refs.createOfferBtn.addEventListener('click', createOffer);
  refs.downloadPdfBtn.addEventListener('click', downloadPdf);
  refs.discount.addEventListener('input', updateTotals);
  refs.vat.addEventListener('input', updateTotals);
}

function switchPage(target) {
  const isOffer = target === 'offer';
  refs.offerPage.classList.toggle('is-visible', isOffer);
  refs.pricePage.classList.toggle('is-visible', !isOffer);
  refs.goOfferPage.classList.toggle('active', isOffer);
  refs.goPricePage.classList.toggle('active', !isOffer);
}

async function loadExcelList() {
  const file = refs.excelUpload.files[0];
  if (!file) {
    refs.listStatus.textContent = 'Lütfen bir Excel dosyası seçin.';
    return;
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const rawRows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
      header: 1,
      defval: '',
      blankrows: false,
    });

    const normalized = mapExcelRows(rawRows, refs.listType.value);
    priceLists[refs.listType.value] = normalized;
    renderListCounts();

    if (!normalized.length) {
      refs.listStatus.textContent = 'Excel okundu ancak ürün satırı bulunamadı. Lütfen kolon adlarını kontrol edin.';
      return;
    }

    refs.listStatus.textContent = `${normalized.length} ürün "${refs.listType.value}" listesine yüklendi.`;
    refs.excelUpload.value = '';
  } catch (error) {
    refs.listStatus.textContent = `Excel okunamadı: ${error.message}`;
  }
}

function mapExcelRows(rawRows, listType) {
  if (!rawRows.length) return [];

  const headerCandidateLimit = Math.min(rawRows.length, 6);
  let headerRowIndex = 0;
  let bestHeader = [];
  let bestScore = -1;

  for (let i = 0; i < headerCandidateLimit; i += 1) {
    const row = rawRows[i].map((cell) => normalizeText(cell));
    const score = row.reduce((sum, cell) => {
      if (isCodeHeader(cell) || isDescriptionHeader(cell) || isPriceHeader(cell)) return sum + 1;
      return sum;
    }, 0);

    if (score > bestScore) {
      bestScore = score;
      headerRowIndex = i;
      bestHeader = rawRows[i];
    }
  }

  const headerNormalized = bestHeader.map((cell) => normalizeText(cell));
  const codeIndex = findColumnIndex(headerNormalized, isCodeHeader, 0);
  const descriptionIndex = findColumnIndex(headerNormalized, isDescriptionHeader, 1);
  const detectedPriceIndex = findColumnIndex(headerNormalized, isPriceHeader, -1);

  const dataRows = rawRows.slice(headerRowIndex + 1);
  const inferredPriceIndex = detectedPriceIndex === -1 ? inferPriceColumnIndex(dataRows) : detectedPriceIndex;
  const priceIndex = inferredPriceIndex === -1 ? 2 : inferredPriceIndex;
  return dataRows
    .map((row) => {
      const code = String(row[codeIndex] ?? '').trim();
      const description = String(row[descriptionIndex] ?? '').trim();
      const unitPrice = parsePrice(row[priceIndex]);

      return {
        code,
        description,
        unitPrice,
        listType,
      };
    })
    .filter((item) => item.code || item.description);
}

function findColumnIndex(headerRow, matcher, fallback) {
  const index = headerRow.findIndex((value) => matcher(value));
  return index === -1 ? fallback : index;
}

function inferPriceColumnIndex(dataRows) {
  const sampleRows = dataRows.slice(0, 30);
  const maxColumnCount = sampleRows.reduce((max, row) => Math.max(max, row.length), 0);

  let bestIndex = -1;
  let bestScore = -1;

  for (let col = 0; col < maxColumnCount; col += 1) {
    let numericCount = 0;
    let decimalLikeCount = 0;

    sampleRows.forEach((row) => {
      const raw = row[col];
      const value = parsePrice(raw);
      if (value > 0) {
        numericCount += 1;
        if (String(raw ?? '').includes(',') || String(raw ?? '').includes('.')) {
          decimalLikeCount += 1;
        }
      }
    });

    const score = numericCount + decimalLikeCount * 0.5;
    if (score > bestScore) {
      bestScore = score;
      bestIndex = col;
    }
  }

  return bestIndex;
}

function isCodeHeader(value) {
  return ['urunkodu', 'stokkodu', 'kodu', 'kod', 'urunno', 'itemcode', 'code'].some((key) => value.includes(key));
}

function isDescriptionHeader(value) {
  return ['urunaciklamasi', 'aciklama', 'urunadi', 'tanim', 'description', 'name'].some((key) => value.includes(key));
}

function isPriceHeader(value) {
  return ['birimfiyat', 'fiyat', 'listefiyati', 'price', 'unitprice'].some((key) => value.includes(key));
}

function normalizeText(value) {
  return String(value || '')
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
    .replace(/[^a-z0-9]/g, '');
}

function parsePrice(rawValue) {
  if (typeof rawValue === 'number' && Number.isFinite(rawValue)) {
    return rawValue;
  }

  const raw = String(rawValue ?? '').trim();
  if (!raw) return 0;

  const sanitized = raw.replace(/\s/g, '').replace(/[^0-9,.-]/g, '');
  if (!sanitized) return 0;

  const lastComma = sanitized.lastIndexOf(',');
  const lastDot = sanitized.lastIndexOf('.');
  const decimalSeparator = lastComma > lastDot ? ',' : '.';

  let normalized = sanitized;
  if (decimalSeparator === ',') {
    normalized = normalized.replace(/\./g, '').replace(',', '.');
  } else {
    normalized = normalized.replace(/,/g, '');
  }

  const value = Number(normalized);
  return Number.isFinite(value) ? value : 0;
}

function renderListCounts() {
  refs.listCountBody.innerHTML = '';
  ['plastik', 'metal', 'diger'].forEach((listName) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${capitalize(listName)}</td><td>${priceLists[listName].length}</td>`;
    refs.listCountBody.appendChild(tr);
  });
}

function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

async function convertRequests() {
  const allText = [];

  if (refs.textRequest.value.trim()) {
    allText.push(refs.textRequest.value.trim());
  }

  if (refs.pdfRequest.files[0]) {
    const pdfText = await extractPdfText(refs.pdfRequest.files[0]);
    allText.push(pdfText);
  }

  if (refs.imageRequest.files[0]) {
    const imageName = refs.imageRequest.files[0].name;
    allText.push(`Görsel dosyası: ${imageName}`);
    if (refs.imageNotes.value.trim()) {
      allText.push(refs.imageNotes.value.trim());
    }
  }

  const merged = allText.join('\n').trim();
  if (!merged) {
    refs.convertStatus.textContent = 'Dönüştürülecek metin bulunamadı.';
    return;
  }

  const requestedItems = parseRequestText(merged);
  convertedItems = smartMatch(requestedItems);
  renderTable();
  updateTotals();
  refs.convertStatus.textContent = `${convertedItems.length} satır dönüştürüldü ve fiyatlandırıldı.`;
}

function parseRequestText(text) {
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const { quantity, cleanName } = extractQuantity(line);
      return {
        search: cleanName || line,
        quantity,
      };
    });
}

function extractQuantity(line) {
  const explicitQuantityMatches = [...line.matchAll(/(\d+)\s*(adet|pcs|tane)\b/gi)];
  if (explicitQuantityMatches.length) {
    const selected = explicitQuantityMatches[explicitQuantityMatches.length - 1];
    const quantity = Number(selected[1]);
    const cleanName = line.replace(selected[0], '').trim();
    return { quantity: Number.isFinite(quantity) ? quantity : 1, cleanName };
  }

  const trailingNumber = line.match(/(\d+)\s*$/);
  if (trailingNumber) {
    const quantity = Number(trailingNumber[1]);
    const cleanName = line.replace(/(\d+)\s*$/, '').trim();
    return { quantity: Number.isFinite(quantity) ? quantity : 1, cleanName };
  }

  return { quantity: 1, cleanName: line };
}

function smartMatch(items) {
  const flattened = [...priceLists.plastik, ...priceLists.metal, ...priceLists.diger];

  return items.map((item) => {
    if (!flattened.length) {
      return { code: '-', description: item.search, listType: 'eşleşme yok', quantity: item.quantity, unitPrice: 0, total: 0 };
    }

    const match = flattened
      .map((candidate) => {
        const score = similarity(item.search.toLowerCase(), `${candidate.code} ${candidate.description}`.toLowerCase());
        return { candidate, score };
      })
      .sort((a, b) => b.score - a.score)[0];

    if (!match || match.score < 0.25) {
      return { code: '-', description: item.search, listType: 'eşleşme yok', quantity: item.quantity, unitPrice: 0, total: 0 };
    }

    const total = item.quantity * match.candidate.unitPrice;
    return {
      code: match.candidate.code || '-',
      description: match.candidate.description || item.search,
      listType: match.candidate.listType,
      quantity: item.quantity,
      unitPrice: match.candidate.unitPrice,
      total,
    };
  });
}

function similarity(a, b) {
  const tokensA = a.split(/\s+/).filter(Boolean);
  const tokensB = b.split(/\s+/).filter(Boolean);
  if (!tokensA.length || !tokensB.length) return 0;
  const setB = new Set(tokensB);
  let common = 0;
  for (const token of tokensA) if (setB.has(token)) common += 1;
  return common / Math.max(tokensA.length, tokensB.length);
}

function renderTable() {
  refs.resultTableBody.innerHTML = '';
  convertedItems.forEach((item) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(item.code)}</td>
      <td>${escapeHtml(item.description)}</td>
      <td>${escapeHtml(item.listType)}</td>
      <td>${item.quantity}</td>
      <td>${formatMoney(item.unitPrice)}</td>
      <td>${formatMoney(item.total)}</td>
    `;
    refs.resultTableBody.appendChild(tr);
  });
}

function updateTotals() {
  const subtotal = convertedItems.reduce((sum, row) => sum + row.total, 0);
  const discountRate = Number(refs.discount.value || 0) / 100;
  const vatRate = Number(refs.vat.value || 0) / 100;

  const discountAmount = subtotal * discountRate;
  const net = subtotal - discountAmount;
  const vatAmount = net * vatRate;
  const grandTotal = net + vatAmount;

  refs.subtotal.textContent = formatMoney(subtotal);
  refs.discountAmount.textContent = formatMoney(discountAmount);
  refs.vatAmount.textContent = formatMoney(vatAmount);
  refs.grandTotal.textContent = formatMoney(grandTotal);
}

function createOffer() {
  if (!convertedItems.length) {
    refs.convertStatus.textContent = 'Önce ürünleri dönüştürün.';
    return;
  }

  latestOffer = {
    companyName: refs.companyName.value.trim() || 'Belirtilmedi',
    offerNo: refs.offerNo.value.trim() || `TKL-${Date.now()}`,
    offerDate: refs.offerDate.value || new Date().toISOString().slice(0, 10),
    paymentType: refs.paymentType.value.trim() || 'Belirtilmedi',
    discountRate: Number(refs.discount.value || 0),
    vatRate: Number(refs.vat.value || 0),
    note: refs.note.value.trim(),
    items: [...convertedItems],
  };

  refs.convertStatus.textContent = `Teklif hazırlandı: ${latestOffer.offerNo}`;
  refs.downloadPdfBtn.disabled = false;
}

function downloadPdf() {
  if (!latestOffer) return;

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  let y = 15;
  doc.setFontSize(16);
  doc.text('TEKLIF', 14, y);
  y += 10;
  doc.setFontSize(11);
  doc.text(`Firma: ${latestOffer.companyName}`, 14, y);
  y += 7;
  doc.text(`Teklif No: ${latestOffer.offerNo}`, 14, y);
  y += 7;
  doc.text(`Tarih: ${latestOffer.offerDate}`, 14, y);
  y += 7;
  doc.text(`Odeme Sekli: ${latestOffer.paymentType}`, 14, y);
  y += 10;

  doc.text('Urunler:', 14, y);
  y += 6;

  latestOffer.items.forEach((item, index) => {
    const line = `${index + 1}) ${item.code} - ${item.description} | ${item.quantity} adet x ${formatMoney(item.unitPrice)} = ${formatMoney(item.total)} TL`;
    const split = doc.splitTextToSize(line, 180);
    doc.text(split, 14, y);
    y += split.length * 6;
    if (y > 270) {
      doc.addPage();
      y = 15;
    }
  });

  y += 4;
  doc.text(`Ara Toplam: ${refs.subtotal.textContent} TL`, 14, y);
  y += 7;
  doc.text(`Iskonto (%${latestOffer.discountRate}): ${refs.discountAmount.textContent} TL`, 14, y);
  y += 7;
  doc.text(`KDV (%${latestOffer.vatRate}): ${refs.vatAmount.textContent} TL`, 14, y);
  y += 7;
  doc.text(`Genel Toplam: ${refs.grandTotal.textContent} TL`, 14, y);

  doc.save(`${latestOffer.offerNo}.pdf`);
}

async function extractPdfText(file) {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let text = '';

    for (let i = 1; i <= pdf.numPages; i += 1) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      text += `\n${content.items.map((it) => it.str).join(' ')}`;
    }

    return text;
  } catch {
    return '';
  }
}

function formatMoney(value) {
  const number = Number(value) || 0;
  return new Intl.NumberFormat('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(number);
}

function escapeHtml(str) {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
