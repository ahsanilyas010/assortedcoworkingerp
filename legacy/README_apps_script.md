# Assorted Coworking Management System

Complete automation system for coworking space management using Google Workspace.

## 🎯 What This System Does

- ✅ **Automated Monthly Invoicing** - Generates invoices automatically on billing day
- ✅ **PDF Generation** - Creates professional invoices via invoicegenerator.com
- ✅ **Google Drive Storage** - Saves all invoices to your Drive
- ✅ **WhatsApp Notifications** - Sends invoices via WhatsApp (Wati.io)
- ✅ **Email Automation** - Emails invoices with PDF attachments
- ✅ **Payment Tracking** - Records and tracks all payments
- ✅ **Expense Management** - Monitors business expenses
- ✅ **Web Dashboard** - Real-time business analytics
- ✅ **Form Integration** - Auto-creates members from Lovable form

---

## 📋 Prerequisites

Before you start, you need:

1. **Google Account** (ahsan@fi.net.pk)
2. **Google Drive Folder** (for invoice storage)
3. **Wati.io Account** (for WhatsApp automation)
4. **Lovable Form** (already created at https://assortedforms.lovable.app)

---

## 🚀 Setup Instructions

### Step 1: Create Google Sheet

1. Go to Google Sheets
2. Create new spreadsheet: **"Assorted Coworking Management"**
3. Create 5 sheets with these exact names:
   - `MEMBERS`
   - `INVOICES`
   - `PAYMENTS`
   - `EXPENSES`
   - `DASHBOARD_DATA`

### Step 2: Add Column Headers

**MEMBERS Sheet:**
```
Member ID | Full Name | Phone | Email | Company Name | Plan | Monthly Fee | Start Date | Billing Day | Status | Notes
```

**INVOICES Sheet:**
```
Invoice ID | Member ID | Invoice Number | Month | Issue Date | Due Date | Amount | Status | PDF Link | Drive File ID
```

**PAYMENTS Sheet:**
```
Payment ID | Invoice ID | Amount Paid | Payment Method | Payment Date | Reference Number | Notes
```

**EXPENSES Sheet:**
```
Expense ID | Title | Category | Amount | Date | Payment Method | Notes
```

**DASHBOARD_DATA Sheet:**
```
Metric | Value
```

### Step 3: Add Apps Script

1. In your Google Sheet: **Extensions → Apps Script**
2. Delete the default `Code.gs` content
3. Copy the entire content from `Code.gs` file
4. Paste into Apps Script editor
5. Save (Ctrl+S)

### Step 4: Configure Settings

In the Apps Script `Code.gs`, update the `CONFIG` object:

```javascript
const CONFIG = {
  DRIVE_FOLDER_ID: 'YOUR_FOLDER_ID_HERE',  // See Step 5
  BUSINESS_INFO: {
    name: 'Assorted Coworking',
    address: 'FF 27, Zarpar Arcade, D-12 Markaz, Islamabad, Pakistan',
    phone: '+92 342 2221633',
    email: 'info@assorted.business',
    website: 'www.assorted.business',
  },
  WATI: {
    API_URL: 'YOUR_WATI_URL_HERE',  // See Step 6
    API_KEY: 'YOUR_WATI_KEY_HERE',
  },
  BANK_DETAILS: {
    bank: 'YOUR_BANK_NAME',
    accountTitle: 'Assorted Coworking',
    accountNumber: 'YOUR_ACCOUNT_NUMBER',
    iban: 'YOUR_IBAN',
  },
  TOTAL_CAPACITY: 50,  // Update based on your space
};
```

### Step 5: Create Google Drive Folder

1. Go to Google Drive
2. Create folder: **"Assorted Coworking Invoices"**
3. Open the folder
4. Copy the ID from URL:
   ```
   https://drive.google.com/drive/folders/1a2b3c4d5e6f7g8h9
                                            ^^^^^^^^^^^^^^^^^^^
                                            This is the Folder ID
   ```
5. Update `DRIVE_FOLDER_ID` in CONFIG

### Step 6: Set Up Wati.io (WhatsApp)

1. Go to https://wati.io
2. Sign up for FREE account
3. Connect your phone number
4. Go to **Settings → API**
5. Copy your **API Endpoint** and **API Key**
6. Update `WATI` section in CONFIG

**Create WhatsApp Template:**
- Template Name: `invoice_notification`
- Category: Utility
- Language: English
- Body:
  ```
  Hi {{1}},
  
  Your invoice {{2}} for PKR {{3}} is ready.
  
  Due Date: {{4}}
  
  Download: {{5}}
  
  Thank you for being part of Assorted Coworking!
  ```

### Step 7: Set Up Triggers

1. In Apps Script editor
2. Run the function: `setupTriggers`
3. Grant permissions when prompted
4. Verify triggers are created:
   - Tools → Triggers
   - You should see 3 triggers

### Step 8: Deploy Web Dashboard

1. In Apps Script: **Deploy → New deployment**
2. Type: **Web app**
3. Execute as: **Me**
4. Who has access: **Anyone** (or **Only myself**)
5. Click **Deploy**
6. Copy the **Web App URL**
7. Bookmark this URL - this is your dashboard

### Step 9: Connect Lovable Form

1. Go to your Lovable form settings
2. Find **Webhook** or **API Integration**
3. Add webhook URL:
   ```
   https://script.google.com/YOUR_SCRIPT_ID/exec
   ```
4. Test the webhook

### Step 10: Run Initial Setup

1. In Apps Script editor
2. Run function: `initialSetup`
3. Check execution log for success

---

## 📱 How It Works

### New Member Joins

1. Member fills Lovable form
2. Apps Script receives webhook
3. Member added to MEMBERS sheet
4. First invoice generated automatically
5. PDF saved to Google Drive
6. WhatsApp notification sent
7. Email with PDF sent

### Monthly Billing (Automated)

**Every day at 9:00 AM:**
1. Script checks billing day for each member
2. If today = billing day → generate invoice
3. Save PDF to Drive
4. Send WhatsApp + Email

### Payment Recording

1. You record payment in dashboard
2. Invoice status updated to "Paid"
3. Confirmation email sent to member
4. Dashboard metrics updated

### Overdue Checking

**Every day at 10:00 AM:**
1. Script checks due dates
2. Overdue invoices marked
3. Reminder emails sent

---

## 🎛️ Using the Dashboard

### Access Dashboard
Open your Web App URL in browser

### Dashboard Features

**Stats Cards:**
- Active Members
- Monthly Revenue
- Outstanding Payments
- Net Profit

**Recent Invoices Table:**
- View all recent invoices
- Click "View PDF" to open invoice
- Status badges (Paid/Sent/Overdue)

**Quick Actions:**
- **Record Payment** - Mark invoice as paid
- **Add Expense** - Track business expenses
- **Generate Invoice** - Manual invoice creation
- **View Members** - See all members

---

## 💰 Pricing Plans

Update these in `createMember` function:

```javascript
const planPricing = {
  'Hot Desk': 15000,          // PKR 15,000/month
  'Dedicated Desk': 25000,    // PKR 25,000/month
  'Private Office': 50000,    // PKR 50,000/month
};
```

---

## 🔧 Troubleshooting

### Invoices not generating?
- Check triggers are active: Tools → Triggers
- Run `generateMonthlyInvoices` manually
- Check execution log for errors

### WhatsApp not working?
- Verify Wati.io API key is correct
- Check template is approved
- Test API endpoint in Wati.io dashboard

### Email not sending?
- Check Gmail quota (500 emails/day)
- Verify email permissions
- Test with `sendInvoiceEmail` function

### PDF not saving to Drive?
- Verify DRIVE_FOLDER_ID is correct
- Check folder permissions
- Ensure invoicegenerator.com is responding

---

## 📊 Data Structure

### Member Record
```
M001 | Ahsan Ilyas | +92342222163 | ahsan@fi.net.pk | Assorted | Private Office | 50000 | 2026-01-15 | 15 | Active |
```

### Invoice Record
```
INV001 | M001 | INV-1001 | May 2026 | 2026-05-01 | 2026-05-06 | 50000 | Sent | https://drive.google.com/... | abc123
```

### Payment Record
```
PAY001 | INV001 | 50000 | Bank Transfer | 2026-05-03 | TXN123456 | Paid via bank
```

---

## 🔐 Security

- All data stored in your Google account
- Apps Script runs with your permissions
- Webhook endpoint is authenticated
- PDFs stored in private Drive folder
- API keys stored in script (not exposed)

---

## 📈 Scaling

**Current capacity:** 50 members

**To scale to 100+ members:**
1. Update `TOTAL_CAPACITY` in CONFIG
2. Consider upgrading Wati.io plan
3. Monitor Gmail sending quota
4. Optimize sheet performance

---

## 🆘 Support

**Common Issues:**

1. **"Permission denied"**
   - Re-run setup and grant permissions
   
2. **"Invoice generation failed"**
   - Check invoicegenerator.com is accessible
   
3. **"Webhook not receiving data"**
   - Verify webhook URL in Lovable
   - Check Apps Script deployment

---

## 🔄 Updating the System

1. Make changes in Apps Script
2. Save (Ctrl+S)
3. Deploy → Manage deployments
4. Create new version

---

## 📝 License

Internal use only - Assorted Coworking

---

## 👤 Created For

**Ahsan Ilyas**  
Assorted Coworking  
ahsan@fi.net.pk  
+92 342 2221633

---

## 🎯 Next Steps

After setup:

1. ☐ Import existing members (if any)
2. ☐ Generate test invoice
3. ☐ Test WhatsApp notification
4. ☐ Test email automation
5. ☐ Train staff on dashboard
6. ☐ Connect Lovable form webhook
7. ☐ Go live! 🚀

---

**Version:** 1.0  
**Last Updated:** May 2026  
**Status:** Production Ready
