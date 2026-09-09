const SPREADSHEET_ID = '1L8cu2jbefLBlrxbRFYvEqPUSjPd7_8xsx8Ssm70wfGs';
const SHEET_NAME = 'Transaksi';
const BANK_SHEET_NAME = 'Bank';
const DRIVE_FOLDER_ID = '1AlsC2ZLYSKi7E5Yf2VeccyXK1Y5NSCyC';

const HEADERS = [
  'ID', 'No Transaksi', 'Nama Bank', 'Tanggal Transaksi', 'Jumlah Transaksi',
  'Bukti Pengajuan', 'Bukti Bayar', 'Invoice', 'Status Bukti',
  'Link Bukti Pengajuan', 'Link Bukti Bayar', 'Link Invoice', 'Created At', 'Updated At'
];

function doGet(e) {
  if (e && e.parameter && e.parameter.action) {
    return handleApiRequest_(e.parameter.action, e.parameter);
  }
  try {
    return HtmlService.createHtmlOutputFromFile('Index')
      .setTitle('Verifikasi Filling')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  } catch (err) {
    return HtmlService.createHtmlOutputFromFile('index')
      .setTitle('Verifikasi Filling')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
}

function doPost(e) {
  try {
    let payload = {};
    if (e && e.postData && e.postData.contents) {
      payload = JSON.parse(e.postData.contents);
    } else if (e && e.parameter) {
      payload = e.parameter;
    }
    const action = payload.action;
    const args = payload.args || [];
    let result;
    if (action === 'getData') {
      result = getData();
    } else if (action === 'getBanks') {
      result = getBanks();
    } else if (action === 'getTransactionById') {
      result = getTransactionById(args[0]);
    } else if (action === 'addTransaction') {
      result = addTransaction(args[0]);
    } else if (action === 'updateTransaction') {
      result = updateTransaction(args[0], args[1]);
    } else if (action === 'deleteTransaction') {
      result = deleteTransaction(args[0]);
    } else if (action === 'uploadFile') {
      result = uploadFile(args[0]);
    } else {
      throw new Error('Action tidak valid: ' + action);
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
    let result;
    if (action === 'getData') {
      result = getData();
    } else if (action === 'getBanks') {
      result = getBanks();
    } else if (action === 'getTransactionById') {
      result = getTransactionById(params.id);
    } else {
      throw new Error('Action tidak dikenal: ' + action);
    }
    return ContentService.createTextOutput(JSON.stringify({ success: true, data: result }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.message || String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function getData() {
  const sheet = getTransactionSheet_();
  ensureHeaders_(sheet);
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

function getTransactionById(id) {
  const safeId = validateId_(id);
  const row = findRowById_(safeId);
  if (!row) throw new Error('Transaksi tidak ditemukan.');
  return rowToTransaction_(row.values);
}

function addTransaction(payload) {
  const input = validateTransactionPayload_(payload);
  const sheet = getTransactionSheet_();
  ensureHeaders_(sheet);
  if (findRowByTransactionNumber_(input.noTransaksi)) throw new Error('No transaksi sudah digunakan.');
  const id = Utilities.getUuid();
  const now = new Date();
  const docs = saveDocuments_(input, id);
  const transaction = createTransactionObject_(id, input, docs, now, now);
  sheet.appendRow(transactionToRow_(transaction));
  return transaction;
}

function updateTransaction(id, payload) {
  const safeId = validateId_(id);
  const input = validateTransactionPayload_(payload);
  const found = findRowById_(safeId);
  if (!found) throw new Error('Transaksi tidak ditemukan.');
  const duplicate = findRowByTransactionNumber_(input.noTransaksi);
  if (duplicate && duplicate.rowNumber !== found.rowNumber) throw new Error('No transaksi sudah digunakan.');
  const previous = rowToTransaction_(found.values);
  const now = new Date();
  const docs = saveDocuments_(input, safeId, previous);
  const transaction = createTransactionObject_(safeId, input, docs, previous.createdAt || now, now);
  sheetUpdateRow_(found.sheet, found.rowNumber, transactionToRow_(transaction));
  return transaction;
}

function deleteTransaction(id) {
  const safeId = validateId_(id);
  const found = findRowById_(safeId);
  if (!found) throw new Error('Transaksi tidak ditemukan.');
  found.sheet.deleteRow(found.rowNumber);
  return { success: true, id: safeId };
}

function uploadFile(payload) {
  if (!payload || !payload.base64 || !payload.fileName || !payload.documentKey) throw new Error('Data file tidak lengkap.');
  if (!/\.(jpe?g|png|pdf)$/i.test(payload.fileName)) {
    throw new Error('Format file tidak didukung. Gunakan JPG, JPEG, PNG, atau PDF.');
  }
  const safeId = validateId_(payload.transactionId || Utilities.getUuid());
  const input = { noTransaksi: payload.noTransaksi || safeId, tanggalTransaksi: payload.tanggalTransaksi || formatDateInput_(new Date()) };
  const file = saveFileToDrive_(payload, input, safeId, payload.documentKey);
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

function openSpreadsheet_() {
  if (!SPREADSHEET_ID || SPREADSHEET_ID === 'ISI_ID_SPREADSHEET') throw new Error('Ganti SPREADSHEET_ID di Code.gs terlebih dahulu.');
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function getTransactionSheet_() {
  const sheet = openSpreadsheet_().getSheetByName(SHEET_NAME);
  if (!sheet) throw new Error('Sheet Transaksi belum dibuat.');
  return sheet;
}

function ensureHeaders_(sheet) {
  const current = sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0];
  if (HEADERS.some((header, index) => String(current[index] || '').trim() !== header)) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.setFrozenRows(1);
  }
}

function validateTransactionPayload_(payload) {
  if (!payload || typeof payload !== 'object') throw new Error('Data transaksi tidak valid.');
  const noTransaksi = String(payload.noTransaksi || '').trim();
  const namaBank = String(payload.namaBank || '').trim();
  const tanggalTransaksi = String(payload.tanggalTransaksi || '').trim();
  const jumlahTransaksi = Number(payload.jumlahTransaksi);
  if (!noTransaksi) throw new Error('No transaksi wajib diisi.');
  if (!/^[A-Za-z0-9][A-Za-z0-9._\/-]{1,79}$/.test(noTransaksi)) throw new Error('No transaksi mengandung karakter yang tidak aman.');
  if (!namaBank) throw new Error('Nama bank wajib diisi.');
  if (!tanggalTransaksi || isNaN(new Date(tanggalTransaksi).getTime())) throw new Error('Tanggal transaksi tidak valid.');
  if (!isFinite(jumlahTransaksi) || jumlahTransaksi <= 0) throw new Error('Jumlah transaksi harus berupa angka lebih besar dari 0.');
  const banks = getBanks();
  if (banks.length && banks.indexOf(namaBank) === -1) throw new Error('Nama bank tidak tersedia pada sheet Bank.');
  ['buktiPengajuan', 'buktiBayar', 'invoice'].forEach(key => validateDocument_(payload[key], key));
  return { noTransaksi, namaBank, tanggalTransaksi, jumlahTransaksi, buktiPengajuan: payload.buktiPengajuan || null, buktiBayar: payload.buktiBayar || null, invoice: payload.invoice || null };
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

function validateId_(id) {
  const value = String(id || '').trim();
  if (!value || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,120}$/.test(value)) throw new Error('ID transaksi tidak valid.');
  return value;
}

function saveDocuments_(input, transactionId, previous) {
  const result = { buktiPengajuan: previous && previous.buktiPengajuan || null, buktiBayar: previous && previous.buktiBayar || null, invoice: previous && previous.invoice || null };
  ['buktiPengajuan', 'buktiBayar', 'invoice'].forEach(key => {
    const value = input[key];
    if (value === undefined) return;
    if (value === null) {
      result[key] = null;
      return;
    }
    if (value.base64) {
      const file = saveFileToDrive_(value, input, transactionId, key);
      result[key] = { fileId: file.getId(), fileName: file.getName(), fileUrl: file.getUrl() };
    } else if (value.url) {
      result[key] = { fileId: value.fileId || extractDriveId_(value.url), fileName: value.name || value.fileName || 'Link Google Drive', fileUrl: value.url };
    } else if (value.fileId || value.fileUrl || value.fileName) {
      result[key] = { fileId: value.fileId || '', fileName: value.fileName || value.name || '', fileUrl: value.fileUrl || value.url || '' };
    }
  });
  return result;
}

function saveFileToDrive_(payload, input, transactionId, documentKey) {
  if (!DRIVE_FOLDER_ID || DRIVE_FOLDER_ID === 'ISI_ID_FOLDER_DRIVE') throw new Error('Ganti DRIVE_FOLDER_ID di Code.gs terlebih dahulu.');
  const root = DriveApp.getFolderById(DRIVE_FOLDER_ID);
  const date = new Date(input.tanggalTransaksi);
  const yearFolder = getOrCreateFolder_(root, String(date.getFullYear()));
  const monthFolder = getOrCreateFolder_(yearFolder, monthName_(date.getMonth()));
  const transactionFolder = getOrCreateFolder_(monthFolder, String(input.noTransaksi || transactionId));
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
  } catch (e) {
    // Tetap lanjutkan jika domain membatasi sharing publik
  }
  return file;
}

function getOrCreateFolder_(parent, name) {
  const folders = parent.getFoldersByName(name);
  return folders.hasNext() ? folders.next() : parent.createFolder(name);
}

function monthName_(monthIndex) { return ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'][monthIndex]; }
function documentFolderName_(key) { return ({ buktiPengajuan: 'Bukti Pengajuan', buktiBayar: 'Bukti Bayar', invoice: 'Invoice' })[key] || 'Dokumen'; }
function sanitizeFileName_(name) { return String(name || 'dokumen').replace(/[\\/:*?"<>|#%]/g, '_').slice(0, 180); }

function createTransactionObject_(id, input, docs, createdAt, updatedAt) {
  return { id, noTransaksi: input.noTransaksi, namaBank: input.namaBank, tanggalTransaksi: input.tanggalTransaksi, jumlahTransaksi: input.jumlahTransaksi, buktiPengajuan: docs.buktiPengajuan, buktiBayar: docs.buktiBayar, invoice: docs.invoice, statusBukti: calculateStatus([docs.buktiPengajuan, docs.buktiBayar, docs.invoice]), createdAt: createdAt instanceof Date ? createdAt.toISOString() : String(createdAt), updatedAt: updatedAt instanceof Date ? updatedAt.toISOString() : String(updatedAt) };
}

function transactionToRow_(transaction) {
  return [transaction.id, transaction.noTransaksi, transaction.namaBank, transaction.tanggalTransaksi, transaction.jumlahTransaksi, documentName_(transaction.buktiPengajuan), documentName_(transaction.buktiBayar), documentName_(transaction.invoice), transaction.statusBukti, documentUrl_(transaction.buktiPengajuan), documentUrl_(transaction.buktiBayar), documentUrl_(transaction.invoice), transaction.createdAt, transaction.updatedAt];
}
function documentName_(document) { return document ? document.fileName || document.name || '' : ''; }
function documentUrl_(document) { return document ? document.fileUrl || document.url || '' : ''; }

function rowToTransaction_(row) {
  const makeDocument = (name, url) => (name || url) ? { fileId: extractDriveId_(url), fileName: String(name || 'Link Google Drive'), fileUrl: String(url || '') } : null;
  return { id: String(row[0]), noTransaksi: String(row[1]), namaBank: String(row[2]), tanggalTransaksi: formatDateInput_(row[3]), jumlahTransaksi: Number(row[4]) || 0, buktiPengajuan: makeDocument(row[5], row[9]), buktiBayar: makeDocument(row[6], row[10]), invoice: makeDocument(row[7], row[11]), statusBukti: String(row[8] || calculateStatus([row[5], row[6], row[7]])), createdAt: toIso_(row[12]), updatedAt: toIso_(row[13]) };
}
function extractDriveId_(url) { const match = String(url || '').match(/[-\w]{20,}/); return match ? match[0] : ''; }
function formatDateInput_(value) { const date = value instanceof Date ? value : new Date(value); return Utilities.formatDate(date, Session.getScriptTimeZone() || 'Asia/Jakarta', 'yyyy-MM-dd'); }
function toIso_(value) { const date = value instanceof Date ? value : new Date(value); return isNaN(date.getTime()) ? '' : date.toISOString(); }
function findRowById_(id) { const sheet = getTransactionSheet_(); const values = sheet.getDataRange().getValues(); for (let index = 1; index < values.length; index++) if (String(values[index][0]) === id) return { sheet, rowNumber: index + 1, values: values[index] }; return null; }
function findRowByTransactionNumber_(number) { const sheet = getTransactionSheet_(); const values = sheet.getDataRange().getValues(); for (let index = 1; index < values.length; index++) if (String(values[index][1]).trim().toLowerCase() === String(number).trim().toLowerCase()) return { sheet, rowNumber: index + 1, values: values[index] }; return null; }
function sheetUpdateRow_(sheet, rowNumber, values) { sheet.getRange(rowNumber, 1, 1, values.length).setValues([values]); }
