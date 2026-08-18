# Earnings Mechanism Specification — Laghubitta Khabar

## Vision: One-Stop Platform for Helping People & Getting Paid

Create a unified ecosystem where community members can help job seekers, clients with grievances, and fellow network members — and get compensated for verified good work.

---

## Core Earnings Model

### 1. **SENNA Helper Network** (Central Pay Mechanism)

| Role | Action | Compensation |
|------|--------|--------------|
| **SENNA Helper** | Successfully refer/placement a job seeker | Rs. 500-2000 (referral fee) |
| **SENNA Helper** | Verified successful grievance resolution | Rs. 1000-5000 (per case) |
| **SENNA Alumni** | Mentor 3+ job seekers to placement | Monthly stipend Rs. 5000 |
| **SENNA Alumni** | Donate/sell financial services | Commission 5-10% on referral |
| **Content Creator** | Article published & performs well | Rs. 500-2000 per article |
| **CV Writer** | Build CV for 10+ job seekers | Rs. 2000 flat + bonuses |
| **Reviewer** | Moderate confessions + content | Rs. 100 per day |

---

## Implementation Plan

### Phase 1: Referral & Placement Payment System

**File: `Code.gs`** - Add payment tracking functions:

```javascript
// NEW: Track helper earnings
function trackHelperEarnings_(helperMobile, form, referencedRow, amount) {
  const sheet = getOrCreateSheet_("HelperEarnings", 
    ["Timestamp","Helper Mobile","Action","Reference Row","Amount","Status"]);
  sheet.appendRow([new Date(), helperMobile, form, referencedRow, amount, "Pending"]);
  return sheet.getLastRow();
}

// NEW: Verify placement → release payment
function studioConfirmPlacement(token, jobRowId, helperMobile, notes) {
  if (!authOk_(token)) return {status: "error", message: "Unauthorized"};
  // Mark payment as "Released"
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("HelperEarnings") || 
                getOrCreateSheet_("HelperEarnings", headers);
  // ... payment verification logic
  return {status: "ok"};
}
```

**New Columns in SENNA Network:**
- `Alumni Status` (Member / Alumni / Verified Alumni)
- `Mentor Count` (number of people helped to placement)
- `Total Earned` (running total of referral fees)
- `Wallet Balance` (available for withdrawal)

### Phase 2: Grievance Resolution Payments

**NEW Sheet: `GrievanceResolution`**

| Timestamp | Resolver Name | Helped Person | Issue Type | Resolution | Payment Amount | Status |
|-----------|---------------|---------------|------------|------------|----------------|--------|
| | | | harassment / illegal interest / CIB | Yes / Partial / No | Rs. 1000-5000 | Pending/Released |

### Phase 3: Content Creator Compensation

**NEW Sheet: `ContentPayments`**

| Timestamp | Artist | Article ID | Views | Engagement | Payment | Status |
|-----------|--------|------------|-------|------------|---------|--------|
| | | | | | Rs. 500-2000 | Pending/Paid |

### Phase 4: Google Wallet Integration (for now - manual processing)

Since direct payment gateways require complex integration, use **Google Forms + Bank Transfer**:

1. Admin dashboard shows "Pending Payments" list
2. Click "Payout" → generates bank transfer instruction PDF
3. Records marked "Paid" with date + transaction ID

---

## UI Changes Required

### In `src/portal.html` / `studio.html`:

1. **New "Earn" Tab** in Studio:
   - Pending payments list
   - Payment history
   - Withdrawal request form

2. **Referral Tracking**:
   - On Job form: "Referred by mobile number" field
   - Auto-match to SENNA member → track earnings

3. **Payment Status Display**:
   - In Records view: show payment status per row
   - "Mark as Placed" button → triggers payment flow

4. **Alumni Dashboard**:
   - Badge: "Verified Alumni - Earn Rs. 5000/mo as Mentor"
   - List of mentees
   - Mentee placement tracking

---

## Revenue Sources for Payments

1. **MFI Partnership Fee:** 5% of successful placements goes to platform
2. **Donation Pool:** Community members can contribute to helper pool
3. **SENNA Membership:** Rs. 100 one-time membership fee (optional)
4. **Service Commission:** Helpers selling financial services → 10% commission

---

## Dashboard Wireframe

```
╔══════════════════════════════════════════════════════════╗
║  STUDIO - EARN DASHBOARD                                 ║
╠══════════════════════════════════════════════════════════╣
║  Today's Pending Payments: Rs. 45,000                    ║
║  Your Balance: Rs. 12,500                                  ║
║                                                          ║
║  ┌─────────────────────────────────────────────────────┐ ║
║  │ YOUR TRANSACTIONS                                   │ ║
║  │                                                     │ ║
║  │ 2026-08-17  Placement - Rajesh Kumar       Rs.500    │ ║
║ 2026-08-16  Referral    - Sunita Devi         Rs.1000   │ ║
║ 2026-08-15  Grievance   - Mrs. Shakya         Rs.2000   │ ║
║  ├─────────────────────────────────────────────────────┤ ║
║  │ TOTAL EARNED: Rs. 50,000                              │ ║
║  │ WITHDRAWN: Rs. 38,500                                 │ ║
║  └─────────────────────────────────────────────────────┘ ║
║                                                          ║
║  [Request Withdrawal]  [Download Statement (CSV)]        ║
╚══════════════════════════════════════════════════════════╝
```

---

## Technical Changes Summary

| Component | File | Change |
|-----------|------|--------|
| Backend functions | `Code.gs` | Add `trackHelperEarnings_`, `studioConfirmPlacement`, `studioWithdraw` |
| Admin dashboard | `studio.html` | New "Earn" tab with transaction list |
| Jobs form | `src/portal.html` | Add "Referred by" mobile field |
| SENNA sheet | Google Sheets | Add `Alumni Status`, `Total Earned`, `Wallet Balance` |
| New sheets | Apps Script | Create `HelperEarnings`, `GrievanceResolution`, `ContentPayments` |

---

## Success Metrics

- **30%** of SENNA members become verified Alumni/helpers
- **500+** placements tracked with referral payments
- **Rs. 500,000+** in helper compensation per month
- **10,000+** users helped through the platform
- **Community-driven** earnings cycle: helped people → Alumni → help more → get paid

---

## Next Immediate Action

1. Clone/update branch: `feature/earnings-system`
2. Add new columns to SENNA and JobCareer sheets
3. Implement `trackHelperEarnings_()` and `studioConfirmPlacement()` functions
4. Update studio.html with "Earn" tab
5. Run `node build.js` and redeploy
6. Test with 5 volunteers before full rollout

---

**Contact:** Platform admin can manage payments via Studio → Earn → Pending Payments