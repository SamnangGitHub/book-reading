/**
 * Khmer Reader storage API. Run setup() once from the Apps Script editor,
 * then deploy this project as a web app.
 */
function setup() {
  const properties = PropertiesService.getScriptProperties();
  let spreadsheetId = properties.getProperty('SPREADSHEET_ID');
  if (!spreadsheetId) {
    const spreadsheet = SpreadsheetApp.create('Khmer Reader Library');
    spreadsheetId = spreadsheet.getId();
    properties.setProperty('SPREADSHEET_ID', spreadsheetId);
    const books = spreadsheet.getSheets()[0];
    books.setName('Books');
    if (books.getLastRow() === 0) books.appendRow(['bookId', 'title', 'titleKhmer', 'author', 'coverImage', 'isHidden', 'bookType', 'isComingSoon']);
    else {
      if (books.getLastColumn() < 6) books.getRange(1, 6).setValue('isHidden');
      if (books.getLastColumn() < 7) books.getRange(1, 7).setValue('bookType');
      if (books.getLastColumn() < 8) books.getRange(1, 8).setValue('isComingSoon');
    }
    const pages = spreadsheet.insertSheet('Pages');
    pages.appendRow(['bookId', 'pageId', 'pageNumber', 'originalText', 'khmerText', 'audioUrl', 'audioFileName']);
    spreadsheet.insertSheet('Users').appendRow(['username', 'phone', 'passwordHash', 'updatedAt']);
    spreadsheet.insertSheet('Progress').appendRow(['username', 'bookId', 'pageIndex', 'updatedAt']);
  }

  let folderId = properties.getProperty('DRIVE_FOLDER_ID');
  if (!folderId) {
    const folder = DriveApp.createFolder('Khmer Reader Media');
    folderId = folder.getId();
    properties.setProperty('DRIVE_FOLDER_ID', folderId);
  }
  const activeSpreadsheet = SpreadsheetApp.openById(spreadsheetId);
  const booksSheet = activeSpreadsheet.getSheetByName('Books');
  if (booksSheet.getLastRow() === 0) booksSheet.appendRow(['bookId', 'title', 'titleKhmer', 'author', 'coverImage', 'isHidden', 'bookType', 'isComingSoon']);
  else {
    if (!String(booksSheet.getRange(1, 7).getValue() || '').trim()) booksSheet.getRange(1, 7).setValue('bookType');
    if (!String(booksSheet.getRange(1, 8).getValue() || '').trim()) booksSheet.getRange(1, 8).setValue('isComingSoon');
  }
  if (!activeSpreadsheet.getSheetByName('Users')) activeSpreadsheet.insertSheet('Users').appendRow(['username', 'phone', 'passwordHash', 'updatedAt']);
  if (!activeSpreadsheet.getSheetByName('Progress')) activeSpreadsheet.insertSheet('Progress').appendRow(['username', 'bookId', 'pageIndex', 'updatedAt']);
  Logger.log('Spreadsheet: https://docs.google.com/spreadsheets/d/' + spreadsheetId);
  Logger.log('Drive folder: https://drive.google.com/drive/folders/' + folderId);
}

function doGet() {
  return jsonOutput({ ok: false, error: 'Use the authenticated Render API.' });
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const expectedSecret = PropertiesService.getScriptProperties().getProperty('INTEGRATION_SECRET');
    if (!expectedSecret || payload.secret !== expectedSecret) {
      return jsonOutput({ ok: false, error: 'Unauthorized storage request.' });
    }
    if (payload.action === 'list') return jsonOutput({ ok: true, books: readBooks_() });
    if (payload.action === 'register' || payload.action === 'login') return jsonOutput(userAuth_(payload));
    if (payload.action === 'progress') return jsonOutput(saveProgress_(payload));
    if (payload.action === 'getProgress') return jsonOutput({ ok: true, progress: readProgress_(payload.username) });
    if (payload.action === 'media' && /^[\w-]{20,}$/.test(String(payload.fileId || ''))) {
      if (!isStoredMediaFile_(payload.fileId)) return jsonOutput({ ok: false, error: 'Media file is not part of the library.' });
      const file = DriveApp.getFileById(payload.fileId);
      const blob = file.getBlob();
      return jsonOutput({ ok: true, fileName: file.getName(), mimeType: blob.getContentType(), base64: Utilities.base64Encode(blob.getBytes()) });
    }
    if (payload.action === 'save' && payload.book && payload.book.id) {
      saveBook_(payload.book);
      return jsonOutput({ ok: true });
    }
    if (payload.action === 'delete' && payload.book && payload.book.id) {
      deleteBook_(payload.book.id);
      return jsonOutput({ ok: true });
    }
    throw new Error('Invalid storage request.');
  } catch (error) {
    return jsonOutput({ ok: false, error: String(error) });
  }
}

function userAuth_(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
  const sheet = getSpreadsheet_().getSheetByName('Users');
  const username = String(payload.username || '').trim();
  const phone = normalizePhone_(payload.phone);
  if (!/^[\w .-]{2,40}$/.test(username) || !/^\+?[0-9]{7,15}$/.test(phone)) throw new Error('Enter a username and valid phone number.');
  const rows = sheet.getDataRange().getValues();
  const usernameIndex = rows.slice(1).findIndex(row => String(row[0]).toLowerCase() === username.toLowerCase());
  const phoneIndex = rows.slice(1).findIndex(row => normalizePhone_(row[1]) === phone);
  if (payload.action === 'register') {
    if (usernameIndex >= 0 || phoneIndex >= 0) throw new Error('That username or phone number is already registered.');
    const nextRow = sheet.getLastRow() + 1;
    sheet.getRange(nextRow, 1, 1, 3).setNumberFormat('@');
    sheet.getRange(nextRow, 1, 1, 4).setValues([[username, phone, '', new Date()]]);
    return { ok: true, user: { username } };
  }
  if (usernameIndex < 0 || normalizePhone_(rows[usernameIndex + 1][1]) !== phone) throw new Error('Username or phone number is incorrect.');
  return { ok: true, user: { username: String(rows[usernameIndex + 1][0]) } };
  } finally {
    lock.releaseLock();
  }
}

function normalizePhone_(value) {
  // Sheets may have stored older phone values as numbers, dropping a leading +.
  return String(value == null ? '' : value).trim().replace(/[^+0-9]/g, '').replace(/^\+/, '');
}

function saveProgress_(payload) {
  const sheet = getSpreadsheet_().getSheetByName('Progress');
  const username = String(payload.username || '');
  const bookId = String(payload.bookId || '');
  const pageIndex = Math.max(0, Number(payload.pageIndex) || 0);
  if (!username || !bookId) throw new Error('Invalid reading progress.');
  const rows = sheet.getDataRange().getValues();
  const index = rows.slice(1).findIndex(row => row[0] === username && row[1] === bookId);
  if (index >= 0) sheet.getRange(index + 2, 3, 1, 2).setValues([[pageIndex, new Date()]]);
  else sheet.appendRow([username, bookId, pageIndex, new Date()]);
  return { ok: true };
}

function readProgress_(username) {
  return getSpreadsheet_().getSheetByName('Progress').getDataRange().getValues().slice(1)
    .filter(row => String(row[0]) === String(username)).map(row => ({ bookId: String(row[1]), pageIndex: Number(row[2]) || 0, updatedAt: row[3] }));
}

function saveBook_(book) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const spreadsheet = getSpreadsheet_();
    const booksSheet = spreadsheet.getSheetByName('Books');
    const pagesSheet = spreadsheet.getSheetByName('Pages');
    const media = DriveApp.getFolderById(PropertiesService.getScriptProperties().getProperty('DRIVE_FOLDER_ID'));

    const cover = persistDataUrl_(book.coverImage || '', book.title + '-cover', media, 'cover');
    const bookValues = [book.id, book.title || '', book.titleKhmer || '', book.author || '', cover, Boolean(book.isHidden), book.bookType || 'Other', Boolean(book.isComingSoon)];
    const existing = findRow_(booksSheet, book.id);
    if (existing) booksSheet.getRange(existing, 1, 1, bookValues.length).setValues([bookValues]);
    else booksSheet.appendRow(bookValues);

    const pages = (book.pages || []).map(function(page, index) {
      const audio = persistDataUrl_(page.audioUrl || '', page.audioFileName || (book.title + '-page-' + (index + 1)), media, 'audio');
      return [book.id, page.id || ('page-' + (index + 1)), index + 1, page.originalText || '', page.khmerText || '', audio, page.audioFileName || ''];
    });
    deleteBookPages_(pagesSheet, book.id);
    if (pages.length) pagesSheet.getRange(pagesSheet.getLastRow() + 1, 1, pages.length, pages[0].length).setValues(pages);
  } finally {
    lock.releaseLock();
  }
}

function readBooks_() {
  const spreadsheet = getSpreadsheet_();
  const bookRows = spreadsheet.getSheetByName('Books').getDataRange().getValues().slice(1);
  const pageRows = spreadsheet.getSheetByName('Pages').getDataRange().getValues().slice(1);
  return bookRows.filter(function(row) { return row[0]; }).map(function(row) {
    const id = String(row[0]);
    return {
      id: id,
      title: String(row[1] || ''),
      titleKhmer: String(row[2] || ''),
      author: String(row[3] || ''),
      coverImage: driveMediaUrl_(String(row[4] || ''), 'cover'),
      isHidden: row[5] === true || String(row[5]).toLowerCase() === 'true',
      bookType: String(row[6] || 'Other'),
      isComingSoon: row[7] === true || String(row[7]).toLowerCase() === 'true',
      pages: pageRows.filter(function(page) { return String(page[0]) === id; })
        .sort(function(a, b) { return Number(a[2]) - Number(b[2]); })
        .map(function(page) { return { id: String(page[1]), pageNumber: Number(page[2]), originalText: String(page[3] || ''), khmerText: String(page[4] || ''), audioUrl: driveMediaUrl_(String(page[5] || ''), 'audio'), audioFileName: String(page[6] || '') }; })
    };
  });
}

function deleteBook_(bookId) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const spreadsheet = getSpreadsheet_();
    const booksSheet = spreadsheet.getSheetByName('Books');
    const pagesSheet = spreadsheet.getSheetByName('Pages');
    deleteBookPages_(pagesSheet, bookId);
    const row = findRow_(booksSheet, bookId);
    if (row) booksSheet.deleteRow(row);
  } finally {
    lock.releaseLock();
  }
}

function persistDataUrl_(value, name, folder, kind) {
  if (!/^data:([^;]+);base64,/.test(value)) return driveMediaUrl_(value, kind);
  const match = value.match(/^data:([^;]+);base64,(.+)$/s);
  if (!match) throw new Error('Invalid media data.');
  const bytes = Utilities.base64Decode(match[2]);
  const blob = Utilities.newBlob(bytes, match[1], String(name).replace(/[\\/:*?"<>|]/g, '_'));
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return driveMediaUrl_(file.getId(), kind);
}

function driveMediaUrl_(value, kind) {
  const input = String(value || '');
  // The Render API streams Drive audio with byte-range support. Treat its
  // playback URL as a reference to the same Drive file when saving edits.
  const match = input.match(/[?&]id=([^&]+)/) || input.match(/\/d\/([^/?]+)/) || input.match(/\/api\/media\/([\w-]{20,})(?:[?#]|$)/);
  const fileId = match ? decodeURIComponent(match[1]) : (/^[\w-]{20,}$/.test(input) ? input : '');
  if (!fileId) return input;
  const id = encodeURIComponent(fileId);
  return kind === 'cover'
    ? 'https://drive.google.com/thumbnail?id=' + id + '&sz=w1200'
    : 'https://drive.google.com/uc?export=download&id=' + id;
}

function isStoredMediaFile_(fileId) {
  const spreadsheet = getSpreadsheet_();
  const coverValues = spreadsheet.getSheetByName('Books').getDataRange().getValues().slice(1).map(function(row) { return String(row[4] || ''); });
  const audioValues = spreadsheet.getSheetByName('Pages').getDataRange().getValues().slice(1).map(function(row) { return String(row[5] || ''); });
  const urls = coverValues.concat(audioValues);
  return urls.some(function(url) {
    const match = url.match(/[?&]id=([^&]+)/) || url.match(/\/d\/([^/?]+)/) || url.match(/\/api\/media\/([\w-]{20,})(?:[?#]|$)/);
    return match && decodeURIComponent(match[1]) === String(fileId);
  });
}

function deleteBookPages_(sheet, bookId) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (let i = ids.length - 1; i >= 0; i--) {
    if (String(ids[i][0]) === String(bookId)) sheet.deleteRow(i + 2);
  }
}

function findRow_(sheet, id) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return 0;
  const match = sheet.getRange(2, 1, lastRow - 1, 1).createTextFinder(String(id)).matchEntireCell(true).findNext();
  return match ? match.getRow() : 0;
}

function getSpreadsheet_() {
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!id) throw new Error('Run setup() in the Apps Script editor first.');
  return SpreadsheetApp.openById(id);
}

function jsonOutput(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}
