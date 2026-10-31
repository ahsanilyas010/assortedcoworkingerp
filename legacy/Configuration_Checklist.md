# Configuration Checklist

Complete this checklist before going live with the system.

---

## ☐ Google Workspace Setup

### Google Sheet
- [ ] Created spreadsheet: "Assorted Coworking Management"
- [ ] Created 5 sheets: MEMBERS, INVOICES, PAYMENTS, EXPENSES, DASHBOARD_DATA
- [ ] Added column headers to each sheet
- [ ] Formatted headers (bold, colored background)

### Apps Script
- [ ] Pasted Code.gs into Apps Script editor
- [ ] Pasted Dashboard.html into Apps Script
- [ ] Saved both files

---

## ☐ Configuration Updates

### Drive Folder
- [ ] Created folder: "Assorted Coworking Invoices"
- [ ] Copied Folder ID
- [ ] Updated `DRIVE_FOLDER_ID` in CONFIG

### Business Information
- [ ] Updated business name: **Assorted Coworking**
- [ ] Updated address: **FF 27, Zarpar Arcade, D-12 Markaz, Islamabad**
- [ ] Updated phone: **+92 342 2221633**
- [ ] Updated email: **info@assorted.business**
- [ ] Updated website (if applicable)

### Logo
- [ ] Uploaded logo to Drive/Imgur
- [ ] Made logo publicly accessible
- [ ] Copied logo URL
- [ ] Updated logo URL in `createInvoicePDF` function

### Bank Details
- [ ] Bank Name: _______________
- [ ] Account Title: Assorted Coworking
- [ ] Account Number: _______________
- [ ] IBAN: _______________
- [ ] Updated all bank details in CONFIG

### Pricing Plans
- [ ] Hot Desk: PKR _______________
- [ ] Dedicated Desk: PKR _______________
- [ ] Private Office: PKR _______________
- [ ] Updated pricing in `createMember` function

### Space Capacity
- [ ] Total capacity: _______________ members
- [ ] Updated `TOTAL_CAPACITY` in CONFIG

---

## ☐ Wati.io Setup (WhatsApp)

### Account Creation
- [ ] Signed up at https://wati.io
- [ ] Verified phone number
- [ ] Completed onboarding

### API Configuration
- [ ] Copied API Endpoint URL
- [ ] Copied API Key
- [ ] Updated `WATI.API_URL` in CONFIG
- [ ] Updated `WATI.API_KEY` in CONFIG

### WhatsApp Templates
- [ ] Created template: `invoice_notification`
- [ ] Template approved by WhatsApp
- [ ] Tested template in Wati dashboard

---

## ☐ Triggers & Automation

### Set Up Triggers
- [ ] Ran `setupTriggers` function
- [ ] Granted all permissions
- [ ] Verified 3 triggers created:
  - [ ] Monthly invoice generation (Daily at 9 AM)
  - [ ] Overdue checker (Daily at 10 AM)
  - [ ] Dashboard update (Every 6 hours)

---

## ☐ Web Dashboard

### Deployment
- [ ] Deployed as Web App
- [ ] Set execute as: Me
- [ ] Set access: Anyone / Only myself
- [ ] Copied Web App URL
- [ ] Bookmarked dashboard URL
- [ ] Tested dashboard access

---

## ☐ Form Integration

### Lovable Form
- [ ] Form URL: https://assortedforms.lovable.app
- [ ] Configured webhook endpoint
- [ ] Webhook URL format: `https://script.google.com/macros/s/YOUR_ID/exec`
- [ ] Tested form submission
- [ ] Verified member auto-creation

---

## ☐ Testing

### Test Member Creation
- [ ] Manually created test member
- [ ] Verified member appears in MEMBERS sheet
- [ ] Invoice generated automatically
- [ ] PDF saved to Drive
- [ ] WhatsApp notification sent (if configured)
- [ ] Email notification sent

### Test Invoice Generation
- [ ] Ran `generateInvoiceForMember` manually
- [ ] Invoice appears in INVOICES sheet
- [ ] PDF visible in Drive folder
- [ ] PDF link works
- [ ] Invoice number increments correctly

### Test Payment Recording
- [ ] Recorded test payment
- [ ] Payment appears in PAYMENTS sheet
- [ ] Invoice status updated to "Paid"
- [ ] Dashboard updated
- [ ] Payment confirmation email sent

### Test Expense Tracking
- [ ] Added test expense
- [ ] Expense appears in EXPENSES sheet
- [ ] Dashboard reflects expense
- [ ] Net profit calculated correctly

### Test Dashboard
- [ ] All stats loading correctly
- [ ] Invoices table populating
- [ ] PDF links working
- [ ] Quick actions functional
- [ ] Refresh button working

---

## ☐ Data Migration

### Existing Members
- [ ] Exported member list (if applicable)
- [ ] Formatted data to match sheet structure
- [ ] Imported members to MEMBERS sheet
- [ ] Verified all data correct

### Historical Invoices
- [ ] Gathered previous invoices (if applicable)
- [ ] Created invoice records
- [ ] Updated payment status
- [ ] Linked to members

---

## ☐ Email Configuration

### Gmail Setup
- [ ] Using email: ahsan@fi.net.pk
- [ ] Verified sending permissions
- [ ] Tested email delivery
- [ ] Checked spam folder
- [ ] Email signature configured

---

## ☐ Security & Access

### Permissions
- [ ] Apps Script permissions granted
- [ ] Drive folder permissions set
- [ ] Web app access configured
- [ ] API keys secured (not shared publicly)

### Backup
- [ ] Created backup of Google Sheet
- [ ] Saved Apps Script code locally
- [ ] Documented all configurations

---

## ☐ Training & Documentation

### Team Training
- [ ] Demonstrated dashboard usage
- [ ] Showed how to record payments
- [ ] Explained expense tracking
- [ ] Walked through invoice generation
- [ ] Shared dashboard URL

### Documentation
- [ ] Created user manual (if needed)
- [ ] Documented common tasks
- [ ] Listed troubleshooting steps
- [ ] Shared support contacts

---

## ☐ Go Live Checklist

### Final Checks
- [ ] All test data removed
- [ ] Real pricing configured
- [ ] Bank details verified
- [ ] Contact information correct
- [ ] Logo displaying properly
- [ ] WhatsApp templates approved
- [ ] Email templates reviewed
- [ ] Dashboard accessible

### Launch Day
- [ ] Monitoring triggers
- [ ] Watching for errors
- [ ] Ready to troubleshoot
- [ ] Support available

---

## 📝 Configuration Summary

**System Email:** ahsan@fi.net.pk  
**Drive Folder ID:** _______________  
**Wati.io API Key:** _______________  
**Dashboard URL:** _______________  
**Webhook URL:** _______________

**Pricing:**
- Hot Desk: PKR _______________
- Dedicated Desk: PKR _______________
- Private Office: PKR _______________

**Bank Details:**
- Bank: _______________
- Account: _______________
- IBAN: _______________

**Capacity:** _______________ members

---

## ✅ Sign-Off

- [ ] All configuration complete
- [ ] System tested end-to-end
- [ ] Team trained
- [ ] Documentation ready
- [ ] **SYSTEM IS LIVE**

**Configured by:** _______________  
**Date:** _______________  
**Signature:** _______________

---

**Next Review Date:** _______________

---

## 📞 Support

**Issues?**
- Check execution log in Apps Script
- Review troubleshooting guide
- Contact: ahsan@fi.net.pk
