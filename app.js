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
  listName: document.getElementById('listName'),
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
  addManualRowBtn: document.getElementById('addManualRowBtn'),
  manualCode: document.getElementById('manualCode'),
  manualDesc: document.getElementById('manualDesc'),
  manualListType: document.getElementById('manualListType'),
  manualQty: document.getElementById('manualQty'),
  manualPrice: document.getElementById('manualPrice'),
  subtotal: document.getElementById('subtotal'),
  companyName: document.getElementById('companyName'),
  offerNo: document.getElementById('offerNo'),
  offerDate: document.getElementById('offerDate'),
  paymentType: document.getElementById('paymentType'),
  maturityRate: document.getElementById('maturityRate'),
  discount: document.getElementById('discount'),
  vat: document.getElementById('vat'),
  note: document.getElementById('note'),
  discountAmount: document.getElementById('discountAmount'),
  maturityAmount: document.getElementById('maturityAmount'),
  vatAmount: document.getElementById('vatAmount'),
  grandTotal: document.getElementById('grandTotal'),
  createOfferBtn: document.getElementById('createOfferBtn'),
  downloadPdfBtn: document.getElementById('downloadPdfBtn'),
};

refs.offerDate.valueAsDate = new Date();
bindEvents();
renderListsTable();

function bindEvents() {
  refs.goOfferPage.addEventListener('click', () => switchPage('offer'));
  refs.goPricePage.addEventListener('click', () => switchPage('price'));
  refs.goOfferPageInline.addEventListener('click', () => switchPage('offer'));
  refs.goPricePageInline.addEventListener('click', () => switchPage('price'));

  refs.loadExcelBtn.addEventListener('click', loadExcelList);
  refs.clearListsBtn.addEventListener('click', clearAllLists);
  refs.listCountBody.addEventListener('click', onListDeleteClick);

  refs.clearRequestBtn.addEventListener('click', clearRequest);
  refs.convertBtn.addEventListener('click', convertRequests);
  refs.addManualRowBtn.addEventListener('click', addManualRow);

  refs.resultTableBody.addEventListener('click', onResultTableClick);
  refs.resultTableBody.addEventListener('input', onResultTableInput);

  refs.createOfferBtn.addEventListener('click', createOffer);
  refs.downloadPdfBtn.addEventListener('click', downloadPdf);
  refs.discount.addEventListener('input', updateTotals);
  refs.vat.addEventListener('input', updateTotals);
  refs.maturityRate.addEventListener('input', updateTotals);
  refs.paymentType.addEventListener('change', onPaymentTypeChange);
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

    const listType = refs.listType.value;
    const listName = refs.listName.value.trim() || `${capitalize(listType)} Liste ${priceLists[listType].length + 1}`;
    const items = mapExcelRows(rawRows, listType, listName);

    if (!items.length) {
      refs.listStatus.textContent = 'Excel okundu ancak ürün satırı bulunamadı.';
      return;
    }

    priceLists[listType].push({
      id: createId(),
      listName,
      listType,
      items,
    });

    renderListsTable();
    refs.listStatus.textContent = `${listName} listesi eklendi (${items.length} ürün).`;
    refs.excelUpload.value = '';
    refs.listName.value = '';
  } catch (error) {
    refs.listStatus.textContent = `Excel okunamadı: ${error.message}`;
  }
}

function clearAllLists() {
  priceLists.plastik = [];
  priceLists.metal = [];
  priceLists.diger = [];
  renderListsTable();
  refs.listStatus.textContent = 'Tüm fiyat listeleri temizlendi.';
}

function onListDeleteClick(event) {
  const button = event.target.closest('[data-delete-list-id]');
  if (!button) return;

  const listType = button.dataset.deleteListType;
  const listId = button.dataset.deleteListId;
  priceLists[listType] = priceLists[listType].filter((list) => list.id !== listId);
  renderListsTable();
  refs.listStatus.textContent = 'Liste silindi.';
}

function renderListsTable() {
  refs.listCountBody.innerHTML = '';
  const allLists = [...priceLists.plastik, ...priceLists.metal, ...priceLists.diger];

  if (!allLists.length) {
    refs.listCountBody.innerHTML = '<tr><td colspan="5">Henüz liste eklenmedi.</td></tr>';
    return;
  }

  allLists.forEach((list) => {
    const groups = summarizeGroups(list.items).join(', ');
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${capitalize(list.listType)}</td>
      <td>${escapeHtml(list.listName)}</td>
      <td>${list.items.length}</td>
      <td>${escapeHtml(groups || '-')}</td>
      <td><button class="danger" data-delete-list-id="${list.id}" data-delete-list-type="${list.listType}">Sil</button></td>
    `;
    refs.listCountBody.appendChild(tr);
  });
}

function summarizeGroups(items) {
  const map = new Map();
  items.forEach((item) => {
    const group = String(item.description || 'Diğer').trim().split(/\s+/)[0] || 'Diğer';
    map.set(group, (map.get(group) || 0) + 1);
  });
  return [...map.entries()].slice(0, 5).map(([group, count]) => `${group} (${count})`);
}

function mapExcelRows(rawRows, listType, listName) {
  if (!rawRows.length) return [];

  const headerCandidateLimit = Math.min(rawRows.length, 6);
  let headerRowIndex = 0;
  let bestHeader = [];
  let bestScore = -1;

  for (let i = 0; i < headerCandidateLimit; i += 1) {
    const row = rawRows[i].map((cell) => normalizeText(cell));
    const score = row.reduce((sum, cell) => (isCodeHeader(cell) || isDescriptionHeader(cell) || isPriceHeader(cell) ? sum + 1 : sum), 0);
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
      return { code, description, unitPrice, listType, listName };
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
    let score = 0;
    sampleRows.forEach((row) => {
      const raw = row[col];
      const value = parsePrice(raw);
      if (value > 0) score += 1;
      if (String(raw ?? '').includes(',') || String(raw ?? '').includes('.')) score += 0.5;
    });
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
  if (typeof rawValue === 'number' && Number.isFinite(rawValue)) return rawValue;
  const raw = String(rawValue ?? '').trim();
  if (!raw) return 0;

  const sanitized = raw.replace(/\s/g, '').replace(/[^0-9,.-]/g, '');
  const lastComma = sanitized.lastIndexOf(',');
  const lastDot = sanitized.lastIndexOf('.');
  let normalized = sanitized;

  if (lastComma > lastDot) {
    normalized = normalized.replace(/\./g, '').replace(',', '.');
  } else {
    normalized = normalized.replace(/,/g, '');
  }

  const value = Number(normalized);
  return Number.isFinite(value) ? value : 0;
}

function clearRequest() {
  refs.textRequest.value = '';
  refs.pdfRequest.value = '';
  refs.imageRequest.value = '';
  refs.imageNotes.value = '';
  refs.convertStatus.textContent = 'Talep alanları temizlendi.';
}

async function convertRequests() {
  const allText = [];
  if (refs.textRequest.value.trim()) allText.push(refs.textRequest.value.trim());
  if (refs.pdfRequest.files[0]) allText.push(await extractPdfText(refs.pdfRequest.files[0]));
  if (refs.imageRequest.files[0]) {
    allText.push(`Görsel dosyası: ${refs.imageRequest.files[0].name}`);
    if (refs.imageNotes.value.trim()) allText.push(refs.imageNotes.value.trim());
  }

  const merged = allText.join('\n').trim();
  if (!merged) {
    refs.convertStatus.textContent = 'Dönüştürülecek metin bulunamadı.';
    return;
  }

  convertedItems = smartMatch(parseRequestText(merged));
  renderTable();
  updateTotals();
  refs.convertStatus.textContent = `${convertedItems.length} satır dönüştürüldü.`;
}

function parseRequestText(text) {
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => splitRequestLine(line))
    .map((line) => {
      const explicit = [...line.matchAll(/(\d+)\s*(adet|pcs|tane)\b/gi)].pop();
      const quantity = explicit ? Number(explicit[1]) : Number(line.match(/(\d+)\s*$/)?.[1] || 1);
      const cleanName = explicit ? line.replace(explicit[0], '').trim() : line.replace(/(\d+)\s*$/, '').trim();
      return { search: cleanName || line, quantity: Number.isFinite(quantity) ? quantity : 1 };
    });
}

function splitRequestLine(line) {
  const parts = line
    .split(/[;|]+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length > 1) return parts;
  return [line];
}

function getAllItems() {
  return [...priceLists.plastik, ...priceLists.metal, ...priceLists.diger].flatMap((list) => list.items);
}

function smartMatch(items) {
  const flattened = getAllItems();
  return items.map((item) => {
    if (!flattened.length) return createUnmatchedRow(item);

    const searchText = normalizeForMatch(item.search);
    const match = flattened
      .map((candidate) => {
        const candidateText = normalizeForMatch(`${candidate.code} ${candidate.description}`);
        const score = similarity(searchText, candidateText);
        return { candidate, score };
      })
      .sort((a, b) => b.score - a.score)[0];

    if (!match || match.score < 0.12) return createUnmatchedRow(item);

    const unitPrice = Number(match.candidate.unitPrice) || 0;
    return {
      code: match.candidate.code || '-',
      description: match.candidate.description || item.search,
      listLabel: `${capitalize(match.candidate.listType)} / ${match.candidate.listName}`,
      quantity: item.quantity,
      unitPrice,
      total: unitPrice * item.quantity,
    };
  });
}

function createUnmatchedRow(item) {
  return { code: '-', description: item.search, listLabel: 'eşleşme yok', quantity: item.quantity, unitPrice: 0, total: 0 };
}

function normalizeForMatch(text) {
  return String(text || '')
    .toLocaleLowerCase('tr-TR')
    .replace(/[×*]/g, 'x')
    .replace(/\b(ø|phi)\b/g, '')
    .replace(/[.,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function similarity(a, b) {
  const tokensA = tokenizeForMatch(a);
  const tokensB = tokenizeForMatch(b);
  if (!tokensA.length || !tokensB.length) return 0;

  const tokenScore = tokenOverlapScore(tokensA, tokensB);
  const charScore = diceCoefficient(a, b);
  const dimensionScore = dimensionMatchScore(tokensA, tokensB);

  return tokenScore * 0.5 + charScore * 0.3 + dimensionScore * 0.2;
}

function tokenizeForMatch(text) {
  return text
    .split(/[^a-z0-9x]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
}

function tokenOverlapScore(tokensA, tokensB) {
  const setA = new Set(tokensA);
  const setB = new Set(tokensB);
  let common = 0;
  setA.forEach((token) => {
    if (setB.has(token)) common += 1;
  });
  return common / Math.max(setA.size, setB.size, 1);
}

function diceCoefficient(a, b) {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;

  const gramsA = new Map();
  for (let i = 0; i < a.length - 1; i += 1) {
    const gram = a.slice(i, i + 2);
    gramsA.set(gram, (gramsA.get(gram) || 0) + 1);
  }

  let intersection = 0;
  for (let i = 0; i < b.length - 1; i += 1) {
    const gram = b.slice(i, i + 2);
    const count = gramsA.get(gram) || 0;
    if (count > 0) {
      gramsA.set(gram, count - 1);
      intersection += 1;
    }
  }

  return (2 * intersection) / (a.length + b.length - 2);
}

function dimensionMatchScore(tokensA, tokensB) {
  const dimRegex = /^\d{1,4}x\d{1,4}$/;
  const dimsA = tokensA.filter((t) => dimRegex.test(t));
  const dimsB = new Set(tokensB.filter((t) => dimRegex.test(t)));
  if (!dimsA.length || !dimsB.size) return 0;

  const common = dimsA.filter((dim) => dimsB.has(dim)).length;
  return common / Math.max(dimsA.length, dimsB.size, 1);
}

function renderTable() {
  refs.resultTableBody.innerHTML = '';
  convertedItems.forEach((item, index) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(item.code)}</td>
      <td>${escapeHtml(item.description)}</td>
      <td>${escapeHtml(item.listLabel)}</td>
      <td><input class="qty-input" data-qty-index="${index}" type="number" min="1" value="${item.quantity}" /></td>
      <td>${formatMoney(item.unitPrice)}</td>
      <td>${formatMoney(item.total)}</td>
      <td><button class="danger" data-remove-index="${index}">Sil</button></td>
    `;
    refs.resultTableBody.appendChild(tr);
  });
}

function onResultTableClick(event) {
  const button = event.target.closest('[data-remove-index]');
  if (!button) return;
  const index = Number(button.dataset.removeIndex);
  convertedItems.splice(index, 1);
  renderTable();
  updateTotals();
}

function onResultTableInput(event) {
  const input = event.target.closest('[data-qty-index]');
  if (!input) return;
  const index = Number(input.dataset.qtyIndex);
  const qty = Math.max(1, Number(input.value || 1));
  convertedItems[index].quantity = qty;
  convertedItems[index].total = qty * convertedItems[index].unitPrice;
  renderTable();
  updateTotals();
}

function addManualRow() {
  const code = refs.manualCode.value.trim() || '-';
  const description = refs.manualDesc.value.trim();
  const quantity = Math.max(1, Number(refs.manualQty.value || 1));
  const unitPrice = parsePrice(refs.manualPrice.value);

  if (!description) {
    refs.convertStatus.textContent = 'Manuel ekleme için ürün açıklaması zorunlu.';
    return;
  }

  convertedItems.push({
    code,
    description,
    listLabel: `Manuel / ${capitalize(refs.manualListType.value)}`,
    quantity,
    unitPrice,
    total: quantity * unitPrice,
  });

  refs.manualCode.value = '';
  refs.manualDesc.value = '';
  refs.manualQty.value = '1';
  refs.manualPrice.value = '';
  renderTable();
  updateTotals();
}

function onPaymentTypeChange() {
  const needsMaturity = refs.paymentType.value === 'cek' || refs.paymentType.value === 'kredi_karti';
  refs.maturityRate.disabled = !needsMaturity;
  if (!needsMaturity) refs.maturityRate.value = '0';
  updateTotals();
}

function updateTotals() {
  const subtotal = convertedItems.reduce((sum, row) => sum + row.total, 0);
  const discountRate = Number(refs.discount.value || 0) / 100;
  const maturityRate = Number(refs.maturityRate.value || 0) / 100;
  const vatRate = Number(refs.vat.value || 0) / 100;

  const discountAmount = subtotal * discountRate;
  const afterDiscount = subtotal - discountAmount;
  const maturityAmount = afterDiscount * maturityRate;
  const afterMaturity = afterDiscount + maturityAmount;
  const vatAmount = afterMaturity * vatRate;
  const grandTotal = afterMaturity + vatAmount;

  refs.subtotal.textContent = formatMoney(subtotal);
  refs.discountAmount.textContent = formatMoney(discountAmount);
  refs.maturityAmount.textContent = formatMoney(maturityAmount);
  refs.vatAmount.textContent = formatMoney(vatAmount);
  refs.grandTotal.textContent = formatMoney(grandTotal);
}

function createOffer() {
  if (!convertedItems.length) {
    refs.convertStatus.textContent = 'Önce ürün ekleyin veya dönüştürün.';
    return;
  }

  latestOffer = {
    companyName: refs.companyName.value.trim() || 'Belirtilmedi',
    offerNo: refs.offerNo.value.trim() || `TKL-${Date.now()}`,
    offerDate: refs.offerDate.value || new Date().toISOString().slice(0, 10),
    paymentType: refs.paymentType.options[refs.paymentType.selectedIndex].text,
    maturityRate: Number(refs.maturityRate.value || 0),
    discountRate: Number(refs.discount.value || 0),
    vatRate: Number(refs.vat.value || 0),
    note: refs.note.value.trim(),
    items: [...convertedItems],
  };

  refs.downloadPdfBtn.disabled = false;
  refs.convertStatus.textContent = `Teklif hazırlandı: ${latestOffer.offerNo}`;
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
  y += 7;
  doc.text(`Vade Farki: %${latestOffer.maturityRate}`, 14, y);
  y += 10;

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
  doc.text(`Iskonto: ${refs.discountAmount.textContent} TL`, 14, y);
  y += 7;
  doc.text(`Vade Farki: ${refs.maturityAmount.textContent} TL`, 14, y);
  y += 7;
  doc.text(`KDV: ${refs.vatAmount.textContent} TL`, 14, y);
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
  return new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value) || 0);
}

function createId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function escapeHtml(str) {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
