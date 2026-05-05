// ============================================
// ASSORTED COWORKING MANAGEMENT SYSTEM
// Main Apps Script Code
// Version: 1.0
// Last Updated: May 2026
// ============================================

// ============================================
// CONFIGURATION
// ============================================
const CONFIG = {
  INVOICE_GENERATOR_API: 'https://invoice-generator.com',
  DRIVE_FOLDER_ID: 'YOUR_GOOGLE_DRIVE_FOLDER_ID', // REQUIRED: Update this
  INVOICE_PREFIX: 'INV-',
  INVOICE_START_NUMBER: 1000,
  BUSINESS_INFO: {
    name: 'Assorted Coworking',
    address: 'FF 27, Zarpar Arcade, D-12 Markaz, Islamabad, Pakistan',
    phone: '+92 342 2221633',
    email: 'info@assorted.business',
    website: 'www.assorted.business',
  },
  WATI: {
    API_URL: 'https://live-server-YOUR_INSTANCE.wati.io/api/v1/sendTemplateMessage',
    API_KEY: 'YOUR_WATI_API_KEY', // REQUIRED: Update after Wati.io signup
  },
  BANK_DETAILS: {
    bank: 'YOUR_BANK_NAME',
    accountTitle: 'Assorted Coworking',
    accountNumber: 'YOUR_ACCOUNT_NUMBER',
    iban: 'YOUR_IBAN',
  },
  TOTAL_CAPACITY: 50, // Update based on your space capacity
};

// ============================================
// SHEET REFERENCES
const SPREADSHEET_ID = '1qb07syCH3XRuNB8AowG94e9csB8-ZaGcRFkBtACkNrU'; // Put your Sheet ID here if web app doesn't load

function getSheets() {
  let ss = null;
  try {
    ss = SpreadsheetApp.getActiveSpreadsheet();
  } catch (e) {
    // Ignore error
  }
  
  if (!ss && SPREADSHEET_ID) {
    ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  }
  
  if (!ss) {
    throw new Error("Could not find spreadsheet. Please set SPREADSHEET_ID in Code.gs (around line 40).");
  }
  
  return {
    members: ss.getSheetByName('MEMBERS'),
    invoices: ss.getSheetByName('INVOICES'),
    payments: ss.getSheetByName('PAYMENTS'),
    expenses: ss.getSheetByName('EXPENSES'),
    dashboard: ss.getSheetByName('DASHBOARD_DATA'),
  };
}

// ============================================
// 1. WEBHOOK HANDLER (Form Integration)
// ============================================
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    
    // Create member from form submission
    const memberId = createMember({
      fullName: data.full_name,
      phone: data.phone,
      email: data.email,
      companyName: data.company_name || '',
      plan: data.plan,
      billingDay: data.billing_day || 1,
    });
    
    // Generate first invoice
    generateInvoiceForMember(memberId);
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      memberId: memberId,
      message: 'Member created and invoice generated successfully',
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    Logger.log('Error in doPost: ' + error);
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString(),
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// ============================================
// 2. CREATE MEMBER
// ============================================
function createMember(data) {
  const sheets = getSheets();
  const membersSheet = sheets.members;
  
  // Generate Member ID
  const lastRow = membersSheet.getLastRow();
  const memberId = 'M' + String(lastRow).padStart(3, '0');
  
  // Get plan pricing
  const planPricing = {
    'Hot Desk': 15000,
    'Dedicated Desk': 25000,
    'Private Office': 50000,
  };
  
  const monthlyFee = planPricing[data.plan] || 15000;
  
  // Check for duplicate phone/email
  const existingData = membersSheet.getDataRange().getValues();
  for (let i = 1; i < existingData.length; i++) {
    if (existingData[i][2] === data.phone || existingData[i][3] === data.email) {
      throw new Error('Member with this phone or email already exists');
    }
  }
  
  // Add member to sheet
  membersSheet.appendRow([
    memberId,
    data.fullName,
    data.phone,
    data.email,
    data.companyName || '',
    data.plan,
    monthlyFee,
    new Date(),
    data.billingDay,
    'Active',
    '',
  ]);
  
  Logger.log('Member created: ' + memberId);
  return memberId;
}

// ============================================
// 3. MONTHLY INVOICE GENERATOR (TIME-DRIVEN)
// ============================================
function generateMonthlyInvoices() {
  const sheets = getSheets();
  const membersSheet = sheets.members;
  
  const today = new Date();
  const currentDay = today.getDate();
  const currentMonth = Utilities.formatDate(today, Session.getScriptTimeZone(), 'MMMM yyyy');
  
  Logger.log('[CRON] Starting monthly invoice generation for day: ' + currentDay);
  
  // Get all members
  const membersData = membersSheet.getDataRange().getValues();
  let invoicesGenerated = 0;
  
  // Skip header row
  for (let i = 1; i < membersData.length; i++) {
    const row = membersData[i];
    const memberId = row[0];
    const status = row[9];
    const billingDay = row[8];
    
    // Only process active members whose billing day matches today
    if (status === 'Active' && billingDay == currentDay) {
      
      // Check if invoice already exists for this month (idempotency)
      if (!invoiceExistsForMonth(memberId, currentMonth)) {
        try {
          generateInvoiceForMember(memberId);
          invoicesGenerated++;
          Logger.log('[CRON] Invoice generated for member: ' + memberId);
        } catch (error) {
          Logger.log('[CRON] Error generating invoice for ' + memberId + ': ' + error);
        }
      } else {
        Logger.log('[CRON] Invoice already exists for member: ' + memberId + ' for ' + currentMonth);
      }
    }
  }
  
  Logger.log('[CRON] Invoice generation complete. Total generated: ' + invoicesGenerated);
  
  // Update dashboard
  updateDashboard();
}

// ============================================
// 4. GENERATE INVOICE FOR MEMBER
// ============================================
function generateInvoiceForMember(memberId) {
  const sheets = getSheets();
  const membersSheet = sheets.members;
  const invoicesSheet = sheets.invoices;
  
  // Get member details
  const memberData = getMemberById(memberId);
  if (!memberData) {
    throw new Error('Member not found: ' + memberId);
  }
  
  const today = new Date();
  const dueDate = new Date(today);
  dueDate.setDate(dueDate.getDate() + 5);
  
  const currentMonth = Utilities.formatDate(today, Session.getScriptTimeZone(), 'MMMM yyyy');
  
  // Generate invoice number
  const invoiceNumber = generateInvoiceNumber();
  
  // Create invoice via invoicegenerator.com
  const invoicePdfUrl = createInvoicePDF({
    invoiceNumber: invoiceNumber,
    customerName: memberData.fullName,
    customerEmail: memberData.email,
    customerPhone: memberData.phone,
    companyName: memberData.companyName,
    amount: memberData.monthlyFee,
    issueDate: today,
    dueDate: dueDate,
    items: [
      {
        name: memberData.plan + ' - ' + currentMonth,
        quantity: 1,
        price: memberData.monthlyFee,
      }
    ],
  });
  
  // Save PDF to Google Drive
  const driveFileId = savePdfToDrive(invoicePdfUrl, invoiceNumber);
  const driveFileUrl = 'https://drive.google.com/file/d/' + driveFileId + '/view';
  
  // Add invoice to sheet
  const invoiceId = 'INV' + String(invoicesSheet.getLastRow()).padStart(3, '0');
  invoicesSheet.appendRow([
    invoiceId,
    memberId,
    invoiceNumber,
    currentMonth,
    today,
    dueDate,
    memberData.monthlyFee,
    'Sent',
    driveFileUrl,
    driveFileId,
  ]);
  
  Logger.log('Invoice created: ' + invoiceNumber);
  
  // Send notifications
  sendInvoiceNotifications(memberData, invoiceNumber, driveFileUrl, dueDate);
  
  return invoiceNumber;
}

// ============================================
// 5. CREATE PDF VIA INVOICEGENERATOR.COM
// ============================================
function createInvoicePDF(data) {
  const payload = {
    from: CONFIG.BUSINESS_INFO.name + "\n" + 
          CONFIG.BUSINESS_INFO.address + "\n" + 
          CONFIG.BUSINESS_INFO.phone + "\n" + 
          CONFIG.BUSINESS_INFO.email,
    to: data.customerName + "\n" + 
        (data.companyName ? data.companyName + "\n" : "") +
        data.customerEmail + "\n" + 
        data.customerPhone,
    logo: "https://your-logo-url.com/logo.png", // UPDATE THIS
    number: data.invoiceNumber,
    date: Utilities.formatDate(data.issueDate, Session.getScriptTimeZone(), 'dd/MM/yyyy'),
    due_date: Utilities.formatDate(data.dueDate, Session.getScriptTimeZone(), 'dd/MM/yyyy'),
    items: data.items.map(item => ({
      name: item.name,
      quantity: item.quantity,
      unit_cost: item.price
    })),
    currency: "PKR",
    tax: 0,
    notes: "Thank you for being part of Assorted Coworking!\n\nPayment Details:\n" +
           "Bank: " + CONFIG.BANK_DETAILS.bank + "\n" +
           "Account: " + CONFIG.BANK_DETAILS.accountTitle + "\n" +
           "Account Number: " + CONFIG.BANK_DETAILS.accountNumber + "\n" +
           "IBAN: " + CONFIG.BANK_DETAILS.iban,
    terms: "Payment is due within 5 days of invoice date.",
  };
  
  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  };
  
  try {
    const response = UrlFetchApp.fetch(CONFIG.INVOICE_GENERATOR_API, options);
    
    if (response.getResponseCode() === 200) {
      return response.getBlob();
    } else {
      throw new Error('Invoice generation failed: ' + response.getContentText());
    }
  } catch (error) {
    Logger.log('Error creating invoice PDF: ' + error);
    throw error;
  }
}

// ============================================
// 6. SAVE PDF TO GOOGLE DRIVE
// ============================================
function savePdfToDrive(pdfBlob, invoiceNumber) {
  try {
    const folder = DriveApp.getFolderById(CONFIG.DRIVE_FOLDER_ID);
    
    if (typeof pdfBlob === 'string') {
      // If pdfBlob is a URL, fetch it
      pdfBlob = UrlFetchApp.fetch(pdfBlob).getBlob();
    }
    
    pdfBlob.setName(invoiceNumber + '.pdf');
    const file = folder.createFile(pdfBlob);
    
    // Make file accessible to anyone with link
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    Logger.log('PDF saved to Drive: ' + file.getId());
    return file.getId();
    
  } catch (error) {
    Logger.log('Error saving PDF to Drive: ' + error);
    throw error;
  }
}

// ============================================
// 7. SEND INVOICE NOTIFICATIONS
// ============================================
function sendInvoiceNotifications(memberData, invoiceNumber, pdfUrl, dueDate) {
  const dueDateFormatted = Utilities.formatDate(dueDate, Session.getScriptTimeZone(), 'dd MMM yyyy');
  
  try {
    // Send WhatsApp
    sendWhatsAppInvoice(
      memberData.phone,
      memberData.fullName,
      invoiceNumber,
      memberData.monthlyFee,
      dueDateFormatted,
      pdfUrl
    );
  } catch (error) {
    Logger.log('WhatsApp notification failed: ' + error);
  }
  
  try {
    // Send Email
    sendInvoiceEmail(
      memberData.email,
      memberData.fullName,
      invoiceNumber,
      memberData.monthlyFee,
      dueDateFormatted,
      pdfUrl
    );
  } catch (error) {
    Logger.log('Email notification failed: ' + error);
  }
}

// ============================================
// 8. WHATSAPP INTEGRATION (WATI.IO)
// ============================================
function sendWhatsAppInvoice(phone, memberName, invoiceNumber, amount, dueDate, pdfUrl) {
  
  // Clean phone number (remove spaces, dashes, etc.)
  phone = phone.replace(/\D/g, '');
  if (!phone.startsWith('92')) {
    phone = '92' + phone.replace(/^0+/, '');
  }
  
  const payload = {
    template_name: 'invoice_notification',
    broadcast_name: 'Monthly Invoice',
    receivers: [{
      whatsappNumber: phone,
      customParams: [
        { name: 'name', value: memberName },
        { name: 'invoice_number', value: invoiceNumber },
        { name: 'amount', value: 'PKR ' + amount.toLocaleString() },
        { name: 'due_date', value: dueDate },
        { name: 'invoice_link', value: pdfUrl },
      ]
    }]
  };
  
  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'Authorization': 'Bearer ' + CONFIG.WATI.API_KEY,
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  };
  
  try {
    const response = UrlFetchApp.fetch(CONFIG.WATI.API_URL, options);
    Logger.log('WhatsApp sent to ' + phone + ': ' + response.getContentText());
    return true;
  } catch (error) {
    Logger.log('WhatsApp error for ' + phone + ': ' + error);
    return false;
  }
}

// ============================================
// 9. EMAIL INTEGRATION
// ============================================
function sendInvoiceEmail(memberEmail, memberName, invoiceNumber, amount, dueDate, pdfUrl) {
  const currentMonth = getCurrentMonth();
  const subject = `Your Invoice for ${currentMonth} - Assorted Coworking`;
  
  const htmlBody = `
    <div style="font-family: Poppins, Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #1C4585; color: white; padding: 20px; border-radius: 10px 10px 0 0;">
        <h1 style="margin: 0; font-size: 24px;">Assorted Coworking</h1>
      </div>
      
      <div style="padding: 30px; background: white;">
        <p style="font-size: 16px;">Hi ${memberName},</p>
        
        <p>Your invoice for ${currentMonth} is ready.</p>
        
        <div style="background: #F6F6F6; padding: 20px; border-radius: 10px; margin: 20px 0;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0;"><strong>Invoice Number:</strong></td>
              <td style="padding: 8px 0;">${invoiceNumber}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0;"><strong>Amount:</strong></td>
              <td style="padding: 8px 0; font-size: 20px; color: #F36F29; font-weight: bold;">PKR ${amount.toLocaleString()}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0;"><strong>Due Date:</strong></td>
              <td style="padding: 8px 0;">${dueDate}</td>
            </tr>
          </table>
        </div>
        
        <p><strong>Payment Methods:</strong></p>
        <div style="background: #F6F6F6; padding: 15px; border-radius: 5px; margin: 15px 0;">
          <p style="margin: 5px 0;"><strong>Bank Transfer:</strong></p>
          <p style="margin: 5px 0;">Bank: ${CONFIG.BANK_DETAILS.bank}</p>
          <p style="margin: 5px 0;">Account: ${CONFIG.BANK_DETAILS.accountTitle}</p>
          <p style="margin: 5px 0;">Account Number: ${CONFIG.BANK_DETAILS.accountNumber}</p>
          <p style="margin: 5px 0;">IBAN: ${CONFIG.BANK_DETAILS.iban}</p>
          <br>
          <p style="margin: 5px 0;"><strong>Cash:</strong> Visit us at ${CONFIG.BUSINESS_INFO.address}</p>
        </div>
        
        <p style="text-align: center; margin: 30px 0;">
          <a href="${pdfUrl}" 
             style="display: inline-block; background: #F36F29; color: white; 
                    padding: 12px 24px; text-decoration: none; border-radius: 5px; 
                    font-weight: bold;">
            Download Invoice PDF
          </a>
        </p>
        
        <p>Questions? Reply to this email or call <strong>${CONFIG.BUSINESS_INFO.phone}</strong>.</p>
        
        <p>Thank you for being part of Assorted Coworking!</p>
        
        <p style="margin-top: 30px;">
          Best regards,<br>
          <strong>Ahsan Ilyas</strong><br>
          Assorted Coworking
        </p>
      </div>
      
      <div style="background: #F6F6F6; padding: 15px; text-align: center; 
                  border-radius: 0 0 10px 10px; font-size: 12px; color: #666;">
        ${CONFIG.BUSINESS_INFO.address}<br>
        ${CONFIG.BUSINESS_INFO.phone} | ${CONFIG.BUSINESS_INFO.email}
      </div>
    </div>
  `;
  
  const plainBody = `
Hi ${memberName},

Your invoice for ${currentMonth} is attached.

Invoice Number: ${invoiceNumber}
Amount: PKR ${amount.toLocaleString()}
Due Date: ${dueDate}

Download: ${pdfUrl}

Payment Methods:
• Bank Transfer:
  Bank: ${CONFIG.BANK_DETAILS.bank}
  Account: ${CONFIG.BANK_DETAILS.accountTitle}
  Account Number: ${CONFIG.BANK_DETAILS.accountNumber}
  IBAN: ${CONFIG.BANK_DETAILS.iban}

• Cash: ${CONFIG.BUSINESS_INFO.address}

Questions? ${CONFIG.BUSINESS_INFO.phone}

Best regards,
Ahsan Ilyas
Assorted Coworking
  `;
  
  try {
    // Fetch PDF from Google Drive
    const file = DriveApp.getFileById(pdfUrl.match(/\/d\/([^\/]+)/)[1]);
    const pdfBlob = file.getBlob();
    
    MailApp.sendEmail({
      to: memberEmail,
      subject: subject,
      body: plainBody,
      htmlBody: htmlBody,
      attachments: [pdfBlob],
      name: 'Assorted Coworking',
    });
    
    Logger.log('Email sent to: ' + memberEmail);
    return true;
  } catch (error) {
    Logger.log('Email error: ' + error);
    return false;
  }
}

// ============================================
// 10. RECORD PAYMENT
// ============================================
function recordPayment(invoiceId, amountPaid, paymentMethod, referenceNumber, notes) {
  const sheets = getSheets();
  const paymentsSheet = sheets.payments;
  const invoicesSheet = sheets.invoices;
  
  // Validate payment method
  const validMethods = ['cash', 'bank_transfer', 'online', 'cheque'];
  if (!validMethods.includes(paymentMethod.toLowerCase())) {
    throw new Error('Invalid payment method');
  }
  
  // Add payment record
  const paymentId = 'PAY' + String(paymentsSheet.getLastRow()).padStart(3, '0');
  paymentsSheet.appendRow([
    paymentId,
    invoiceId,
    amountPaid,
    paymentMethod,
    new Date(),
    referenceNumber || '',
    notes || '',
  ]);
  
  // Update invoice status
  const invoiceData = invoicesSheet.getDataRange().getValues();
  for (let i = 1; i < invoiceData.length; i++) {
    if (invoiceData[i][0] === invoiceId) {
      const invoiceAmount = parseFloat(invoiceData[i][6]);
      
      // Calculate total paid for this invoice
      const totalPaid = getTotalPaidForInvoice(invoiceId);
      
      // Update status
      if (totalPaid >= invoiceAmount) {
        invoicesSheet.getRange(i + 1, 8).setValue('Paid');
        
        // Send payment confirmation
        const memberId = invoiceData[i][1];
        const memberData = getMemberById(memberId);
        sendPaymentConfirmation(memberData, invoiceData[i][2], amountPaid, paymentMethod);
      }
      break;
    }
  }
  
  Logger.log('Payment recorded: ' + paymentId);
  updateDashboard();
  
  return paymentId;
}

// ============================================
// 11. SEND PAYMENT CONFIRMATION
// ============================================
function sendPaymentConfirmation(memberData, invoiceNumber, amount, paymentMethod) {
  const subject = 'Payment Received - Thank You! ✅';
  
  const htmlBody = `
    <div style="font-family: Poppins, Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #76B048; color: white; padding: 20px; border-radius: 10px 10px 0 0;">
        <h1 style="margin: 0; font-size: 24px;">Payment Confirmed! ✅</h1>
      </div>
      
      <div style="padding: 30px; background: white;">
        <p style="font-size: 16px;">Hi ${memberData.fullName},</p>
        
        <p>We've received your payment. Thank you!</p>
        
        <div style="background: #F6F6F6; padding: 20px; border-radius: 10px; margin: 20px 0;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0;"><strong>Invoice:</strong></td>
              <td style="padding: 8px 0;">${invoiceNumber}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0;"><strong>Amount Paid:</strong></td>
              <td style="padding: 8px 0; font-size: 20px; color: #76B048; font-weight: bold;">PKR ${amount.toLocaleString()}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0;"><strong>Payment Method:</strong></td>
              <td style="padding: 8px 0;">${paymentMethod}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0;"><strong>Date:</strong></td>
              <td style="padding: 8px 0;">${Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd MMM yyyy')}</td>
            </tr>
          </table>
        </div>
        
        <p>Your account is now up to date.</p>
        
        <p style="margin-top: 30px;">
          Best regards,<br>
          <strong>Assorted Coworking Team</strong>
        </p>
      </div>
      
      <div style="background: #F6F6F6; padding: 15px; text-align: center; 
                  border-radius: 0 0 10px 10px; font-size: 12px; color: #666;">
        ${CONFIG.BUSINESS_INFO.address}<br>
        ${CONFIG.BUSINESS_INFO.phone} | ${CONFIG.BUSINESS_INFO.email}
      </div>
    </div>
  `;
  
  try {
    MailApp.sendEmail({
      to: memberData.email,
      subject: subject,
      htmlBody: htmlBody,
      name: 'Assorted Coworking',
    });
    Logger.log('Payment confirmation sent to: ' + memberData.email);
  } catch (error) {
    Logger.log('Payment confirmation email error: ' + error);
  }
}

// ============================================
// 12. MARK OVERDUE INVOICES
// ============================================
function markOverdueInvoices() {
  const sheets = getSheets();
  const invoicesSheet = sheets.invoices;
  
  const today = new Date();
  const invoicesData = invoicesSheet.getDataRange().getValues();
  let markedOverdue = 0;
  
  for (let i = 1; i < invoicesData.length; i++) {
    const row = invoicesData[i];
    const status = row[7];
    const dueDate = new Date(row[5]);
    
    if ((status === 'Sent' || status === 'Draft') && dueDate < today) {
      invoicesSheet.getRange(i + 1, 8).setValue('Overdue');
      markedOverdue++;
      
      // Send overdue reminder
      const memberId = row[1];
      const memberData = getMemberById(memberId);
      sendOverdueReminder(memberData, row[2], row[6], dueDate);
    }
  }
  
  Logger.log('[CRON] Overdue invoices marked: ' + markedOverdue);
}

// ============================================
// 13. SEND OVERDUE REMINDER
// ============================================
function sendOverdueReminder(memberData, invoiceNumber, amount, dueDate) {
  const subject = '⚠️ Payment Overdue - ' + invoiceNumber;
  
  const htmlBody = `
    <div style="font-family: Poppins, Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #dc3545; color: white; padding: 20px; border-radius: 10px 10px 0 0;">
        <h1 style="margin: 0; font-size: 24px;">⚠️ Payment Overdue</h1>
      </div>
      
      <div style="padding: 30px; background: white;">
        <p style="font-size: 16px;">Hi ${memberData.fullName},</p>
        
        <p>Your invoice is now overdue. Please clear this payment at your earliest convenience.</p>
        
        <div style="background: #fff3cd; padding: 20px; border-radius: 10px; margin: 20px 0; border-left: 4px solid #ffc107;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0;"><strong>Invoice:</strong></td>
              <td style="padding: 8px 0;">${invoiceNumber}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0;"><strong>Amount:</strong></td>
              <td style="padding: 8px 0; font-size: 20px; color: #dc3545; font-weight: bold;">PKR ${amount.toLocaleString()}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0;"><strong>Due Date:</strong></td>
              <td style="padding: 8px 0;">${Utilities.formatDate(dueDate, Session.getScriptTimeZone(), 'dd MMM yyyy')} (passed)</td>
            </tr>
          </table>
        </div>
        
        <p><strong>Payment Methods:</strong></p>
        <div style="background: #F6F6F6; padding: 15px; border-radius: 5px; margin: 15px 0;">
          <p style="margin: 5px 0;"><strong>Bank Transfer:</strong></p>
          <p style="margin: 5px 0;">Account: ${CONFIG.BANK_DETAILS.accountNumber}</p>
          <p style="margin: 5px 0;">IBAN: ${CONFIG.BANK_DETAILS.iban}</p>
        </div>
        
        <p>If you've already paid, please reply with your payment reference.</p>
        
        <p>Questions? Contact us at ${CONFIG.BUSINESS_INFO.phone}</p>
        
        <p style="margin-top: 30px;">
          Best regards,<br>
          <strong>Assorted Coworking Team</strong>
        </p>
      </div>
    </div>
  `;
  
  try {
    MailApp.sendEmail({
      to: memberData.email,
      subject: subject,
      htmlBody: htmlBody,
      name: 'Assorted Coworking',
    });
    Logger.log('Overdue reminder sent to: ' + memberData.email);
  } catch (error) {
    Logger.log('Overdue reminder error: ' + error);
  }
}

// ============================================
// 14. UPDATE DASHBOARD
// ============================================
function updateDashboard() {
  const sheets = getSheets();
  const dashboardSheet = sheets.dashboard;
  
  // Calculate metrics
  const activeMembers = countActiveMembers();
  const revenue = calculateMonthlyRevenue();
  const outstanding = calculateOutstandingPayments();
  const expenses = calculateMonthlyExpenses();
  const netProfit = revenue - expenses;
  const occupancy = calculateOccupancyRate();
  
  // Clear and update dashboard
  dashboardSheet.clear();
  dashboardSheet.appendRow(['Metric', 'Value']);
  dashboardSheet.appendRow(['Total Active Members', activeMembers]);
  dashboardSheet.appendRow(['Monthly Revenue', revenue]);
  dashboardSheet.appendRow(['Outstanding Payments', outstanding]);
  dashboardSheet.appendRow(['Total Expenses (Month)', expenses]);
  dashboardSheet.appendRow(['Net Profit', netProfit]);
  dashboardSheet.appendRow(['Occupancy Rate', occupancy]);
  
  // Format dashboard
  const headerRange = dashboardSheet.getRange('A1:B1');
  headerRange.setBackground('#1C4585');
  headerRange.setFontColor('#FFFFFF');
  headerRange.setFontWeight('bold');
  
  Logger.log('Dashboard updated successfully');
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function getMemberById(memberId) {
  const sheets = getSheets();
  const membersData = sheets.members.getDataRange().getValues();
  
  for (let i = 1; i < membersData.length; i++) {
    if (membersData[i][0] === memberId) {
      return {
        memberId: membersData[i][0],
        fullName: membersData[i][1],
        phone: membersData[i][2],
        email: membersData[i][3],
        companyName: membersData[i][4],
        plan: membersData[i][5],
        monthlyFee: membersData[i][6],
        startDate: membersData[i][7],
        billingDay: membersData[i][8],
        status: membersData[i][9],
      };
    }
  }
  return null;
}

function invoiceExistsForMonth(memberId, month) {
  const sheets = getSheets();
  const invoicesData = sheets.invoices.getDataRange().getValues();
  
  for (let i = 1; i < invoicesData.length; i++) {
    if (invoicesData[i][1] === memberId && invoicesData[i][3] === month) {
      return true;
    }
  }
  return false;
}

function generateInvoiceNumber() {
  const sheets = getSheets();
  const invoicesSheet = sheets.invoices;
  const lastRow = invoicesSheet.getLastRow();
  
  const invoiceNum = CONFIG.INVOICE_START_NUMBER + lastRow;
  return CONFIG.INVOICE_PREFIX + invoiceNum;
}

function getTotalPaidForInvoice(invoiceId) {
  const sheets = getSheets();
  const paymentsData = sheets.payments.getDataRange().getValues();
  
  let total = 0;
  for (let i = 1; i < paymentsData.length; i++) {
    if (paymentsData[i][1] === invoiceId) {
      total += parseFloat(paymentsData[i][2]);
    }
  }
  return total;
}

function countActiveMembers() {
  const sheets = getSheets();
  const membersData = sheets.members.getDataRange().getValues();
  
  let count = 0;
  for (let i = 1; i < membersData.length; i++) {
    if (membersData[i][9] === 'Active') count++;
  }
  return count;
}

function calculateMonthlyRevenue() {
  const sheets = getSheets();
  const invoicesData = sheets.invoices.getDataRange().getValues();
  
  const today = new Date();
  const currentMonth = Utilities.formatDate(today, Session.getScriptTimeZone(), 'MMMM yyyy');
  
  let revenue = 0;
  for (let i = 1; i < invoicesData.length; i++) {
    if (invoicesData[i][3] === currentMonth && invoicesData[i][7] === 'Paid') {
      revenue += parseFloat(invoicesData[i][6]);
    }
  }
  return revenue;
}

function calculateOutstandingPayments() {
  const sheets = getSheets();
  const invoicesData = sheets.invoices.getDataRange().getValues();
  
  let outstanding = 0;
  for (let i = 1; i < invoicesData.length; i++) {
    const status = invoicesData[i][7];
    if (status === 'Sent' || status === 'Overdue') {
      const invoiceAmount = parseFloat(invoicesData[i][6]);
      const invoiceId = invoicesData[i][0];
      const totalPaid = getTotalPaidForInvoice(invoiceId);
      outstanding += (invoiceAmount - totalPaid);
    }
  }
  return outstanding;
}

function calculateMonthlyExpenses() {
  const sheets = getSheets();
  const expensesData = sheets.expenses.getDataRange().getValues();
  
  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();
  
  let total = 0;
  for (let i = 1; i < expensesData.length; i++) {
    const expenseDate = new Date(expensesData[i][4]); // col 4 = date
    if (expenseDate.getMonth() === currentMonth && expenseDate.getFullYear() === currentYear) {
      total += parseFloat(expensesData[i][3]); // col 3 = amount
    }
  }
  return total;
}

function calculateOccupancyRate() {
  const activeMembers = countActiveMembers();
  const totalCapacity = CONFIG.TOTAL_CAPACITY;
  return ((activeMembers / totalCapacity) * 100).toFixed(2) + '%';
}

function getCurrentMonth() {
  const today = new Date();
  return Utilities.formatDate(today, Session.getScriptTimeZone(), 'MMMM yyyy');
}

// (Duplicate dashboard data function removed to avoid conflicts)

// ============================================
// SETUP TRIGGERS (RUN ONCE)
// ============================================
function setupTriggers() {
  // Delete existing triggers
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => ScriptApp.deleteTrigger(trigger));
  
  // Monthly invoice generation (runs daily at 9 AM)
  ScriptApp.newTrigger('generateMonthlyInvoices')
    .timeBased()
    .atHour(9)
    .everyDays(1)
    .create();
  
  // Mark overdue invoices (runs daily at 10 AM)
  ScriptApp.newTrigger('markOverdueInvoices')
    .timeBased()
    .atHour(10)
    .everyDays(1)
    .create();
  
  // Update dashboard (runs every 6 hours)
  ScriptApp.newTrigger('updateDashboard')
    .timeBased()
    .everyHours(6)
    .create();
  
  Logger.log('✅ Triggers set up successfully');
  Logger.log('- Monthly invoice generation: Daily at 9 AM');
  Logger.log('- Overdue checker: Daily at 10 AM');
  Logger.log('- Dashboard update: Every 6 hours');
}

// ============================================
// INITIAL SETUP (RUN ONCE)
// ============================================
function initialSetup() {
  Logger.log('Starting initial setup...');
  
  // Set up triggers
  setupTriggers();
  
  // Update dashboard
  updateDashboard();
  
  Logger.log('✅ Initial setup complete!');
  Logger.log('Next steps:');
  Logger.log('1. Update CONFIG object with your details');
  Logger.log('2. Create Google Drive folder and update DRIVE_FOLDER_ID');
  Logger.log('3. Sign up for Wati.io and update WATI API_KEY');
  Logger.log('4. Deploy as web app for dashboard access');
}
// ============================================
// ENHANCED WEB APP - COMPLETE BACKEND FUNCTIONS
// Add these to the END of your Code.gs file
// ============================================

/**
 * Serve the enhanced dashboard HTML
 */
function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('Enhanced_Dashboard')
    .setTitle('Assorted Coworking Management')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Get dashboard metrics - computed live from sheets
 */
function getDashboardData() {
  try {
    const activeMembers = countActiveMembers();
    const revenue      = calculateMonthlyRevenue();
    const outstanding  = calculateOutstandingPayments();
    const expenses     = calculateMonthlyExpenses();
    const netProfit    = revenue - expenses;
    const occupancy    = calculateOccupancyRate();

    return {
      activeMembers: activeMembers,
      revenue:       revenue,
      outstanding:   outstanding,
      expenses:      expenses,
      netProfit:     netProfit,
      occupancy:     occupancy
    };
  } catch (error) {
    Logger.log('getDashboardData error: ' + error);
    return {activeMembers: 0, revenue: 0, outstanding: 0, expenses: 0, netProfit: 0, occupancy: '0%'};
  }
}

/**
 * Get recent invoices
 */
function getRecentInvoices(limit) {
  limit = limit || 10;
  try {
    const sheets = getSheets();
    const invoicesData = sheets.invoices.getDataRange().getValues();
    const membersData = sheets.members.getDataRange().getValues();
    
    const memberMap = {};
    for (let i = 1; i < membersData.length; i++) {
      memberMap[membersData[i][0]] = membersData[i][1];
    }
    
    const invoices = [];
    const startRow = Math.max(1, invoicesData.length - limit);
    
    for (let i = invoicesData.length - 1; i >= startRow; i--) {
      const row = invoicesData[i];
      invoices.push({
        invoiceId: row[0],
        invoiceNumber: row[2],
        memberName: memberMap[row[1]] || 'Unknown',
        month: row[3],
        amount: row[6],
        dueDate: Utilities.formatDate(new Date(row[5]), Session.getScriptTimeZone(), 'dd MMM yyyy'),
        status: row[7],
        pdfLink: row[8] || ''
      });
    }
    
    return invoices;
  } catch (error) {
    Logger.log('Error getting recent invoices: ' + error);
    return [];
  }
}

/**
 * Get all invoices
 */
function getAllInvoices() {
  try {
    const sheets = getSheets();
    const invoicesData = sheets.invoices.getDataRange().getValues();
    const membersData = sheets.members.getDataRange().getValues();
    
    const memberMap = {};
    for (let i = 1; i < membersData.length; i++) {
      memberMap[membersData[i][0]] = membersData[i][1];
    }
    
    const invoices = [];
    
    for (let i = invoicesData.length - 1; i >= 1; i--) {
      const row = invoicesData[i];
      invoices.push({
        invoiceId: row[0],
        invoiceNumber: row[2],
        memberName: memberMap[row[1]] || 'Unknown',
        month: row[3],
        amount: row[6],
        dueDate: Utilities.formatDate(new Date(row[5]), Session.getScriptTimeZone(), 'dd MMM yyyy'),
        status: row[7],
        pdfLink: row[8] || ''
      });
    }
    
    return invoices;
  } catch (error) {
    Logger.log('Error getting all invoices: ' + error);
    return [];
  }
}

/**
 * BULK INVOICE GENERATION - Generate invoices for ALL active members
 */
function generateBulkMonthlyInvoices() {
  const sheets = getSheets();
  const membersSheet = sheets.members;
  const membersData = membersSheet.getDataRange().getValues();
  
  let count = 0;
  const currentMonth = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'MMMM yyyy');
  
  Logger.log('===== BULK INVOICE GENERATION STARTED =====');
  Logger.log('Month: ' + currentMonth);
  
  for (let i = 1; i < membersData.length; i++) {
    const row = membersData[i];
    const memberId = row[0];
    const status = row[9];
    
    // Only generate for active members
    if (status === 'Active') {
      // Check if invoice already exists for this month
      if (!invoiceExistsForMonth(memberId, currentMonth)) {
        try {
          generateInvoiceForMember(memberId);
          count++;
          Logger.log('✅ Generated invoice for member: ' + memberId);
        } catch (error) {
          Logger.log('❌ Error generating invoice for ' + memberId + ': ' + error);
        }
      } else {
        Logger.log('⏭️ Invoice already exists for ' + memberId + ' this month');
      }
    }
  }
  
  // Update dashboard after bulk generation
  updateDashboard();
  
  Logger.log('===== BULK INVOICE GENERATION COMPLETE =====');
  Logger.log('Total invoices generated: ' + count);
  
  return {
    success: true,
    count: count,
    message: `Generated ${count} invoices for ${currentMonth}`
  };
}

/**
 * Get all members
 */
function getAllMembers() {
  try {
    const sheets = getSheets();
    const membersData = sheets.members.getDataRange().getValues();
    const members = [];
    
    for (let i = 1; i < membersData.length; i++) {
      const row = membersData[i];
      members.push({
        memberId: row[0],
        fullName: row[1],
        phone: row[2],
        email: row[3],
        companyName: row[4],
        plan: row[5],
        monthlyFee: row[6],
        startDate: Utilities.formatDate(new Date(row[7]), Session.getScriptTimeZone(), 'dd MMM yyyy'),
        billingDay: row[8],
        status: row[9]
      });
    }
    
    return members;
  } catch (error) {
    Logger.log('Error getting all members: ' + error);
    return [];
  }
}

/**
 * Add new member from web app
 */
function addNewMember(data) {
  try {
    // Create member
    const memberId = createMember(data);
    
    // Generate first invoice
    const invoiceNumber = generateInvoiceForMember(memberId);
    
    // Update dashboard
    updateDashboard();
    
    Logger.log('✅ New member added: ' + memberId);
    
    return {
      success: true,
      memberId: memberId,
      invoiceNumber: invoiceNumber
    };
  } catch (error) {
    Logger.log('❌ Error adding member: ' + error);
    throw error;
  }
}

/**
 * Get all payments
 */
function getAllPayments() {
  try {
    const sheets = getSheets();
    const paymentsData = sheets.payments.getDataRange().getValues();
    const invoicesData = sheets.invoices.getDataRange().getValues();
    
    const invoiceMap = {};
    for (let i = 1; i < invoicesData.length; i++) {
      invoiceMap[invoicesData[i][0]] = invoicesData[i][2]; // invoiceId -> invoiceNumber
    }
    
    const payments = [];
    
    for (let i = paymentsData.length - 1; i >= 1; i--) {
      const row = paymentsData[i];
      payments.push({
        paymentId: row[0],
        invoiceNumber: invoiceMap[row[1]] || 'Unknown',
        amount: row[2],
        method: row[3],
        date: Utilities.formatDate(new Date(row[4]), Session.getScriptTimeZone(), 'dd MMM yyyy'),
        reference: row[5] || ''
      });
    }
    
    return payments;
  } catch (error) {
    Logger.log('Error getting all payments: ' + error);
    return [];
  }
}

/**
 * Get unpaid invoices for payment dropdown
 */
function getUnpaidInvoices() {
  try {
    const sheets = getSheets();
    const invoicesData = sheets.invoices.getDataRange().getValues();
    const membersData = sheets.members.getDataRange().getValues();
    
    const memberMap = {};
    for (let i = 1; i < membersData.length; i++) {
      memberMap[membersData[i][0]] = membersData[i][1];
    }
    
    const invoices = [];
    
    for (let i = 1; i < invoicesData.length; i++) {
      const row = invoicesData[i];
      const status = row[7];
      
      if (status === 'Sent' || status === 'Overdue') {
        invoices.push({
          invoiceId: row[0],
          invoiceNumber: row[2],
          memberName: memberMap[row[1]] || 'Unknown',
          amount: row[6],
          status: status
        });
      }
    }
    
    return invoices;
  } catch (error) {
    Logger.log('Error getting unpaid invoices: ' + error);
    return [];
  }
}

/**
 * Record new payment from web app
 */
function recordNewPayment(data) {
  try {
    const paymentId = recordPayment(
      data.invoiceId,
      data.amount,
      data.method,
      data.reference + (data.notes ? ' - ' + data.notes : '')
    );
    
    Logger.log('✅ Payment recorded: ' + paymentId);
    
    return {
      success: true,
      paymentId: paymentId
    };
  } catch (error) {
    Logger.log('❌ Error recording payment: ' + error);
    throw error;
  }
}

/**
 * Get all expenses
 */
function getAllExpenses() {
  try {
    const sheets = getSheets();
    const expensesData = sheets.expenses.getDataRange().getValues();
    const expenses = [];
    
    for (let i = expensesData.length - 1; i >= 1; i--) {
      const row = expensesData[i];
      expenses.push({
        expenseId: row[0],
        title: row[1],
        category: row[2],
        amount: row[3],
        date: Utilities.formatDate(new Date(row[4]), Session.getScriptTimeZone(), 'dd MMM yyyy'),
        method: row[5]
      });
    }
    
    return expenses;
  } catch (error) {
    Logger.log('Error getting all expenses: ' + error);
    return [];
  }
}

/**
 * Add new expense from web app
 */
function addNewExpense(data) {
  try {
    const sheets = getSheets();
    const expensesSheet = sheets.expenses;
    
    // Generate Expense ID
    const lastRow = expensesSheet.getLastRow();
    const expenseId = 'EXP' + String(lastRow).padStart(3, '0');
    
    // Add expense to sheet
    expensesSheet.appendRow([
      expenseId,
      data.title,
      data.category,
      data.amount,
      new Date(data.date),
      data.method,
      data.notes || ''
    ]);
    
    // Update dashboard
    updateDashboard();
    
    Logger.log('✅ Expense added: ' + expenseId);
    
    return {
      success: true,
      expenseId: expenseId
    };
  } catch (error) {
    Logger.log('❌ Error adding expense: ' + error);
    throw error;
  }
}

/**
 * Get overdue invoices with details
 */
function getOverdueInvoices() {
  try {
    const sheets = getSheets();
    const invoicesData = sheets.invoices.getDataRange().getValues();
    const membersData = sheets.members.getDataRange().getValues();
    
    const memberMap = {};
    for (let i = 1; i < membersData.length; i++) {
      memberMap[membersData[i][0]] = {
        name: membersData[i][1],
        email: membersData[i][3]
      };
    }
    
    const overdueInvoices = [];
    const today = new Date();
    
    for (let i = 1; i < invoicesData.length; i++) {
      const row = invoicesData[i];
      const status = row[7];
      const dueDate = new Date(row[5]);
      
      if (status === 'Overdue' || (status === 'Sent' && dueDate < today)) {
        const daysOverdue = Math.floor((today - dueDate) / (1000 * 60 * 60 * 24));
        const memberInfo = memberMap[row[1]] || {name: 'Unknown', email: ''};
        
        overdueInvoices.push({
          invoiceId: row[0],
          invoiceNumber: row[2],
          memberName: memberInfo.name,
          email: memberInfo.email,
          amount: row[6],
          dueDate: Utilities.formatDate(dueDate, Session.getScriptTimeZone(), 'dd MMM yyyy'),
          daysOverdue: daysOverdue
        });
      }
    }
    
    return overdueInvoices;
  } catch (error) {
    Logger.log('Error getting overdue invoices: ' + error);
    return [];
  }
}

/**
 * Send reminder for all overdue invoices
 */
function sendAllOverdueReminders() {
  try {
    const sheets = getSheets();
    const invoicesData = sheets.invoices.getDataRange().getValues();
    const membersData = sheets.members.getDataRange().getValues();
    
    const memberMap = {};
    for (let i = 1; i < membersData.length; i++) {
      memberMap[membersData[i][0]] = {
        fullName: membersData[i][1],
        email: membersData[i][3],
        phone: membersData[i][2]
      };
    }
    
    let count = 0;
    const today = new Date();
    
    for (let i = 1; i < invoicesData.length; i++) {
      const row = invoicesData[i];
      const status = row[7];
      const dueDate = new Date(row[5]);
      
      if (status === 'Overdue' || (status === 'Sent' && dueDate < today)) {
        const memberId = row[1];
        const memberData = memberMap[memberId];
        
        if (memberData) {
          try {
            sendOverdueReminder(memberData, row[2], row[6], dueDate);
            count++;
            Logger.log('✅ Reminder sent for invoice: ' + row[2]);
          } catch (error) {
            Logger.log('❌ Error sending reminder for ' + row[2] + ': ' + error);
          }
        }
      }
    }
    
    Logger.log('===== OVERDUE REMINDERS SENT =====');
    Logger.log('Total reminders sent: ' + count);
    
    return {
      success: true,
      count: count
    };
  } catch (error) {
    Logger.log('❌ Error sending overdue reminders: ' + error);
    throw error;
  }
}

/**
 * Send reminder for single invoice
 */
function sendSingleOverdueReminder(invoiceId) {
  try {
    const sheets = getSheets();
    const invoicesData = sheets.invoices.getDataRange().getValues();
    const membersData = sheets.members.getDataRange().getValues();
    
    // Find invoice
    let invoiceRow = null;
    for (let i = 1; i < invoicesData.length; i++) {
      if (invoicesData[i][0] === invoiceId) {
        invoiceRow = invoicesData[i];
        break;
      }
    }
    
    if (!invoiceRow) {
      throw new Error('Invoice not found');
    }
    
    // Find member
    const memberId = invoiceRow[1];
    let memberData = null;
    for (let i = 1; i < membersData.length; i++) {
      if (membersData[i][0] === memberId) {
        memberData = {
          fullName: membersData[i][1],
          email: membersData[i][3],
          phone: membersData[i][2]
        };
        break;
      }
    }
    
    if (!memberData) {
      throw new Error('Member not found');
    }
    
    // Send reminder
    sendOverdueReminder(memberData, invoiceRow[2], invoiceRow[6], new Date(invoiceRow[5]));
    
    Logger.log('✅ Reminder sent for invoice: ' + invoiceRow[2]);
    
    return {success: true};
  } catch (error) {
    Logger.log('❌ Error sending single reminder: ' + error);
    throw error;
  }
}
