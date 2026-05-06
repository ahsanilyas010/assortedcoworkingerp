// ============================================
// ASSORTED COWORKING — WEB APP BACKEND
// Paste this into your Apps Script project
// Deploy as Web App: Execute as "Me", Access "Anyone"
// ============================================

const SPREADSHEET_ID = '1qb07syCH3XRuNB8AowG94e9csB8-ZaGcRFkBtACkNrU';
const DRIVE_FOLDER_ID = '1KYY-ec8V0-1EyOn34dgD0JItYPyT6JpO';
const BUSINESS_INFO = {
  name: 'Assorted Coworking',
  address: 'FF 27, Zarpar Arcade, D-12 Markaz, Islamabad, Pakistan',
  phone: '+92 342 2221633',
  email: 'info@assorted.business',
};

// ── CORS HELPER ──
function corsResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── doGet: serve dashboard or handle GET actions ──
function doGet(e) {
  // Allow GET-based action calls with ?action=ping
  if (e && e.parameter && e.parameter.action) {
    return handleAction(e.parameter);
  }
  return HtmlService.createHtmlOutput('<h2>Assorted Coworking API is running ✅</h2>');
}

// ── doPost: main entry point ──
function doPost(e) {
  try {
    let data;
    if (e.postData && e.postData.contents) {
      data = JSON.parse(e.postData.contents);
    } else if (e.parameter) {
      data = e.parameter;
    } else {
      throw new Error('No data received');
    }
    return corsResponse(handleAction(data));
  } catch (err) {
    Logger.log('doPost error: ' + err);
    return corsResponse({ success: false, error: err.toString() });
  }
}

// ── ACTION ROUTER ──
function handleAction(data) {
  const action = data.action;
  Logger.log('handleAction: ' + action + ' | ' + JSON.stringify(data));

  switch (action) {
    case 'addPayment':    return actionAddPayment(data);
    case 'addExpense':    return actionAddExpense(data);
    case 'addMember':     return actionAddMember(data);
    case 'genInvoice':    return actionGenInvoice(data);
    case 'loadData':      return actionLoadData();
    case 'ping':          return { success: true, message: 'pong', ts: new Date().toISOString() };
    default:              throw new Error('Unknown action: ' + action);
  }
}

// ── SHEETS ACCESS ──
function getSheets() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  return {
    members:  ss.getSheetByName('MEMBERS'),
    invoices: ss.getSheetByName('INVOICES'),
    payments: ss.getSheetByName('PAYMENTS'),
    expenses: ss.getSheetByName('EXPENSES'),
  };
}

// ============================================
// ACTION: ADD PAYMENT
// ============================================
function actionAddPayment(data) {
  const { invoiceId, amount, method, reference, notes } = data;
  if (!invoiceId || !amount) throw new Error('invoiceId and amount are required');

  const sheets = getSheets();
  const paymentsSheet = sheets.payments;
  const invoicesSheet = sheets.invoices;

  const paymentId = 'PAY' + String(Date.now()).slice(-6);
  const today = new Date();

  // Append to PAYMENTS sheet
  paymentsSheet.appendRow([
    paymentId,
    invoiceId,
    parseFloat(amount),
    method || 'Bank Transfer',
    Utilities.formatDate(today, Session.getScriptTimeZone(), 'yyyy-MM-dd'),
    reference || '',
    notes || '',
  ]);

  // Update invoice status to Paid
  const invData = invoicesSheet.getDataRange().getValues();
  for (let i = 1; i < invData.length; i++) {
    if (String(invData[i][0]).trim() === String(invoiceId).trim()) {
      invoicesSheet.getRange(i + 1, 8).setValue('Paid');
      break;
    }
  }

  Logger.log('Payment recorded: ' + paymentId);
  return { success: true, paymentId, message: 'Payment recorded successfully' };
}

// ============================================
// ACTION: ADD EXPENSE
// ============================================
function actionAddExpense(data) {
  const { title, category, amount, method, date, notes } = data;
  if (!title || !amount) throw new Error('title and amount are required');

  const sheets = getSheets();
  const expSheet = sheets.expenses;

  const expenseId = 'EXP' + String(Date.now()).slice(-6);
  const expDate = date || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');

  expSheet.appendRow([
    expenseId,
    title,
    category || 'General',
    parseFloat(amount),
    expDate,
    method || 'Bank Transfer',
    notes || '',
  ]);

  Logger.log('Expense recorded: ' + expenseId);
  return { success: true, expenseId, message: 'Expense added successfully' };
}

// ============================================
// ACTION: ADD MEMBER
// ============================================
function actionAddMember(data) {
  const { name, phone, email, company, plan, fee, startDate, status, notes } = data;
  if (!name) throw new Error('Full Name is required');

  const sheets = getSheets();
  const membersSheet = sheets.members;

  const lastRow = membersSheet.getLastRow();
  const memberId = 'M' + String(lastRow).padStart(3, '0');

  const start = startDate || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');

  membersSheet.appendRow([
    memberId,
    name,
    phone || '',
    email || '',
    company || '',
    plan || 'Hot Desk',
    parseFloat(fee) || 15000,
    start,
    1, // billing day
    status || 'Active',
    notes || '',
  ]);

  Logger.log('Member added: ' + memberId);
  return { success: true, memberId, message: 'Member added successfully' };
}

// ============================================
// ACTION: GENERATE INVOICE
// ============================================
function actionGenInvoice(data) {
  const { memberId, month } = data;
  if (!memberId) throw new Error('memberId is required');

  const sheets = getSheets();

  // Get member
  const membersData = sheets.members.getDataRange().getValues();
  let member = null;
  for (let i = 1; i < membersData.length; i++) {
    if (String(membersData[i][0]).trim() === String(memberId).trim()) {
      member = {
        id: membersData[i][0],
        name: membersData[i][1],
        phone: membersData[i][2],
        email: membersData[i][3],
        company: membersData[i][4],
        plan: membersData[i][5],
        fee: parseFloat(membersData[i][6]) || 0,
      };
      break;
    }
  }
  if (!member) throw new Error('Member not found: ' + memberId);

  const today = new Date();
  const currentMonth = month || Utilities.formatDate(today, Session.getScriptTimeZone(), 'MMMM yyyy');
  const dueDate = new Date(today); dueDate.setDate(dueDate.getDate() + 5);

  // Generate invoice number
  const invoicesData = sheets.invoices.getDataRange().getValues();
  const num = Math.max(1000, invoicesData.length + 999);
  const invoiceNumber = 'INV-' + num;
  const invoiceId = 'INV' + String(Date.now()).slice(-6);

  // Create PDF via invoice-generator.com
  let pdfUrl = '';
  let driveFileId = '';
  try {
    const pdfBlob = createInvoicePDF(member, invoiceNumber, currentMonth, dueDate);
    driveFileId = savePDFToDrive(pdfBlob, invoiceNumber);
    pdfUrl = 'https://drive.google.com/file/d/' + driveFileId + '/view';
  } catch (pdfErr) {
    Logger.log('PDF error (non-fatal): ' + pdfErr);
    pdfUrl = '';
  }

  // Append to INVOICES sheet
  sheets.invoices.appendRow([
    invoiceId,
    memberId,
    invoiceNumber,
    currentMonth,
    Utilities.formatDate(today, Session.getScriptTimeZone(), 'yyyy-MM-dd'),
    Utilities.formatDate(dueDate, Session.getScriptTimeZone(), 'yyyy-MM-dd'),
    member.fee,
    'Sent',
    pdfUrl,
    driveFileId,
  ]);

  Logger.log('Invoice generated: ' + invoiceNumber);
  return {
    success: true,
    invoiceNumber,
    invoiceId,
    pdfUrl,
    message: 'Invoice generated' + (pdfUrl ? ' and saved to Drive' : ' (PDF skipped — check logs)'),
  };
}

// ── PDF CREATION ──
function createInvoicePDF(member, invoiceNumber, month, dueDate) {
  const today = new Date();
  const payload = {
    from: BUSINESS_INFO.name + '\n' + BUSINESS_INFO.address + '\n' + BUSINESS_INFO.phone + '\n' + BUSINESS_INFO.email,
    to: member.name + '\n' + (member.company ? member.company + '\n' : '') + (member.email || '') + '\n' + (member.phone || ''),
    number: invoiceNumber,
    date: Utilities.formatDate(today, Session.getScriptTimeZone(), 'dd/MM/yyyy'),
    due_date: Utilities.formatDate(dueDate, Session.getScriptTimeZone(), 'dd/MM/yyyy'),
    items: [{ name: member.plan + ' — ' + month, quantity: 1, unit_cost: member.fee }],
    currency: 'PKR',
    tax: 0,
    notes: 'Thank you for being part of Assorted Coworking!\n\nPayment due within 5 days.',
    terms: 'Payment is due within 5 days of invoice date.',
  };

  const res = UrlFetchApp.fetch('https://invoice-generator.com', {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });

  if (res.getResponseCode() !== 200) {
    throw new Error('invoice-generator.com error: ' + res.getContentText());
  }
  return res.getBlob();
}

function savePDFToDrive(blob, invoiceNumber) {
  const folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
  blob.setName(invoiceNumber + '.pdf');
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return file.getId();
}

// ============================================
// ACTION: LOAD DATA (for dashboard stats)
// ============================================
function actionLoadData() {
  try {
    const sheets = getSheets();

    const membersData  = sheets.members.getDataRange().getValues();
    const invoicesData = sheets.invoices.getDataRange().getValues();
    const paymentsData = sheets.payments.getDataRange().getValues();
    const expensesData = sheets.expenses.getDataRange().getValues();

    const toObj = (rows, headers) => rows.slice(1).map(r => {
      const o = {};
      headers.forEach((h, i) => o[h] = r[i] !== undefined ? String(r[i]) : '');
      return o;
    }).filter(r => Object.values(r).some(v => v !== ''));

    const mh = ['Member ID','Full Name','Phone','Email','Company','Plan','Monthly Fee','Start Date','Billing Day','Status','Notes'];
    const ih = ['Invoice ID','Member ID','Invoice Number','Month','Issue Date','Due Date','Amount','Status','PDF Link','Drive ID'];
    const ph = ['Payment ID','Invoice ID','Amount','Method','Date','Reference','Notes'];
    const eh = ['Expense ID','Title','Category','Amount','Date','Method','Notes'];

    return {
      success: true,
      members:  toObj(membersData, mh),
      invoices: toObj(invoicesData, ih),
      payments: toObj(paymentsData, ph),
      expenses: toObj(expensesData, eh),
    };
  } catch (err) {
    return { success: false, error: err.toString(), members: [], invoices: [], payments: [], expenses: [] };
  }
}
