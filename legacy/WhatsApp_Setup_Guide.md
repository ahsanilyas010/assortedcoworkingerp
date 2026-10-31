# WhatsApp Automation Setup Guide
## Using Wati.io

Complete guide to setting up WhatsApp notifications for invoice delivery.

---

## 🎯 Why Wati.io?

- ✅ Official WhatsApp Business API
- ✅ Works in Pakistan
- ✅ Free tier: 1,000 messages/month
- ✅ Template-based messaging (WhatsApp requirement)
- ✅ Easy API integration
- ✅ Broadcast capabilities

---

## 📋 Step-by-Step Setup

### Step 1: Sign Up

1. Go to https://wati.io
2. Click "**Start Free Trial**"
3. Enter details:
   - Name: Ahsan Ilyas
   - Email: ahsan@fi.net.pk
   - Phone: +92 342 2221633
   - Company: Assorted Coworking
4. Click "**Sign Up**"

### Step 2: Verify Your Number

1. Wati will send WhatsApp verification
2. Open WhatsApp on your phone
3. You'll receive message from Wati
4. Click the verification link
5. Confirm verification

### Step 3: Complete Onboarding

1. Choose plan: **Free (1,000 messages/month)**
2. Select industry: **Real Estate / Coworking**
3. Skip optional features for now
4. Complete setup wizard

---

## 🔑 Get API Credentials

### Find Your API Details

1. Log into Wati.io dashboard
2. Go to **Settings** (gear icon)
3. Click **API**
4. You'll see:
   - **API Endpoint URL**
   - **API Access Token**

### Example:
```
API Endpoint: https://live-server-12345.wati.io/api/v1/sendTemplateMessage
API Token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Update Apps Script

In `Code.gs`, update CONFIG:

```javascript
WATI: {
  API_URL: 'https://live-server-12345.wati.io/api/v1/sendTemplateMessage',
  API_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
}
```

---

## 📝 Create WhatsApp Templates

WhatsApp requires pre-approved templates for business messaging.

### Template 1: Invoice Notification

**Purpose:** Send new invoice to members

**Steps:**

1. In Wati dashboard: **Templates → Create Template**
2. Fill in details:

**Template Name:** `invoice_notification`

**Category:** Utility

**Language:** English

**Header (Optional):** None

**Body:**
```
Hi {{1}},

Your invoice {{2}} for PKR {{3}} is ready.

Due Date: {{4}}

Download your invoice: {{5}}

Thank you for being part of Assorted Coworking!

Questions? Reply to this message.
```

**Footer (Optional):**
```
Assorted Coworking - D-12 Markaz, Islamabad
```

**Buttons (Optional):** 
- Add button: "View Invoice" → Dynamic URL: {{5}}

**Variables Explanation:**
- {{1}} = Member name
- {{2}} = Invoice number
- {{3}} = Amount
- {{4}} = Due date
- {{5}} = Invoice PDF link

3. Click **Submit for Approval**
4. Wait 24-48 hours for WhatsApp approval

---

### Template 2: Payment Reminder

**Template Name:** `payment_reminder`

**Category:** Utility

**Language:** English

**Body:**
```
Hi {{1}},

Friendly reminder: Invoice {{2}} (PKR {{3}}) is due on {{4}}.

Pay Now: {{5}}

Need help? Just reply.
```

---

### Template 3: Payment Confirmation

**Template Name:** `payment_received`

**Category:** Utility

**Language:** English

**Body:**
```
Hi {{1}},

Payment received! ✅

Invoice: {{2}}
Amount: PKR {{3}}
Date: {{4}}

Thank you for your payment!
```

---

## 🧪 Test WhatsApp Integration

### Test in Wati Dashboard

1. Go to **Broadcast → Quick Broadcast**
2. Select template: `invoice_notification`
3. Add test recipient (your number)
4. Fill variables:
   - Name: Test User
   - Invoice: INV-TEST
   - Amount: 25000
   - Due Date: Tomorrow
   - Link: https://example.com
5. Send test message
6. Check WhatsApp

### Test from Apps Script

1. Open Apps Script editor
2. Run this function:

```javascript
function testWhatsApp() {
  sendWhatsAppInvoice(
    '+923422221633',  // Your phone number
    'Test User',
    'INV-TEST',
    25000,
    '10 May 2026',
    'https://drive.google.com/file/d/test'
  );
}
```

3. Check WhatsApp for message

---

## 📊 Monitor Usage

### Check Message Quota

1. Wati Dashboard → **Analytics**
2. View: Messages sent this month
3. Free tier limit: 1,000/month
4. Upgrade if needed

### Track Delivery

1. **Broadcast → Broadcast History**
2. See delivery status
3. View read receipts
4. Check failed messages

---

## ⚠️ Important Notes

### WhatsApp Business Rules

1. **Templates Required:** All business messages must use approved templates
2. **24-Hour Window:** Can reply freely within 24 hours of user message
3. **No Spam:** Don't send unsolicited messages
4. **Opt-Out:** Users can block you

### Phone Number Format

Always use international format:
- ✅ Correct: `923422221633`
- ❌ Wrong: `03422221633`
- ❌ Wrong: `+92-342-2221633`

The script auto-formats numbers, but ensure form collects proper format.

---

## 🔧 Troubleshooting

### Template Not Sending?

**Check:**
- [ ] Template approved by WhatsApp?
- [ ] Template name matches exactly?
- [ ] All variables provided?
- [ ] Phone number in correct format?

**Solution:**
1. Go to Wati Templates
2. Check approval status
3. Resubmit if rejected
4. Wait for approval

### API Error?

**Check:**
- [ ] API key correct?
- [ ] API endpoint URL correct?
- [ ] Internet connection?
- [ ] Wati.io service status?

**Solution:**
1. Regenerate API token
2. Update in Apps Script
3. Test again

### Message Not Delivered?

**Check:**
- [ ] Recipient has WhatsApp?
- [ ] Number not blocked?
- [ ] Within quota limit?
- [ ] Template approved?

**Solution:**
1. Check Wati broadcast history
2. View delivery status
3. Check error messages

---

## 💰 Pricing (If You Exceed Free Tier)

### Wati.io Plans

**Free:**
- 1,000 messages/month
- Perfect for <30 members

**Starter ($49/month):**
- 5,000 messages/month
- Good for 30-100 members

**Growth ($99/month):**
- 15,000 messages/month
- Good for 100-300 members

**Scale ($199/month):**
- 50,000 messages/month
- Good for 300+ members

### Calculate Your Usage

**Per member per month:**
- 1 invoice notification
- 1-2 payment reminders (if needed)
- 1 payment confirmation

**Example:** 40 members = ~120 messages/month (well within free tier)

---

## 🎨 Customize Messages

### Add Emojis (Optional)

```
Hi {{1}},

📄 Your invoice {{2}} is ready!

💰 Amount: PKR {{3}}
📅 Due: {{4}}

👉 Download: {{5}}

Thank you! 🙏
```

### Add Branding

Include your tagline in footer:
```
Assorted Coworking
Your workspace deserves more than "making it work"
```

---

## 📱 Advanced Features

### Broadcasts

Send same message to multiple members:

1. **Broadcast → Create Broadcast**
2. Select template
3. Upload CSV with contacts + variables
4. Schedule or send now

### Chat Inbox

Reply to member queries:

1. **Inbox**
2. View conversations
3. Reply manually (within 24-hour window)

### Auto-Replies

Set up automated responses:

1. **Automation → Quick Replies**
2. Create response for common questions
3. Keywords trigger auto-reply

---

## ✅ Final Checklist

Before going live:

- [ ] Wati.io account created
- [ ] Phone number verified
- [ ] API credentials obtained
- [ ] Templates created and submitted
- [ ] Templates approved by WhatsApp
- [ ] Apps Script updated with API details
- [ ] Test message sent successfully
- [ ] Monitoring dashboard familiar

---

## 📞 Support

**Wati.io Support:**
- Help Center: https://help.wati.io
- Email: support@wati.io
- Live Chat: Available in dashboard

**WhatsApp Policy:**
- https://www.whatsapp.com/legal/business-policy

---

## 🚀 You're Ready!

Once templates are approved, WhatsApp automation is fully automatic:

1. New invoice generated → WhatsApp sent
2. Payment reminder → WhatsApp sent
3. Payment received → WhatsApp confirmation

**No manual intervention needed!**

---

**Setup by:** Ahsan Ilyas  
**Date:** _______________  
**Status:** ☐ Pending Approval ☐ Live ✅
