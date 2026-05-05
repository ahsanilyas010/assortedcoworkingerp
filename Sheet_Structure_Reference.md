# Google Sheets Structure Reference

Complete specification for all sheets in the Assorted Coworking Management system.

---

## 📊 Sheet 1: MEMBERS

### Purpose
Store all member information and track membership status.

### Columns

| Column | Name | Type | Required | Description |
|--------|------|------|----------|-------------|
| A | Member ID | Text | Yes | Unique ID (M001, M002, etc.) |
| B | Full Name | Text | Yes | Member's full name |
| C | Phone | Text | Yes | Phone in format: +923421234567 |
| D | Email | Text | Yes | Member's email address |
| E | Company Name | Text | No | Company/business name (optional) |
| F | Plan | Text | Yes | Hot Desk / Dedicated Desk / Private Office |
| G | Monthly Fee | Number | Yes | Amount in PKR |
| H | Start Date | Date | Yes | Membership start date |
| I | Billing Day | Number | Yes | Day of month (1-31) |
| J | Status | Text | Yes | Active / Inactive / Suspended |
| K | Notes | Text | No | Any additional notes |

### Sample Data

```
M001 | Ahsan Ilyas | +923422221633 | ahsan@fi.net.pk | Assorted | Private Office | 50000 | 2024-01-15 | 15 | Active | Founder
M002 | John Doe | +923001234567 | john@example.com | Tech Co | Hot Desk | 15000 | 2024-02-01 | 1 | Active |
M003 | Jane Smith | +923111234567 | jane@company.com | Design Studio | Dedicated Desk | 25000 | 2024-03-10 | 10 | Active |
```

### Validation Rules

**Phone:**
- Must start with +92
- Format: +923XXXXXXXXX

**Billing Day:**
- Number between 1-31
- Common values: 1, 15, 30

**Status:**
- Active: Current member
- Inactive: Membership ended
- Suspended: Temporarily paused

---

## 📄 Sheet 2: INVOICES

### Purpose
Track all generated invoices and their status.

### Columns

| Column | Name | Type | Required | Description |
|--------|------|------|----------|-------------|
| A | Invoice ID | Text | Yes | Unique ID (INV001, INV002, etc.) |
| B | Member ID | Text | Yes | Reference to MEMBERS sheet |
| C | Invoice Number | Text | Yes | INV-1001, INV-1002, etc. |
| D | Month | Text | Yes | "May 2026" format |
| E | Issue Date | Date | Yes | When invoice was created |
| F | Due Date | Date | Yes | Payment due date |
| G | Amount | Number | Yes | Invoice amount in PKR |
| H | Status | Text | Yes | Draft / Sent / Paid / Overdue |
| I | PDF Link | URL | No | Google Drive link to PDF |
| J | Drive File ID | Text | No | Google Drive file ID |

### Sample Data

```
INV001 | M001 | INV-1001 | May 2026 | 2026-05-01 | 2026-05-06 | 50000 | Sent | https://drive.google.com/... | abc123xyz
INV002 | M002 | INV-1002 | May 2026 | 2026-05-01 | 2026-05-06 | 15000 | Paid | https://drive.google.com/... | def456uvw
INV003 | M003 | INV-1003 | May 2026 | 2026-05-10 | 2026-05-15 | 25000 | Overdue | https://drive.google.com/... | ghi789rst
```

### Status Flow

```
Draft → Sent → Paid
  ↓       ↓
Cancelled Overdue
```

**Draft:** Invoice created but not sent  
**Sent:** Invoice delivered to member  
**Paid:** Payment received  
**Overdue:** Past due date, not paid  
**Cancelled:** Invoice voided

---

## 💰 Sheet 3: PAYMENTS

### Purpose
Record all payments received against invoices.

### Columns

| Column | Name | Type | Required | Description |
|--------|------|------|----------|-------------|
| A | Payment ID | Text | Yes | Unique ID (PAY001, PAY002, etc.) |
| B | Invoice ID | Text | Yes | Reference to INVOICES sheet |
| C | Amount Paid | Number | Yes | Payment amount in PKR |
| D | Payment Method | Text | Yes | cash / bank_transfer / online / cheque |
| E | Payment Date | Date | Yes | When payment was received |
| F | Reference Number | Text | No | Bank transaction ID, etc. |
| G | Notes | Text | No | Any additional notes |

### Sample Data

```
PAY001 | INV001 | 50000 | bank_transfer | 2026-05-03 | TXN123456 | Paid via Bank Alfalah
PAY002 | INV002 | 15000 | cash | 2026-05-02 | | Cash payment
PAY003 | INV004 | 12500 | bank_transfer | 2026-05-05 | TXN789012 | Partial payment 1/2
PAY004 | INV004 | 12500 | bank_transfer | 2026-05-10 | TXN789013 | Partial payment 2/2
```

### Payment Methods

**cash:** Cash payment at office  
**bank_transfer:** Bank transfer/deposit  
**online:** Online payment gateway  
**cheque:** Cheque payment

### Partial Payments

Multiple payment records can exist for one invoice:
```
Invoice: 25,000
Payment 1: 15,000 (Partial)
Payment 2: 10,000 (Partial)
Total Paid: 25,000 → Invoice marked "Paid"
```

---

## 📝 Sheet 4: EXPENSES

### Purpose
Track all business expenses for financial reporting.

### Columns

| Column | Name | Type | Required | Description |
|--------|------|------|----------|-------------|
| A | Expense ID | Text | Yes | Unique ID (EXP001, EXP002, etc.) |
| B | Title | Text | Yes | Expense description |
| C | Category | Text | Yes | rent / salary / utilities / maintenance / misc |
| D | Amount | Number | Yes | Expense amount in PKR |
| E | Date | Date | Yes | Expense date |
| F | Payment Method | Text | Yes | cash / bank_transfer / online / cheque |
| G | Notes | Text | No | Any additional notes |

### Sample Data

```
EXP001 | Office Rent - May | rent | 150000 | 2026-05-01 | bank_transfer | D-12 Markaz monthly rent
EXP002 | Electricity Bill | utilities | 25000 | 2026-05-05 | cash | IESCO bill payment
EXP003 | Cleaning Staff Salary | salary | 30000 | 2026-05-01 | cash | Monthly salary
EXP004 | AC Repair | maintenance | 15000 | 2026-05-12 | bank_transfer | Main hall AC service
EXP005 | Office Supplies | misc | 5000 | 2026-05-08 | cash | Stationery and supplies
```

### Expense Categories

**rent:** Office rent, parking, storage  
**salary:** Staff salaries, contractor payments  
**utilities:** Electricity, water, internet, gas  
**maintenance:** Repairs, servicing, cleaning  
**misc:** Everything else

---

## 📊 Sheet 5: DASHBOARD_DATA

### Purpose
Store calculated metrics for dashboard display. Auto-updated by system.

### Columns

| Column | Name | Type | Description |
|--------|------|------|-------------|
| A | Metric | Text | Metric name |
| B | Value | Mixed | Calculated value |

### Sample Data

```
Metric                      | Value
---------------------------|--------
Total Active Members        | 28
Monthly Revenue             | 720000
Outstanding Payments        | 150000
Total Expenses (Month)      | 250000
Net Profit                  | 470000
Occupancy Rate              | 56%
```

### Metrics Explained

**Total Active Members:**  
Count of members with Status = "Active"

**Monthly Revenue:**  
Sum of paid invoices for current month

**Outstanding Payments:**  
Sum of unpaid invoices (Status = Sent or Overdue)

**Total Expenses (Month):**  
Sum of expenses for current month

**Net Profit:**  
Monthly Revenue - Total Expenses

**Occupancy Rate:**  
(Active Members / Total Capacity) × 100%

---

## 🎨 Formatting Guidelines

### Header Row (Row 1)

**All Sheets:**
- Background: #1C4585 (Blue)
- Text Color: White
- Font Weight: Bold
- Font Size: 11pt
- Alignment: Center

### Data Rows

**Status Columns:**
- Active: Green (#76B048)
- Inactive: Gray (#666666)
- Suspended: Orange (#F36F29)

**Invoice Status:**
- Paid: Green background
- Sent: Yellow background
- Overdue: Red background
- Draft: Gray background

### Number Formatting

**Currency (PKR):**
```
Format: 50,000
No decimals for whole amounts
```

**Dates:**
```
Format: DD/MM/YYYY
Example: 01/05/2026
```

**Percentages:**
```
Format: 56.5%
One decimal place
```

---

## 🔗 Sheet Relationships

```
MEMBERS (Member ID)
    ↓
INVOICES (Member ID → Invoice ID)
    ↓
PAYMENTS (Invoice ID)

EXPENSES (standalone)

DASHBOARD_DATA (calculated from all sheets)
```

### Foreign Keys

**INVOICES.Member ID** → **MEMBERS.Member ID**  
**PAYMENTS.Invoice ID** → **INVOICES.Invoice ID**

---

## 📏 Data Validation

### MEMBERS Sheet

**Plan (Column F):**
```
Dropdown: Hot Desk, Dedicated Desk, Private Office
```

**Status (Column J):**
```
Dropdown: Active, Inactive, Suspended
```

**Billing Day (Column I):**
```
Number: 1 to 31
```

### INVOICES Sheet

**Status (Column H):**
```
Dropdown: Draft, Sent, Paid, Overdue, Cancelled
```

### PAYMENTS Sheet

**Payment Method (Column D):**
```
Dropdown: cash, bank_transfer, online, cheque
```

### EXPENSES Sheet

**Category (Column C):**
```
Dropdown: rent, salary, utilities, maintenance, misc
```

**Payment Method (Column F):**
```
Dropdown: cash, bank_transfer, online, cheque
```

---

## 🧮 Formulas (Optional)

You can add these to automate calculations:

### INVOICES Sheet - Amount Paid

```excel
=SUMIF(PAYMENTS!B:B, INVOICES!A2, PAYMENTS!C:C)
```

### DASHBOARD_DATA Sheet - Active Members

```excel
=COUNTIF(MEMBERS!J:J, "Active")
```

### DASHBOARD_DATA Sheet - Monthly Revenue

```excel
=SUMIFS(INVOICES!G:G, INVOICES!H:H, "Paid", INVOICES!D:D, "May 2026")
```

---

## 🔒 Protection (Recommended)

Protect certain columns from accidental edits:

### MEMBERS Sheet
- Protect: Member ID (Column A)
- Protect: Monthly Fee (Column G) - only if using formula

### INVOICES Sheet
- Protect: Invoice ID (Column A)
- Protect: Invoice Number (Column C)
- Protect: Drive File ID (Column J)

### PAYMENTS Sheet
- Protect: Payment ID (Column A)

### EXPENSES Sheet
- Protect: Expense ID (Column A)

---

## 📦 Backup & Export

### Regular Backups

**Weekly:**
1. File → Download → Microsoft Excel (.xlsx)
2. Save to local drive
3. Upload to Google Drive backup folder

**Monthly:**
1. File → Make a copy
2. Rename with date: "Assorted Coworking - May 2026 Backup"

### Export Options

**CSV Export:**
- Each sheet separately
- For importing to other systems

**Excel Export:**
- Full workbook
- Preserves formatting

---

## 🎯 Best Practices

### Data Entry

1. **Never skip Member ID** - Use sequential numbering
2. **Phone numbers** - Always include country code
3. **Dates** - Use consistent format (DD/MM/YYYY)
4. **Status** - Update promptly when membership changes
5. **Notes** - Document important information

### Data Cleanup

**Monthly:**
- Remove test data
- Archive old invoices
- Update member statuses
- Verify payment records

### Performance

**If sheet gets slow (>500 members):**
- Archive old invoices to separate sheet
- Keep only current year in main sheet
- Use filters instead of scrolling

---

## ✅ Sheet Setup Checklist

- [ ] All 5 sheets created with exact names
- [ ] Column headers added to each sheet
- [ ] Headers formatted (blue background, white text)
- [ ] Data validation added
- [ ] Sample data removed before going live
- [ ] Protection applied to key columns
- [ ] Backup schedule established

---

**Sheet Structure Version:** 1.0  
**Last Updated:** May 2026  
**Compatible with:** Apps Script Code v1.0
