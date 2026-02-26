const priceLists = {
  plastik: [],
  metal: [],
  diger: [],
};

let convertedItems = [];
let latestOffer = null;

const refs = {
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

refs.loadExcelBtn.addEventListener('click', loadExcelList);
refs.clearListsBtn.addEventListener('click', () => {
  priceLists.plastik = [];
  priceLists.metal = [];
  priceLists.diger = [];
  refs.listStatus.textContent = 'Tüm fiyat listeleri temizlendi.';
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
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
      defval: '',
      raw: false,
    });

    const normalized = rows
      .map((row) => {
        const code = String(row['Ürün Kodu'] || row['urun_kodu'] || row['code'] || '').trim();
        const description = String(row['Ürün Açıklaması'] || row['urun_aciklamasi'] || row['description'] || '').trim();
        const unitPrice = Number(String(row['Birim Fiyat'] || row['fiyat'] || row['price'] || '0').replace(',', '.'));

        return {
          code,
          description,
          unitPrice: Number.isFinite(unitPrice) ? unitPrice : 0,
          listType: refs.listType.value,
        };
      })
      .filter((x) => x.code || x.description);

    priceLists[refs.listType.value] = normalized;
    refs.listStatus.textContent = `${normalized.length} ürün "${refs.listType.value}" listesine yüklendi.`;
  } catch (error) {
    refs.listStatus.textContent = `Excel okunamadı: ${error.message}`;
  }
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
  refs.convertStatus.textContent = `${convertedItems.length} satır AI ile dönüştürüldü ve fiyatlandırıldı.`;
}

function parseRequestText(text) {
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const quantityMatch = line.match(/(\d+)\s*(adet|pcs|tane)?/i);
      const quantity = quantityMatch ? Number(quantityMatch[1]) : 1;
      const cleanName = line.replace(/\d+\s*(adet|pcs|tane)?/i, '').trim();
      return {
        raw: line,
        search: cleanName || line,
        quantity,
      };
    });
}

function smartMatch(items) {
  const flattened = [...priceLists.plastik, ...priceLists.metal, ...priceLists.diger];

  return items.map((item) => {
    if (!flattened.length) {
      return {
        code: '-',
        description: item.search,
        listType: 'eşleşme yok',
        quantity: item.quantity,
        unitPrice: 0,
        total: 0,
      };
    }

    const match = flattened
      .map((candidate) => {
        const score = similarity(item.search.toLowerCase(), `${candidate.code} ${candidate.description}`.toLowerCase());
        return { candidate, score };
      })
      .sort((a, b) => b.score - a.score)[0];

    if (!match || match.score < 0.25) {
      return {
        code: '-',
        description: item.search,
        listType: 'eşleşme yok',
        quantity: item.quantity,
        unitPrice: 0,
        total: 0,
      };
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
  for (const token of tokensA) {
    if (setB.has(token)) common += 1;
  }
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
    totals: {
      subtotal: Number(refs.subtotal.textContent),
      discountAmount: Number(refs.discountAmount.textContent),
      vatAmount: Number(refs.vatAmount.textContent),
      grandTotal: Number(refs.grandTotal.textContent),
    },
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
  y += 10;

  if (latestOffer.note) {
    doc.text('Aciklama:', 14, y);
    y += 6;
    doc.text(doc.splitTextToSize(latestOffer.note, 180), 14, y);
  }

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
  return (Number(value) || 0).toFixed(2);
}

function escapeHtml(str) {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
