const SPREADSHEET_ID = '1L8cu2jbefLBlrxbRFYvEqPUSjPd7_8xsx8Ssm70wfGs';
const BANK_SHEET_NAME = 'Bank';
const DRIVE_FOLDER_ID = '1AlsC2ZLYSKi7E5Yf2VeccyXK1Y5NSCyC';
const HISTORIS_SHEET_NAME = 'HISTORIS';

const COMPANIES = {
  'PATRIA': { key: 'PATRIA', name: 'PATRIA MENARA ABADI', sheetName: 'TRANSAKSI_PATRIA' },
  'ARRAH': { key: 'ARRAH', name: 'ARRAH ENERGI INDONESIA', sheetName: 'TRANSAKSI_ARRAH' },
  'ABIUMI': { key: 'ABIUMI', name: 'ABIUMI REJEKI BERSAMA', sheetName: 'TRANSAKSI_ABIUMI' },
  'LANGGENG': { key: 'LANGGENG', name: 'LANGGENG NIAGA GEMILANG', sheetName: 'TRANSAKSI_LANGGENG' }
};
const DEFAULT_COMPANY_KEY = 'PATRIA';

const HEADERS = [
  'No Transaksi', 'Nama Bank', 'Tanggal Transaksi', 'Keterangan', 'Jumlah Transaksi',
  'Bukti Pengajuan', 'Bukti Bayar', 'Invoice', 'Status Bukti',
  'Link Bukti Pengajuan', 'Link Bukti Bayar', 'Link Invoice', 'Created At', 'Updated At'
];

const HISTORIS_HEADERS = [
  'Timestamp', 'Perusahaan', 'No Transaksi', 'Nama Bank', 'Tanggal Transaksi',
  'Keterangan', 'Jumlah Transaksi', 'Status', 'Email', 'Device', 'Aktivitas'
];

function doGet(e) {
  const paramAction = e && e.parameter ? (e.parameter.action || e.parameter.act || e.parameter.method) : null;
  if (paramAction) {
    return handleApiRequest_(paramAction, e.parameter);
  }
  try {
    return HtmlService.createHtmlOutputFromFile('Index')
      .setTitle('PATRIA MENARA ABADI - Verifikasi Filling')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  } catch (err) {
    return HtmlService.createHtmlOutputFromFile('index')
      .setTitle('PATRIA MENARA ABADI - Verifikasi Filling')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
}

function doPost(e) {
  try {
    let payload = {};
    if (e && e.postData && e.postData.contents) {
      try {
        payload = JSON.parse(e.postData.contents);
      } catch (jsonErr) {
        payload = e.parameter || {};
      }
    } else if (e && e.parameter) {
      payload = e.parameter;
    }

    const rawAction = String(payload.action || (e && e.parameter && e.parameter.action) || '').trim();
    // Normalisasi ke lowercase dan hapus spasi agar cocok dengan semua variasi penulisan
    const act = rawAction.toLowerCase().replace(/\s+/g, '');
    let args = payload.args || [];
    if (typeof args === 'string') {
      try { args = JSON.parse(args); } catch (_) {}
    }
    if (!Array.isArray(args)) args = [args];

    let result;
    if (act === 'getdata') {
      result = getData(args[0] || payload.companyKey || payload.company);
    } else if (act === 'getbanks') {
      result = getBanks();
    } else if (act === 'gettransactionbyid') {
      result = getTransactionById(args[0] || payload.id, args[1] || payload.companyKey);
    } else if (act === 'addtransaction') {
      result = addTransaction(args[0] || payload.payload, args[1] || payload.companyKey);
    } else if (act === 'updatetransaction') {
      result = updateTransaction(args[0] || payload.id, args[1] || payload.payload, args[2] || payload.companyKey);
    } else if (act === 'deletetransaction') {
      result = deleteTransaction(args[0] || payload.id, args[1] || payload.companyKey, args[2] || payload.clientInfo);
    } else if (act === 'uploadfile') {
      result = uploadFile(args[0] || payload.payload, args[1] || payload.companyKey);
    } else if (act === 'importtransactions') {
      result = importTransactions(args[0] || payload.payload, args[1] || payload.companyKey);
    } else if (act === 'getdashboardstats') {
      // Menangani: getDashboardStats, getdashboardstats, GetDashboardStats, dll.
      result = getDashboardStats();
    } else if (act === 'gethistorisdata' || act === 'gethistoris' || act === 'gethistory' || act === 'gethistorydata' || act === 'historis') {
      // Menangani: getHistorisData, gethistorisdata, getHistoris, dll.
      result = getHistorisData();
    } else {
      throw new Error('Action tidak dikenal: ' + rawAction);
    }
    return ContentService.createTextOutput(JSON.stringify({ success: true, data: result }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.message || String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function handleApiRequest_(action, params) {
  try {
    const rawAction = String(action || '').trim();
    const act = rawAction.toLowerCase();
    let result;
    if (act === 'getdata') {
      result = getData(params.companyKey || params.company);
    } else if (act === 'getbanks') {
      result = getBanks();
    } else if (act === 'gettransactionbyid') {
      result = getTransactionById(params.id, params.companyKey || params.company);
    } else if (act === 'getdashboardstats') {
      result = getDashboardStats();
    } else if (act === 'gethistorisdata' || act === 'gethistoris' || act === 'gethistory' || act === 'gethistorydata' || act === 'historis') {
      result = getHistorisData();
    } else {
      throw new Error('Action tidak dikenal: ' + rawAction);
    }
    return ContentService.createTextOutput(JSON.stringify({ success: true, data: result }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.message || String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function normalizeCompanyKey_(key) {
  const upper = String(key || DEFAULT_COMPANY_KEY).trim().toUpperCase();
  if (COMPANIES[upper]) return upper;
  for (const k in COMPANIES) {
    if (COMPANIES[k].name.toUpperCase().indexOf(upper) !== -1 || upper.indexOf(k) !== -1) {
      return k;
    }
  }
  return DEFAULT_COMPANY_KEY;
}

function getCompanyConfig_(key) {
  const norm = normalizeCompanyKey_(key);
  return COMPANIES[norm] || COMPANIES[DEFAULT_COMPANY_KEY];
}

function openSpreadsheet_() {
  if (!SPREADSHEET_ID || SPREADSHEET_ID === 'ISI_ID_SPREADSHEET') throw new Error('Ganti SPREADSHEET_ID di Code.gs terlebih dahulu.');
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function getTransactionSheet_(companyKey) {
  const config = getCompanyConfig_(companyKey);
  const spreadsheet = openSpreadsheet_();
  let sheet = spreadsheet.getSheetByName(config.sheetName);

  // Fallback untuk PATRIA: jika sheet TRANSAKSI_PATRIA belum ada, cek sheet 'Transaksi' lama
  if (!sheet && config.key === 'PATRIA') {
    sheet = spreadsheet.getSheetByName('Transaksi');
    if (sheet) {
      try {
        sheet.setName(config.sheetName);
      } catch (e) {
        // Gunakan sheet Transaksi apa adanya jika rename dibatasi
      }
    }
  }

  // Jika sheet belum ada, buat otomatis
  if (!sheet) {
    sheet = spreadsheet.insertSheet(config.sheetName);
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold').setBackground('#0f172a').setFontColor('#ffffff');
    sheet.getRange(2, 1, Math.max(sheet.getMaxRows() - 1, 1), 1).setNumberFormat('@');
  } else {
    ensureHeaders_(sheet);
  }

  return sheet;
}

function getHistorisSheet_() {
  const spreadsheet = openSpreadsheet_();
  let sheet = spreadsheet.getSheetByName(HISTORIS_SHEET_NAME);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(HISTORIS_SHEET_NAME);
    sheet.getRange(1, 1, 1, HISTORIS_HEADERS.length).setValues([HISTORIS_HEADERS]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, HISTORIS_HEADERS.length).setFontWeight('bold').setBackground('#1e293b').setFontColor('#ffffff');
  }
  return sheet;
}

function ensureHeaders_(sheet) {
  const lastCol = sheet.getLastColumn();
  if (lastCol > 0) {
    const current = sheet.getRange(1, 1, 1, Math.max(lastCol, HEADERS.length + 1)).getValues()[0];
    const firstHeader = String(current[0] || '').trim().toLowerCase();
    if (firstHeader === 'id') {
      sheet.deleteColumn(1);
    }
    const updated = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), HEADERS.length)).getValues()[0];
    const hasKeterangan = updated.some(h => String(h || '').trim().toLowerCase() === 'keterangan');
    if (!hasKeterangan) {
      sheet.insertColumnAfter(3);
    }
  }
  sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  sheet.setFrozenRows(1);
}

function getData(companyKey) {
  const sheet = getTransactionSheet_(companyKey);
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return [];
  return values.slice(1).filter(row => String(row[0]).trim()).map(rowToTransaction_);
}

function getBanks() {
  const spreadsheet = openSpreadsheet_();
  const sheet = spreadsheet.getSheetByName(BANK_SHEET_NAME);
  if (!sheet || sheet.getLastRow() < 1) return [];
  return sheet.getRange(1, 1, sheet.getLastRow(), 1).getDisplayValues()
    .flat().map(value => String(value).trim()).filter(Boolean)
    .filter((value, index, values) => values.indexOf(value) === index);
}

function getTransactionById(id, companyKey) {
  const safeId = validateTransactionNumber_(id);
  const sheet = getTransactionSheet_(companyKey);
  const row = findRowByTransactionNumberInSheet_(sheet, safeId);
  if (!row) throw new Error('Transaksi tidak ditemukan pada perusahaan terkait.');
  return rowToTransaction_(row.values);
}

// SIMPAN FORM CEPAT (OPTIMIZED SAVE)
function addTransaction(payload, companyKey) {
  const input = validateTransactionPayload_(payload);
  const compConfig = getCompanyConfig_(companyKey);
  const sheet = getTransactionSheet_(compConfig.key);

  if (isTransactionNumberExistsInSheet_(sheet, input.noTransaksi)) {
    throw new Error('No transaksi "' + input.noTransaksi + '" sudah digunakan pada ' + compConfig.name + '.');
  }

  const now = new Date();
  const docs = saveDocuments_(input, input.noTransaksi, null, compConfig.key);
  const transaction = createTransactionObject_(input, docs, now, now);
  sheet.appendRow(transactionToRow_(transaction));
  return transaction;
}

// UPDATE FORM CEPAT (OPTIMIZED UPDATE)
function updateTransaction(id, payload, companyKey) {
  const safeId = validateTransactionNumber_(id);
  const input = validateTransactionPayload_(payload);
  const compConfig = getCompanyConfig_(companyKey);
  const sheet = getTransactionSheet_(compConfig.key);

  const found = findRowByTransactionNumberInSheet_(sheet, safeId);
  if (!found) throw new Error('Transaksi tidak ditemukan pada ' + compConfig.name + '.');

  if (String(input.noTransaksi).trim().toLowerCase() !== safeId.toLowerCase()) {
    const duplicate = findRowByTransactionNumberInSheet_(sheet, input.noTransaksi);
    if (duplicate && duplicate.rowNumber !== found.rowNumber) {
      throw new Error('No transaksi "' + input.noTransaksi + '" sudah digunakan pada ' + compConfig.name + '.');
    }
  }

  const previous = rowToTransaction_(found.values);
  const now = new Date();
  const docs = saveDocuments_(input, input.noTransaksi, previous, compConfig.key);
  const transaction = createTransactionObject_(input, docs, previous.createdAt || now, now);
  sheetUpdateRow_(found.sheet, found.rowNumber, transactionToRow_(transaction));
  return transaction;
}

// DELETE TRANSAKSI DENGAN PENCATATAN HISTORIS (IMMUTABLE AUDIT TRAIL)
function deleteTransaction(id, companyKey, clientInfo) {
  const safeId = validateTransactionNumber_(id);
  const compConfig = getCompanyConfig_(companyKey);
  const sheet = getTransactionSheet_(compConfig.key);

  const found = findRowByTransactionNumberInSheet_(sheet, safeId);
  if (!found) throw new Error('Transaksi tidak ditemukan pada ' + compConfig.name + '.');

  // Ambil snapshot kondisi data transaksi sebelum dihapus
  const txData = rowToTransaction_(found.values);

  // Ambil email resmi dari Google Apps Script environment jika tersedia
  let userEmail = '';
  try {
    userEmail = Session.getActiveUser().getEmail();
  } catch (e) {}
  if (!userEmail) {
    try {
      userEmail = Session.getEffectiveUser().getEmail();
    } catch (e) {}
  }
  if (!userEmail && clientInfo && clientInfo.userEmail) {
    userEmail = String(clientInfo.userEmail).trim();
  }
  if (!userEmail) {
    userEmail = 'Pengguna Web / Terotorisasi';
  }

  // Device / Browser
  const device = clientInfo && clientInfo.device ? String(clientInfo.device).slice(0, 200) : 'Browser Client';
  const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Jakarta', 'yyyy-MM-dd HH:mm:ss');

  const historyRow = [
    timestamp,
    compConfig.name,
    txData.noTransaksi,
    txData.namaBank,
    txData.tanggalTransaksi,
    txData.keterangan || '',
    txData.jumlahTransaksi,
    txData.statusBukti,
    userEmail,
    device,
    'DELETE'
  ];

  // LANGKAH PENTING: Catat ke sheet HISTORIS TERLEBIH DAHULU!
  // Jika pencatatan histori gagal, batalkan penghapusan transaksi demi integritas data.
  const historisSheet = getHistorisSheet_();
  try {
    historisSheet.appendRow(historyRow);
  } catch (err) {
    throw new Error('Gagal mencatat audit log Historis: ' + (err.message || String(err)) + '. Penghapusan transaksi dibatalkan demi keamanan data.');
  }

  // Setelah histori tersimpan aman, hapus baris dari sheet perusahaan
  found.sheet.deleteRow(found.rowNumber);
  return { success: true, id: safeId, company: compConfig.name };
}

// BACA HISTORIS DATA (READ ONLY - TIDAK ADA EDIT/DELETE)
function getHistorisData() {
  const sheet = getHistorisSheet_();
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return [];

  const list = [];
  for (let i = values.length - 1; i >= 1; i--) {
    const r = values[i];
    if (!String(r[0] || '').trim() && !String(r[2] || '').trim()) continue;
    list.push({
      timestamp: String(r[0] || ''),
      perusahaan: String(r[1] || ''),
      noTransaksi: String(r[2] || ''),
      namaBank: String(r[3] || ''),
      tanggalTransaksi: formatDateInput_(r[4]),
      keterangan: String(r[5] || ''),
      jumlahTransaksi: parseNominal_(r[6]) || 0,
      statusBukti: String(r[7] || ''),
      email: String(r[8] || '-'),
      device: String(r[9] || '-'),
      aktivitas: String(r[10] || 'DELETE')
    });
  }
  return list;
}

function getHistoris() {
  return getHistorisData();
}

// STATISTIK DASHBOARD CEPAT DARI DATA AKTUAL 4 PERUSAHAAN
function getDashboardStats() {
  const spreadsheet = openSpreadsheet_();
  const stats = {};
  let overallTotal = 0;
  let overallLengkap = 0;
  let overallSebagian = 0;
  let overallTidakAda = 0;
  let overallAmount = 0;

  for (const k in COMPANIES) {
    const comp = COMPANIES[k];
    let sheet = spreadsheet.getSheetByName(comp.sheetName);
    if (!sheet && comp.key === 'PATRIA') {
      sheet = spreadsheet.getSheetByName('Transaksi');
    }

    let total = 0;
    let lengkap = 0;
    let sebagian = 0;
    let tidakAda = 0;
    let amount = 0;

    if (sheet && sheet.getLastRow() > 1) {
      const numRows = sheet.getLastRow() - 1;
      const dataValues = sheet.getRange(2, 1, numRows, Math.min(sheet.getLastColumn(), 14)).getValues();

      for (let i = 0; i < dataValues.length; i++) {
        const row = dataValues[i];
        let offset = 0;
        if (row.length >= 15 && isNaN(parseNominal_(row[4])) && !isNaN(parseNominal_(row[5]))) {
          offset = 1;
        }
        const noTrans = String(row[offset] || '').trim();
        if (!noTrans) continue;

        total++;
        const amt = parseNominal_(row[offset + 4]) || 0;
        amount += amt;

        let status = String(row[offset + 8] || '').trim().toUpperCase();
        if (!status) {
          const doc1 = row[offset + 5];
          const doc2 = row[offset + 6];
          const doc3 = row[offset + 7];
          status = calculateStatus([doc1, doc2, doc3]);
        }

        if (status === 'BUKTI LENGKAP') {
          lengkap++;
        } else if (status === 'SEBAGIAN LENGKAP') {
          sebagian++;
        } else {
          tidakAda++;
        }
      }
    }

    const persentaseLengkap = total > 0 ? Math.round((lengkap / total) * 100) : 0;
    const persentaseSebagian = total > 0 ? Math.round((sebagian / total) * 100) : 0;
    const persentaseTidakAda = total > 0 ? Math.round((tidakAda / total) * 100) : 0;

    stats[comp.key] = {
      key: comp.key,
      name: comp.name,
      total: total,
      amount: amount,
      lengkap: lengkap,
      sebagian: sebagian,
      tidakAda: tidakAda,
      persentaseLengkap: persentaseLengkap,
      persentaseSebagian: persentaseSebagian,
      persentaseTidakAda: persentaseTidakAda
    };

    overallTotal += total;
    overallAmount += amount;
    overallLengkap += lengkap;
    overallSebagian += sebagian;
    overallTidakAda += tidakAda;
  }

  stats.overall = {
    total: overallTotal,
    amount: overallAmount,
    lengkap: overallLengkap,
    sebagian: overallSebagian,
    tidakAda: overallTidakAda,
    persentaseLengkap: overallTotal > 0 ? Math.round((overallLengkap / overallTotal) * 100) : 0,
    persentaseSebagian: overallTotal > 0 ? Math.round((overallSebagian / overallTotal) * 100) : 0,
    persentaseTidakAda: overallTotal > 0 ? Math.round((overallTidakAda / overallTotal) * 100) : 0
  };

  return stats;
}

// IMPORT TRANSAKSI BATCH OPTIMAL (SATU REQUEST SETVALUES)
function importTransactions(rows, companyKey) {
  if (!Array.isArray(rows) || !rows.length) {
    throw new Error('Tidak ada data transaksi untuk diimpor.');
  }
  const compConfig = getCompanyConfig_(companyKey);
  const sheet = getTransactionSheet_(compConfig.key);

  // Ambil daftar No Transaksi yang sudah ada di sheet untuk validasi duplikasi cepat
  const lastRow = sheet.getLastRow();
  const existingSet = new Set();
  if (lastRow > 1) {
    const existingValues = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (let i = 0; i < existingValues.length; i++) {
      const val = String(existingValues[i][0] || '').trim().toLowerCase();
      if (val) existingSet.add(val);
    }
  }

  // Pre-fetch bank list sekali saja agar performa import cepat
  const banks = getBanks();
  const batchRows = [];
  const resultTransactions = [];
  const now = new Date();

  for (let i = 0; i < rows.length; i++) {
    const item = rows[i];
    const noTrans = String(item.noTransaksi || '').trim();
    if (!noTrans) {
      throw new Error('Baris ' + (i + 1) + ': No Transaksi wajib diisi.');
    }
    const noTransLower = noTrans.toLowerCase();
    if (existingSet.has(noTransLower)) {
      throw new Error('Baris ' + (i + 1) + ': No Transaksi "' + noTrans + '" sudah ada di ' + compConfig.name + '.');
    }
    existingSet.add(noTransLower);

    const input = validateTransactionPayload_(item, banks);
    const docs = {
      buktiPengajuan: item.buktiPengajuan && typeof item.buktiPengajuan === 'object' ? item.buktiPengajuan : (item.buktiPengajuan ? { fileName: String(item.buktiPengajuan), fileUrl: String(item.linkBuktiPengajuan || '') } : null),
      buktiBayar: item.buktiBayar && typeof item.buktiBayar === 'object' ? item.buktiBayar : (item.buktiBayar ? { fileName: String(item.buktiBayar), fileUrl: String(item.linkBuktiBayar || '') } : null),
      invoice: item.invoice && typeof item.invoice === 'object' ? item.invoice : (item.invoice ? { fileName: String(item.invoice), fileUrl: String(item.linkInvoice || '') } : null)
    };

    const transaction = createTransactionObject_(input, docs, now, now);
    batchRows.push(transactionToRow_(transaction));
    resultTransactions.push(transaction);
  }

  if (batchRows.length > 0) {
    const startRow = sheet.getLastRow() + 1;
    sheet.getRange(startRow, 1, batchRows.length, HEADERS.length).setValues(batchRows);
    // Pastikan kolom No Transaksi diformat sebagai plain text agar 0 di depan tidak hilang
    try {
      sheet.getRange(startRow, 1, batchRows.length, 1).setNumberFormat('@');
    } catch (e) {}
    SpreadsheetApp.flush();
  }

  return resultTransactions;
}

function uploadFile(payload, companyKey) {
  if (!payload || !payload.base64 || !payload.fileName || !payload.documentKey) throw new Error('Data file tidak lengkap.');
  if (!/\.(jpe?g|png|pdf)$/i.test(payload.fileName)) {
    throw new Error('Format file tidak didukung. Gunakan JPG, JPEG, PNG, atau PDF.');
  }
  const noTransaksi = validateTransactionNumber_(payload.noTransaksi || payload.transactionId || 'DOKUMEN');
  const input = { noTransaksi: noTransaksi, tanggalTransaksi: payload.tanggalTransaksi || formatDateInput_(new Date()) };
  const file = saveFileToDrive_(payload, input, noTransaksi, payload.documentKey, companyKey);
  return { fileId: file.getId(), fileUrl: file.getUrl(), fileName: file.getName() };
}

function calculateStatus(documentValues) {
  const values = Array.isArray(documentValues) ? documentValues : [documentValues];
  const count = values.filter(value => {
    if (value && typeof value === 'object') return Boolean(value.fileName || value.fileId || value.fileUrl || value.url);
    return Boolean(String(value || '').trim());
  }).length;
  return count === 3 ? 'BUKTI LENGKAP' : count > 0 ? 'SEBAGIAN LENGKAP' : 'TIDAK ADA BUKTI';
}

function validateTransactionPayload_(payload, bankList) {
  if (!payload || typeof payload !== 'object') throw new Error('Data transaksi tidak valid.');
  const noTransaksi = String(payload.noTransaksi || '').trim();
  let namaBank = String(payload.namaBank || '').trim();
  const tanggalTransaksi = String(payload.tanggalTransaksi || '').trim();
  const keterangan = String(payload.keterangan || '').trim();
  const jumlahTransaksi = parseNominal_(payload.jumlahTransaksi);

  if (!noTransaksi) throw new Error('No transaksi wajib diisi.');
  if (!namaBank) throw new Error('Nama bank wajib diisi.');
  if (!tanggalTransaksi || isNaN(new Date(tanggalTransaksi).getTime())) throw new Error('Tanggal transaksi tidak valid.');
  if (!isFinite(jumlahTransaksi) || jumlahTransaksi <= 0) throw new Error('Jumlah transaksi harus berupa angka lebih besar dari 0.');

  const banks = bankList || getBanks();
  if (banks && banks.length) {
    const match = banks.find(b => b.toLowerCase() === namaBank.toLowerCase());
    if (match) {
      namaBank = match;
    }
  }

  ['buktiPengajuan', 'buktiBayar', 'invoice'].forEach(key => validateDocument_(payload[key], key));
  return {
    noTransaksi,
    namaBank,
    tanggalTransaksi,
    keterangan,
    jumlahTransaksi,
    buktiPengajuan: payload.buktiPengajuan || null,
    buktiBayar: payload.buktiBayar || null,
    invoice: payload.invoice || null
  };
}

function validateDocument_(document, key) {
  if (!document) return;
  if (typeof document === 'string') {
    if (!isDriveUrl_(document)) throw new Error('Link ' + key + ' harus berasal dari Google Drive.');
    return;
  }
  const url = document.url || document.fileUrl;
  if (url && !document.base64 && !isDriveUrl_(url)) {
    throw new Error('Link ' + key + ' harus berasal dari Google Drive.');
  }
  if (document.base64) {
    if (!document.fileName) throw new Error('Data file ' + key + ' tidak lengkap.');
    if (!/\.(jpe?g|png|pdf)$/i.test(document.fileName)) {
      throw new Error('Format file tidak didukung. Gunakan JPG, JPEG, PNG, atau PDF.');
    }
    if (document.base64.length > 14 * 1024 * 1024) throw new Error('File ' + key + ' terlalu besar (maksimal 10 MB).');
  }
}

function isDriveUrl_(url) {
  return /^https:\/\/(drive\.google\.com|docs\.google\.com)\//i.test(String(url || '').trim());
}

function validateTransactionNumber_(no) {
  const value = String(no || '').trim();
  if (!value) throw new Error('No transaksi tidak valid.');
  return value;
}

function saveDocuments_(input, transactionNumber, previous, companyKey) {
  const result = { buktiPengajuan: previous && previous.buktiPengajuan || null, buktiBayar: previous && previous.buktiBayar || null, invoice: previous && previous.invoice || null };
  ['buktiPengajuan', 'buktiBayar', 'invoice'].forEach(key => {
    const value = input[key];
    if (value === undefined) return;
    if (value === null) {
      result[key] = null;
      return;
    }
    if (value.base64) {
      const file = saveFileToDrive_(value, input, transactionNumber, key, companyKey);
      result[key] = { fileId: file.getId(), fileName: file.getName(), fileUrl: file.getUrl() };
    } else if (value.url) {
      result[key] = { fileId: value.fileId || extractDriveId_(value.url), fileName: value.name || value.fileName || 'Link Google Drive', fileUrl: value.url };
    } else if (value.fileId || value.fileUrl || value.fileName) {
      result[key] = { fileId: value.fileId || '', fileName: value.fileName || value.name || '', fileUrl: value.fileUrl || value.url || '' };
    }
  });
  return result;
}

function saveFileToDrive_(payload, input, transactionNumber, documentKey, companyKey) {
  if (!DRIVE_FOLDER_ID || DRIVE_FOLDER_ID === 'ISI_ID_FOLDER_DRIVE') throw new Error('Ganti DRIVE_FOLDER_ID di Code.gs terlebih dahulu.');
  const root = DriveApp.getFolderById(DRIVE_FOLDER_ID);
  const compConfig = getCompanyConfig_(companyKey);
  const compFolder = getOrCreateFolder_(root, compConfig.name);
  const date = new Date(input.tanggalTransaksi);
  const yearFolder = getOrCreateFolder_(compFolder, String(date.getFullYear()));
  const monthFolder = getOrCreateFolder_(yearFolder, monthName_(date.getMonth()));
  const transactionFolder = getOrCreateFolder_(monthFolder, String(input.noTransaksi || transactionNumber));
  const documentFolder = getOrCreateFolder_(transactionFolder, documentFolderName_(documentKey));
  const bytes = Utilities.base64Decode(String(payload.base64).replace(/^data:[^;]+;base64,/, ''));
  let mime = payload.mimeType;
  if (!mime || mime === 'application/octet-stream') {
    const ext = String(payload.fileName || '').toLowerCase();
    if (ext.endsWith('.png')) mime = MimeType.PNG;
    else if (ext.endsWith('.jpg') || ext.endsWith('.jpeg')) mime = MimeType.JPEG;
    else if (ext.endsWith('.pdf')) mime = MimeType.PDF;
    else mime = MimeType.PDF;
  }
  const blob = Utilities.newBlob(bytes, mime, sanitizeFileName_(payload.fileName));
  const file = documentFolder.createFile(blob);
  try {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (e) {}
  return file;
}

function getOrCreateFolder_(parent, name) {
  const folders = parent.getFoldersByName(name);
  return folders.hasNext() ? folders.next() : parent.createFolder(name);
}

function monthName_(monthIndex) { return ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'][monthIndex]; }
function documentFolderName_(key) { return ({ buktiPengajuan: 'Bukti Pengajuan', buktiBayar: 'Bukti Bayar', invoice: 'Invoice' })[key] || 'Dokumen'; }
function sanitizeFileName_(name) { return String(name || 'dokumen').replace(/[\\/:*?"<>|#%]/g, '_').slice(0, 180); }

function createTransactionObject_(input, docs, createdAt, updatedAt) {
  return {
    id: input.noTransaksi,
    noTransaksi: input.noTransaksi,
    namaBank: input.namaBank,
    tanggalTransaksi: input.tanggalTransaksi,
    keterangan: input.keterangan || '',
    jumlahTransaksi: input.jumlahTransaksi,
    buktiPengajuan: docs.buktiPengajuan,
    buktiBayar: docs.buktiBayar,
    invoice: docs.invoice,
    statusBukti: calculateStatus([docs.buktiPengajuan, docs.buktiBayar, docs.invoice]),
    createdAt: createdAt instanceof Date ? createdAt.toISOString() : String(createdAt),
    updatedAt: updatedAt instanceof Date ? updatedAt.toISOString() : String(updatedAt)
  };
}

function transactionToRow_(transaction) {
  return [
    transaction.noTransaksi,
    transaction.namaBank,
    transaction.tanggalTransaksi,
    transaction.keterangan || '',
    transaction.jumlahTransaksi,
    documentName_(transaction.buktiPengajuan),
    documentName_(transaction.buktiBayar),
    documentName_(transaction.invoice),
    transaction.statusBukti,
    documentUrl_(transaction.buktiPengajuan),
    documentUrl_(transaction.buktiBayar),
    documentUrl_(transaction.invoice),
    transaction.createdAt,
    transaction.updatedAt
  ];
}
function documentName_(document) { return document ? document.fileName || document.name || '' : ''; }
function documentUrl_(document) { return document ? document.fileUrl || document.url || '' : ''; }

function rowToTransaction_(row) {
  const makeDocument = (name, url) => (name || url) ? { fileId: extractDriveId_(url), fileName: String(name || 'Link Google Drive'), fileUrl: String(url || '') } : null;
  
  let offset = 0;
  if (row.length >= 15 && isNaN(parseNominal_(row[4])) && !isNaN(parseNominal_(row[5]))) {
    offset = 1;
  }

  const noTransaksi = String(row[offset]);
  const namaBank = String(row[offset + 1]);
  const tanggalTransaksi = formatDateInput_(row[offset + 2]);
  const keterangan = String(row[offset + 3] || '');
  const jumlahTransaksi = parseNominal_(row[offset + 4]) || 0;
  const docPengajuanName = row[offset + 5];
  const docBayarName = row[offset + 6];
  const invoiceName = row[offset + 7];
  const statusBukti = String(row[offset + 8] || calculateStatus([docPengajuanName, docBayarName, invoiceName]));
  const docPengajuanUrl = row[offset + 9];
  const docBayarUrl = row[offset + 10];
  const invoiceUrl = row[offset + 11];
  const createdAt = toIso_(row[offset + 12]);
  const updatedAt = toIso_(row[offset + 13]);

  return {
    id: noTransaksi,
    noTransaksi: noTransaksi,
    namaBank: namaBank,
    tanggalTransaksi: tanggalTransaksi,
    keterangan: keterangan,
    jumlahTransaksi: jumlahTransaksi,
    buktiPengajuan: makeDocument(docPengajuanName, docPengajuanUrl),
    buktiBayar: makeDocument(docBayarName, docBayarUrl),
    invoice: makeDocument(invoiceName, invoiceUrl),
    statusBukti: statusBukti,
    createdAt: createdAt,
    updatedAt: updatedAt
  };
}

function extractDriveId_(url) { const match = String(url || '').match(/[-\w]{20,}/); return match ? match[0] : ''; }
function formatDateInput_(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (isNaN(date.getTime())) return String(value || '');
  return Utilities.formatDate(date, Session.getScriptTimeZone() || 'Asia/Jakarta', 'yyyy-MM-dd');
}
function toIso_(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  return isNaN(date.getTime()) ? '' : date.toISOString();
}

function isTransactionNumberExistsInSheet_(sheet, number) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return false;
  const values = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  const target = String(number || '').trim().toLowerCase();
  for (let i = 0; i < values.length; i++) {
    if (String(values[i][0] || '').trim().toLowerCase() === target) {
      return true;
    }
  }
  return false;
}

function findRowByTransactionNumberInSheet_(sheet, number) {
  const values = sheet.getDataRange().getValues();
  const target = String(number || '').trim().toLowerCase();
  for (let index = 1; index < values.length; index++) {
    const colVal = String(values[index][0] || '').trim().toLowerCase();
    const col2Val = values[index].length > 1 ? String(values[index][1] || '').trim().toLowerCase() : '';
    if (colVal === target || col2Val === target) {
      return { sheet, rowNumber: index + 1, values: values[index] };
    }
  }
  return null;
}

function sheetUpdateRow_(sheet, rowNumber, values) { sheet.getRange(rowNumber, 1, 1, values.length).setValues([values]); }

function parseNominal_(val) {
  if (typeof val === 'number') return isFinite(val) ? val : NaN;
  if (val === null || val === undefined) return NaN;
  let s = String(val).trim();
  s = s.replace(/^(?:Rp|IDR)\.?\s*/i, '').replace(/\s/g, '');
  if (!s) return NaN;

  if (s.includes('.') && s.includes(',')) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
  } else if (s.includes(',')) {
    if ((s.match(/,/g) || []).length > 1) {
      s = s.replace(/,/g, '');
    } else {
      s = s.replace(',', '.');
    }
  } else if (s.includes('.')) {
    if ((s.match(/\./g) || []).length > 1) {
      s = s.replace(/\./g, '');
    } else {
      const parts = s.split('.');
      if (parts[1] && parts[1].length === 3 && parts[0].length >= 1) {
        s = s.replace('.', '');
      }
    }
  }

  const num = Number(s);
  return isFinite(num) ? num : NaN;
}
