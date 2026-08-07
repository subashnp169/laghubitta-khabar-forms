/**
 * Laghubitta Khabar — Forms Portal Backend
 * Handles: Job Career Sathi, Client Help, SENNA Network membership, Confession
 *
 * Deploy as: Extensions > Apps Script (inside a Google Sheet) > Deploy > Web App
 *   - Execute as: Me
 *   - Who has access: Anyone
 * Copy the Web App URL into SCRIPT_URL in index.html
 *
 * Set admin password: open the Sheet > Setup menu > "Set Admin Password"
 */

const SHEETS = {
  job: { name: "JobCareer", headers: ["Timestamp","Full Name","Mobile","Email","Academic Qualification","Experience","Current Status","Home District","Preferred Province","Preferred City","Desired Sector","Help Needed","Notes","Placement Status","Placed Date","Mentor/Referrer"] },
  help: { name: "ClientHelp", headers: ["Timestamp","Name","Mobile","Home District","Institution Name","Institution Type","Issue Type","Issue Description","Preferred Contact Time","Contact Method"] },
  senna: { name: "SennaNetwork", headers: ["Timestamp","Full Name","Mobile","Email","Home District","Category","Institution","Profession","Contribution","Reason","Consent","Member Type"] },
  confession: { name: "Confessions", headers: ["Timestamp","Category","Confession","Nickname","District","Status","Published"] },
  articles: { name: "Articles", headers: ["Timestamp","Title","Labels","Status","Source Link","Body HTML","Blogger URL","Facebook URL"] }
};

const SALT = "lk-senna-network-2026";

const GEMINI_MODEL = "gemini-2.5-flash";

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const form = data.form || "";

    if (data.action === "import") return importRows_(data);
    if (data.action === "setConfession") return setConfessionHttp_(data);
    if (data.action === "publishBlogger") return publishBloggerHttp_(data);
    if (data.action === "publishFacebook") return publishFacebookHttp_(data);
    if (form === "job") return submitRow_("job", data);
    if (form === "help") return submitRow_("help", data);
    if (form === "senna") return submitRow_("senna", data);
    if (form === "confession") return submitRow_("confession", data);

    return error_("Unknown form type: " + form);
  } catch (err) {
    return error_(err.message);
  }
}

function doGet(e) {
  const action = e.parameter.action;

  // No action -> serve the Admin Studio UI (must NOT require auth to load the login screen)
  if (!action) {
    return HtmlService.createHtmlOutputFromFile('Index')
      .setTitle('Laghubitta Khabar — Admin Studio')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  }

  if (action === "login") {
    const stored = getAdminPass_();
    const pass = e.parameter.pass || "";
    if (stored && pass === stored) return json_({ status: "ok", token: makeToken_(stored) });
    return error_("Invalid password");
  }

  const token = e.parameter.token || "";
  if (!getAdminPass_() || token !== makeToken_(getAdminPass_())) return error_("Unauthorized");

  if (action === "stats") return json_(getStats_());
  if (action === "records") {
    const cfg = SHEETS[e.parameter.form];
    if (!cfg) return error_("Unknown form");
    const limit = parseInt(e.parameter.limit || "500", 10);
    return json_({ total: countRows_(cfg.name), rows: getSheetData_(cfg.name, limit, cfg.headers.length) });
  }
  if (action === "export") {
    const cfg = SHEETS[e.parameter.form];
    if (!cfg) return error_("Unknown form");
    return ContentService.createTextOutput(toCsv_(cfg.name, cfg.headers))
      .setMimeType(ContentService.MimeType.TEXT);
  }
  if (action === "confessions") {
    return json_(getConfessions_(e.parameter.status || "All"));
  }

  return error_("Unknown action");
}

function submitRow_(form, data) {
  const cfg = SHEETS[form];
  const sheet = getOrCreateSheet_(cfg.name, cfg.headers);

  const timestamp = new Date(data.timestamp || new Date());

  if (form === "job") {
    sheet.appendRow([
      timestamp, data.fullName, data.mobile, data.email,
      data.academic, data.experience, data.status, data.district,
      data.province, data.city, data.sector, data.helpNeeded, data.notes,
      "New", "", ""
    ]);
  } else if (form === "help") {
    sheet.appendRow([
      timestamp, data.name, data.mobile, data.district, data.institution,
      data.institutionType, data.issueType, data.issue,
      data.contactTime, data.contactMethod
    ]);
  } else if (form === "senna") {
    sheet.appendRow([
      timestamp, data.fullName, data.mobile, data.email, data.district,
      data.category || "Microfinance", data.institution, data.profession,
      data.contribution, data.reason, data.consent, "Member"
    ]);
  } else if (form === "confession") {
    ensureConfessionColumns_();
    sheet.appendRow([
      timestamp, data.category, data.text, data.nickname, data.district, "Pending", ""
    ]);
  }

  return json_({ status: "ok", form: form });
}

function importRows_(data) {
  const token = data.token || "";
  if (token !== makeToken_(getAdminPass_())) return error_("Unauthorized");

  const cfg = SHEETS[data.form];
  if (!cfg) return error_("Unknown form");
  if (!data.rows || !data.rows.length) return json_({ status: "ok", inserted: 0 });

  const inserted = appendRows_(cfg, data.rows);
  return json_({ status: "ok", inserted: inserted, form: data.form });
}

function appendRows_(cfg, rows) {
  const sheet = getOrCreateSheet_(cfg.name, cfg.headers);
  const timestamp = new Date();
  const values = rows.map(function (r) {
    return [timestamp].concat(r);
  });
  const start = sheet.getLastRow() + 1;
  sheet.getRange(start, 1, values.length, values[0].length).setValues(values);
  if (cfg.name === SHEETS.senna.name) {
    const mt = headerIndex_(sheet, "Member Type");
    if (mt >= 0) sheet.getRange(start, mt + 1, values.length, 1).setValue("Member");
  }
  return values.length;
}

function getStats_() {
  const stats = {};
  Object.keys(SHEETS).forEach(function (k) { stats[k] = countRows_(SHEETS[k].name); });
  return stats;
}

function countRows_(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(name);
  if (!sheet) return 0;
  const rows = sheet.getLastRow();
  return rows > 1 ? rows - 1 : 0;
}

function getOrCreateSheet_(name, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
    sheet.setColumnWidth(1, 160);
  }
  return sheet;
}

function headerIndex_(sheet, name) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  for (let j = 0; j < headers.length; j++) {
    if (String(headers[j]) === name) return j;
  }
  return -1;
}

function ensureJobLifecycle_() {
  const sheet = ensureSheetColumns_(SHEETS.job);
  const pIdx = headerIndex_(sheet, "Placement Status");
  if (pIdx < 0) return sheet;
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return sheet;
  const col = sheet.getRange(2, pIdx + 1, lastRow - 1, 1).getValues();
  const blanks = [];
  for (let i = 0; i < col.length; i++) {
    if (String(col[i][0] || "").trim() === "") blanks.push(i + 2);
  }
  if (blanks.length) sheet.getRange(blanks[0], pIdx + 1, blanks.length, 1).setValue("New");
  return sheet;
}

function ensureSennaMemberType_() {
  const sheet = ensureSheetColumns_(SHEETS.senna);
  const mt = headerIndex_(sheet, "Member Type");
  if (mt < 0) return sheet;
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return sheet;
  const col = sheet.getRange(2, mt + 1, lastRow - 1, 1).getValues();
  const blanks = [];
  for (let i = 0; i < col.length; i++) {
    if (String(col[i][0] || "").trim() === "") blanks.push(i + 2);
  }
  if (blanks.length) sheet.getRange(blanks[0], mt + 1, blanks.length, 1).setValue("Member");
  return sheet;
}

function getSheetData_(name, limit, numCols) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(name);
  if (!sheet) return [];
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];
  const cols = Math.max(1, Math.min(numCols || sheet.getLastColumn(), sheet.getLastColumn()));
  const headers = sheet.getRange(1, 1, 1, cols).getValues()[0];
  const max = lastRow - 1;
  const want = Math.min(limit || 500, max);
  let out = collectRows_(sheet, lastRow - want + 1, want, cols, headers);
  if (!out.length && max > want) {
    out = collectRows_(sheet, 2, Math.min(limit || 500, max), cols, headers);
  }
  return out;
}

function collectRows_(sheet, start, count, cols, headers) {
  const values = sheet.getRange(start, 1, count, cols).getValues();
  const out = [];
  for (let i = count - 1; i >= 0; i--) {
    const row = values[i];
    let hasAny = false;
    for (let j = 0; j < row.length; j++) {
      const v = row[j];
      if (v !== "" && v != null) { hasAny = true; break; }
    }
    if (!hasAny) continue;
    const obj = { _row: start + i };
    headers.forEach(function (h, j) { obj[h] = row[j]; });
    out.push(obj);
  }
  return out;
}

function toCsv_(name, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(name);
  const lines = [headers.join(",")];
  if (sheet) {
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      lines.push(data[i].map(csvCell_).join(","));
    }
  }
  return lines.join("\r\n");
}

function csvCell_(v) {
  if (v instanceof Date) v = Utilities.formatDate(v, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm");
  const s = String(v == null ? "" : v);
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function makeToken_(pass) {
  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256, pass + SALT, Utilities.Charset.UTF_8);
  return bytes.map(function (b) {
    const h = (b < 0 ? b + 256 : b).toString(16);
    return h.length === 1 ? "0" + h : h;
  }).join("");
}

function getAdminPass_() {
  return PropertiesService.getScriptProperties().getProperty("ADMIN_PASSWORD") || "";
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("Setup")
    .addItem("Set Admin Password", "setAdminPasswordUi")
    .addToUi();
}

function setAdminPasswordUi() {
  const ui = SpreadsheetApp.getUi();
  const res = ui.prompt(
    "Admin Password",
    "Enter the admin password used to view/export records:",
    ui.ButtonSet.OK_CANCEL
  );
  if (res.getSelectedButton() === ui.Button.OK && res.getResponseText()) {
    PropertiesService.getScriptProperties().setProperty("ADMIN_PASSWORD", res.getResponseText());
    ui.alert("Admin password saved.");
  }
}

// ── ADMIN STUDIO (HtmlService) FUNCTIONS ─────────────────────────
// Called from Index.html via google.script.run. All data calls require a token.

function studioLogin(pass) {
  const stored = getAdminPass_();
  if (stored && pass === stored) return { status: "ok", token: makeToken_(stored) };
  return { status: "error", message: "Invalid admin password." };
}

function authOk_(token) {
  return !!getAdminPass_() && !!token && token === makeToken_(getAdminPass_());
}

function studioStats(token) {
  if (!authOk_(token)) return { status: "error", message: "Unauthorized" };
  try {
    return { status: "ok", stats: getStats_() };
  } catch (err) {
    return { status: "error", message: err.message };
  }
}

function studioRecords(token, form, limit) {
  if (!authOk_(token)) return { status: "error", message: "Unauthorized" };
  const cfg = SHEETS[form];
  if (!cfg) return { status: "error", message: "Unknown form" };
  try {
    return { status: "ok", total: countRows_(cfg.name), rows: getSheetData_(cfg.name, limit || 500, cfg.headers.length) };
  } catch (err) {
    return { status: "error", message: "Record load failed: " + err.message };
  }
}

function studioPromoteToSenna(token, form, rowId) {
  if (!authOk_(token)) return { status: "error", message: "Unauthorized" };
  const src = SHEETS[form];
  if (!src || (form !== "job" && form !== "help")) {
    return { status: "error", message: "Promotion is only available from Job Career Sathi and Client Help records." };
  }
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const srcSheet = ss.getSheetByName(src.name);
    if (!srcSheet) throw new Error("Source sheet not found");
    const row = Number(rowId);
    if (!row || row < 2 || row > srcSheet.getLastRow()) throw new Error("Invalid record row");

    const values = srcSheet.getRange(row, 1, 1, src.headers.length).getValues()[0];
    const cell = function (j) { return String(values[j] == null ? "" : values[j]).trim(); };

    let name = cell(1), mobile = cell(2), email = "", district = "", institution = "";
    let category = "Microfinance", profession = "", contribution = "", reason = "";

    if (form === "job") {
      email = cell(3);
      district = cell(7);
      profession = "Job Seeker";
      reason = cell(11) ? "Help Needed: " + cell(11) : "Job Career Sathi";
    } else {
      district = cell(3);
      institution = cell(4);
      profession = cell(5) ? cell(5) : "Client";
      reason = cell(6) ? "Issue: " + cell(6) : "Client Help";
    }
    if (!name) throw new Error("Record has no name to promote.");

    const dup = findExistingSenna_(mobile, email);
    if (dup) return { status: "error", message: "Already in SENNA Network (sheet row " + dup + ")." };

    const sennaSheet = getOrCreateSheet_(SHEETS.senna.name, SHEETS.senna.headers);
    sennaSheet.appendRow([new Date(), name, mobile, email, district, category, institution, profession, contribution, reason, "Yes", "Member"]);
    return { status: "ok", message: "Promoted " + name + " into SENNA Network.", sennaRow: sennaSheet.getLastRow() };
  } catch (err) {
    return { status: "error", message: "Promotion failed: " + err.message };
  }
}

function findExistingSenna_(mobile, email) {
  const sheet = getOrCreateSheet_(SHEETS.senna.name, SHEETS.senna.headers);
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return null;
  const mobiles = sheet.getRange(2, 3, lastRow - 1, 1).getValues();
  const emails = sheet.getRange(2, 4, lastRow - 1, 1).getValues();
  const m = String(mobile || "").trim().toLowerCase();
  const e = String(email || "").trim().toLowerCase();
  for (let i = 0; i < lastRow - 1; i++) {
    const rm = String(mobiles[i][0] == null ? "" : mobiles[i][0]).trim().toLowerCase();
    const re = String(emails[i][0] == null ? "" : emails[i][0]).trim().toLowerCase();
    if (m && rm && rm === m) return i + 2;
    if (e && re && re === e) return i + 2;
  }
  return null;
}

// Build a professional CV for a Job or SENNA record as a Google Doc in the Drive folder.
function studioGenCV(token, form, rowId) {
  if (!authOk_(token)) return { status: "error", message: "Unauthorized" };
  const cfg = SHEETS[form];
  if (!cfg || (form !== "job" && form !== "senna")) {
    return { status: "error", message: "CV generation is only available for Job Career Sathi and SENNA Network records." };
  }
  try {
    const folderId = PropertiesService.getScriptProperties().getProperty("FOLDER_ID") || "";
    if (!folderId) throw new Error("Drive folder is not set (Studio > Settings > Folder ID).");

    const sheet = getOrCreateSheet_(cfg.name, cfg.headers);
    const row = Number(rowId);
    if (!row || row < 2 || row > sheet.getLastRow()) throw new Error("Invalid record row");
    const vals = sheet.getRange(row, 1, 1, cfg.headers.length).getValues()[0];
    const cell = function (h) {
      const j = headerIndex_(sheet, h);
      return j >= 0 ? String(vals[j] == null ? "" : vals[j]).trim() : "";
    };

    const name = cell("Full Name") || cell("Name");
    if (!name) throw new Error("Record has no name for a CV.");

    const doc = DocumentApp.create("CV - " + name);
    const b = doc.getBody();

    b.appendParagraph(name).setHeading(DocumentApp.ParagraphHeading.TITLE);
    const contact = [cell("Mobile"), cell("Email"), cell("Home District")]
      .filter(Boolean).join("  |  ");
    if (contact) b.appendParagraph(contact).setFontSize(10).setForegroundColor("#666666");

    if (form === "job") {
      addCvSection_(b, "Career Objective", cell("Help Needed") || "Seeking a position in the microfinance / banking / financial sector with a strong commitment to service and inclusion.");
      addCvSection_(b, "Education", cell("Academic Qualification"));
      addCvSection_(b, "Experience", cell("Experience") || "Fresher");
      addCvSection_(b, "Current Status", cell("Current Status"));
      addCvSection_(b, "Desired Sector", cell("Desired Sector"));
      addCvSection_(b, "Preferred Location", [cell("Preferred Province"), cell("Preferred City")].filter(Boolean).join(", "));
      if (cell("Notes")) addCvSection_(b, "Additional Notes", cell("Notes"));
    } else {
      addCvSection_(b, "Profile", form === "senna" ? cell("Profession") : "");
      addCvSection_(b, "Category", cell("Category"));
      addCvSection_(b, "Institution", cell("Institution") || cell("Institution Name"));
      addCvSection_(b, "Contribution", cell("Contribution"));
      addCvSection_(b, "Why SENNA", cell("Reason"));
    }
    addCvSection_(b, "References", "Available on request.");

    const folder = DriveApp.getFolderById(folderId);
    const file = DriveApp.getFileById(doc.getId());
    folder.addFile(file);
    DriveApp.getRootFolder().removeFile(file);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    return { status: "ok", message: "CV created for " + name + ".", url: file.getUrl() };
  } catch (err) {
    return { status: "error", message: "CV generation failed: " + err.message };
  }
}

function addCvSection_(body, title, text) {
  if (!String(text || "").trim()) return;
  body.appendParagraph(title).setHeading(DocumentApp.ParagraphHeading.HEADING_2);
  body.appendParagraph(String(text || ""));
}

// Update the placement lifecycle of a Job record; marking "Placed" also flags the
// matching SENNA member as Alumni (pay-it-forward: helped people help others).
function studioSetPlacement(token, rowId, status, mentor) {
  if (!authOk_(token)) return { status: "error", message: "Unauthorized" };
  try {
    const sheet = ensureJobLifecycle_();
    const row = Number(rowId);
    if (!row || row < 2 || row > sheet.getLastRow()) throw new Error("Invalid record row");

    const pIdx = headerIndex_(sheet, "Placement Status");
    const dIdx = headerIndex_(sheet, "Placed Date");
    const mIdx = headerIndex_(sheet, "Mentor/Referrer");
    if (pIdx < 0) throw new Error("Placement Status column missing.");

    const newStatus = String(status || "New").trim();
    const placed = /^placed$/i.test(newStatus);
    const sheetRef = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.job.name);
    const rowVals = sheetRef.getRange(row, 1, 1, sheetRef.getLastColumn()).getValues()[0];
    const mobile = String(rowVals[2] == null ? "" : rowVals[2]).trim();
    const email = String(rowVals[3] == null ? "" : rowVals[3]).trim();

    if (pIdx >= 0) sheetRef.getRange(row, pIdx + 1).setValue(newStatus);
    if (dIdx >= 0) sheetRef.getRange(row, dIdx + 1).setValue(placed ? new Date() : "");
    if (mIdx >= 0) sheetRef.getRange(row, mIdx + 1).setValue(String(mentor || ""));

    let note = "Placement updated: " + newStatus + ".";
    if (placed) {
      const ssheet = ensureSennaMemberType_();
      const sennaRow = findExistingSenna_(mobile, email);
      if (sennaRow) {
        const mt = headerIndex_(ssheet, "Member Type");
        if (mt >= 0) ssheet.getRange(sennaRow, mt + 1).setValue("Alumni");
        note += " Marked as SENNA Alumni (row " + sennaRow + ").";
      } else {
        note += " (Not found in SENNA Network, so not marked Alumni.)";
      }
    }
    return { status: "ok", message: note };
  } catch (err) {
    return { status: "error", message: "Placement update failed: " + err.message };
  }
}

function studioExport(token, form) {
  if (!authOk_(token)) return { status: "error", message: "Unauthorized" };
  const cfg = SHEETS[form];
  if (!cfg) return { status: "error", message: "Unknown form" };
  return { status: "ok", csv: toCsv_(cfg.name, cfg.headers) };
}

function studioImport(token, form, rows) {
  if (!authOk_(token)) return { status: "error", message: "Unauthorized" };
  const cfg = SHEETS[form];
  if (!cfg) return { status: "error", message: "Unknown form" };
  if (!rows || !rows.length) return { status: "ok", inserted: 0 };
  return { status: "ok", inserted: appendRows_(cfg, rows), form: form };
}

function studioGetSettings(token) {
  if (!authOk_(token)) return { status: "error", message: "Unauthorized" };
  return { status: "ok", settings: getSettingsMasked_() };
}

function studioSaveSettings(token, s) {
  if (!authOk_(token)) return { status: "error", message: "Unauthorized" };
  const p = PropertiesService.getScriptProperties();
  if (s.blogId !== undefined) p.setProperty("BLOG_ID", (s.blogId || "").trim());
  if (s.fbPageId !== undefined) p.setProperty("FB_PAGE_ID", (s.fbPageId || "").trim());
  if (s.fbToken !== undefined) p.setProperty("FB_TOKEN", (s.fbToken || "").trim());
  if (s.bloggerToken !== undefined) p.setProperty("BLOGGER_TOKEN", (s.bloggerToken || "").trim());
  if (s.bloggerRefresh !== undefined) p.setProperty("BLOGGER_REFRESH_TOKEN", (s.bloggerRefresh || "").trim());
  if (s.bloggerClientId !== undefined) p.setProperty("BLOGGER_CLIENT_ID", (s.bloggerClientId || "").trim());
  if (s.bloggerClientSecret !== undefined) p.setProperty("BLOGGER_CLIENT_SECRET", (s.bloggerClientSecret || "").trim());
  if (s.geminiKey !== undefined) p.setProperty("GEMINI_API_KEY", (s.geminiKey || "").trim());
  if (s.geminiModel !== undefined) p.setProperty("GEMINI_MODEL", (s.geminiModel || "").trim());
  if (s.folderId !== undefined) p.setProperty("FOLDER_ID", (s.folderId || "").trim());
  return { status: "ok", message: "Settings saved." };
}

function getSettingsMasked_() {
  const p = PropertiesService.getScriptProperties();
  const mask = function (v) { return v ? v.substring(0, 6) + "••••••••" : ""; };
  return {
    blogId: p.getProperty("BLOG_ID") || "",
    fbPageId: p.getProperty("FB_PAGE_ID") || "",
    fbToken: mask(p.getProperty("FB_TOKEN")),
    bloggerToken: mask(p.getProperty("BLOGGER_TOKEN")),
    bloggerRefresh: mask(p.getProperty("BLOGGER_REFRESH_TOKEN")),
    bloggerClientId: p.getProperty("BLOGGER_CLIENT_ID") || "",
    bloggerClientSecret: mask(p.getProperty("BLOGGER_CLIENT_SECRET")),
    geminiKey: mask(p.getProperty("GEMINI_API_KEY")),
    geminiModel: p.getProperty("GEMINI_MODEL") || "",
    folderId: p.getProperty("FOLDER_ID") || ""
  };
}

// ── STEP 2: CONFESSIONS QUEUE + PUBLISHING ──────────────────────
// Status flow: Pending -> Approved/Rejected; Publishing sets "Published".

function ensureConfessionColumns_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.confession.name);
  if (!sheet) return;
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  const firstCell = String(sheet.getRange(1, 1).getValue() || "");
  if (!firstCell && lastRow <= 1) {
    sheet.getRange(1, 1, 1, SHEETS.confession.headers.length).setValues([SHEETS.confession.headers]);
    sheet.getRange(1, 1, 1, SHEETS.confession.headers.length).setFontWeight("bold");
    return;
  }
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const full = SHEETS.confession.headers;
  if (headers.length < full.length) {
    const add = full.slice(headers.length);
    sheet.getRange(1, headers.length + 1, 1, add.length).setValues([add]);
    if (lastRow > 1) {
      sheet.getRange(2, headers.length + 1, lastRow - 1, add.length).setValue("Pending");
    }
  }
}

function confessionSheet_() {
  ensureConfessionColumns_();
  return getOrCreateSheet_(SHEETS.confession.name, SHEETS.confession.headers);
}

function getConfessions_(statusFilter) {
  const sheet = confessionSheet_();
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  const idx = {};
  data[0].forEach(function (h, j) { idx[h] = j; });
  const out = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const status = idx["Status"] != null ? String(row[idx["Status"]] || "Pending") : "Pending";
    if (statusFilter && statusFilter !== "All" && status !== statusFilter) continue;
    out.push({
      id: i - 1,
      timestamp: fmtDate_(row[idx["Timestamp"]]),
      category: String(row[idx["Category"]] || ""),
      confession: String(row[idx["Confession"]] || ""),
      nickname: String(row[idx["Nickname"]] || ""),
      district: String(row[idx["District"]] || ""),
      status: status,
      published: idx["Published"] != null ? String(row[idx["Published"]] || "") : ""
    });
  }
  return out.reverse();
}

function getConfessionRow_(id) {
  const sheet = confessionSheet_();
  const row = Number(id) + 2;
  if (row > sheet.getLastRow()) throw new Error("Confession not found");
  return sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];
}

function setConfessionStatus_(id, status) {
  const sheet = confessionSheet_();
  const row = Number(id) + 2;
  if (row > sheet.getLastRow()) throw new Error("Confession not found");
  const idx = {};
  sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
    .forEach(function (h, j) { idx[h] = j; });
  sheet.getRange(row, idx["Status"] + 1).setValue(status);
}

function markConfessionPublished_(id, note) {
  const sheet = confessionSheet_();
  const row = Number(id) + 2;
  const idx = {};
  sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
    .forEach(function (h, j) { idx[h] = j; });
  const prev = sheet.getRange(row, idx["Published"] + 1).getValue() || "";
  const combined = prev ? prev + " | " + note : note;
  sheet.getRange(row, idx["Status"] + 1, 1, 2).setValues([["Published", combined]]);
}

function postToBlogger_(title, body, labels, sourceLink) {
  const p = PropertiesService.getScriptProperties();
  const blogId = p.getProperty("BLOG_ID") || "";
  if (!blogId) throw new Error("Blogger Blog ID is not set (Studio > Settings)");
  if (!title) throw new Error("Title is required");
  const token = getBloggerToken_();
  if (!token) throw new Error("Blogger access token is not set (Studio > Settings)");

  let content = String(body || "");
  if (sourceLink && content.indexOf(sourceLink) === -1) {
    content += '<p style="font-size:12px;color:#666"><i>Source: <a href="' + sourceLink + '" target="_blank" rel="noopener">' + sourceLink + '</a></i></p>';
  }
  const post = { title: title, content: content, published: new Date().toISOString() };
  if (labels && labels.length) post.labels = labels;

  const res = UrlFetchApp.fetch(
    "https://www.googleapis.com/blogger/v3/blogs/" + encodeURIComponent(blogId) + "/posts/",
    {
      method: "post",
      contentType: "application/json",
      headers: { Authorization: "Bearer " + token },
      payload: JSON.stringify(post),
      muteHttpExceptions: true
    }
  );
  const code = res.getResponseCode();
  const txt = res.getContentText();
  if (code === 401) {
    p.deleteProperty("BLOGGER_TOKEN");
    throw new Error("Blogger token expired. Click Publish again to refresh, or set a new token in Settings.");
  }
  if (code !== 200) throw new Error("Blogger error " + code + ": " + txt);
  return JSON.parse(txt).url;
}

function publishBlogger_(id, title, body) {
  return postToBlogger_(title, body, [], null);
}

function getBloggerToken_() {
  const p = PropertiesService.getScriptProperties();
  const token = p.getProperty("BLOGGER_TOKEN") || "";
  if (token) return token;
  const refresh = p.getProperty("BLOGGER_REFRESH_TOKEN") || "";
  const cid = p.getProperty("BLOGGER_CLIENT_ID") || "";
  const csec = p.getProperty("BLOGGER_CLIENT_SECRET") || "";
  if (refresh && cid && csec) {
    const res = UrlFetchApp.fetch("https://oauth2.googleapis.com/token", {
      method: "post",
      payload: {
        refresh_token: refresh,
        client_id: cid,
        client_secret: csec,
        grant_type: "refresh_token"
      },
      muteHttpExceptions: true
    });
    const j = JSON.parse(res.getContentText());
    if (j.access_token) {
      p.setProperty("BLOGGER_TOKEN", j.access_token);
      return j.access_token;
    }
  }
  return token;
}

function postToFacebook_(message, link) {
  const p = PropertiesService.getScriptProperties();
  const pageId = p.getProperty("FB_PAGE_ID") || "";
  const token = p.getProperty("FB_TOKEN") || "";
  if (!pageId) throw new Error("Facebook Page ID is not set (Studio > Settings)");
  if (!token) throw new Error("Facebook Page Access Token is not set (Studio > Settings)");
  if (!message) throw new Error("Message is required");

  const payload = { message: message, access_token: token };
  if (link) payload.link = link;

  const res = UrlFetchApp.fetch(
    "https://graph.facebook.com/v20.0/" + encodeURIComponent(pageId) + "/feed",
    {
      method: "post",
      payload: payload,
      muteHttpExceptions: true
    }
  );
  const code = res.getResponseCode();
  const txt = res.getContentText();
  if (code !== 200) throw new Error("Facebook error " + code + ": " + txt);
  return "https://www.facebook.com/" + pageId + "/posts/" + JSON.parse(txt).id;
}

function publishFacebook_(id, message) {
  return postToFacebook_(message, null);
}

function fmtDate_(v) {
  if (v instanceof Date) {
    return Utilities.formatDate(v, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm");
  }
  return String(v || "");
}

// HTTP endpoints (doPost) for parity with the portal admin + external tools.
function setConfessionHttp_(data) {
  const token = data.token || "";
  if (token !== makeToken_(getAdminPass_())) return error_("Unauthorized");
  try {
    setConfessionStatus_(data.id, data.status);
    return json_({ status: "ok", id: data.id, status: data.status });
  } catch (err) {
    return error_(err.message);
  }
}

function publishBloggerHttp_(data) {
  const token = data.token || "";
  if (token !== makeToken_(getAdminPass_())) return error_("Unauthorized");
  try {
    const url = publishBlogger_(data.id, data.title, data.body);
    markConfessionPublished_(data.id, "Blogger: " + url);
    return json_({ status: "ok", id: data.id, url: url });
  } catch (err) {
    return error_(err.message);
  }
}

function publishFacebookHttp_(data) {
  const token = data.token || "";
  if (token !== makeToken_(getAdminPass_())) return error_("Unauthorized");
  try {
    const url = publishFacebook_(data.id, data.message);
    markConfessionPublished_(data.id, "Facebook: " + url);
    return json_({ status: "ok", id: data.id, url: url });
  } catch (err) {
    return error_(err.message);
  }
}

// Studio (google.script.run) versions.
function studioConfessions(token, status) {
  if (!authOk_(token)) return { status: "error", message: "Unauthorized" };
  return { status: "ok", rows: getConfessions_(status || "All") };
}

function studioSetConfession(token, id, status) {
  if (!authOk_(token)) return { status: "error", message: "Unauthorized" };
  try {
    setConfessionStatus_(id, status);
    return { status: "ok" };
  } catch (err) {
    return { status: "error", message: err.message };
  }
}

function studioPublishBlogger(token, id, title, body) {
  if (!authOk_(token)) return { status: "error", message: "Unauthorized" };
  try {
    const url = publishBlogger_(id, title, body);
    markConfessionPublished_(id, "Blogger: " + url);
    return { status: "ok", url: url };
  } catch (err) {
    return { status: "error", message: err.message };
  }
}

function studioPublishFacebook(token, id, message) {
  if (!authOk_(token)) return { status: "error", message: "Unauthorized" };
  try {
    const url = publishFacebook_(id, message);
    markConfessionPublished_(id, "Facebook: " + url);
    return { status: "ok", url: url };
  } catch (err) {
    return { status: "error", message: err.message };
  }
}

// ── STEP 3: CONTENT STUDIO (Gemini AI articles) ─────────────────
// Articles sheet holds drafts + published articles. Publishing is always manual.

function ensureSheetColumns_(cfg) {
  const sheet = getOrCreateSheet_(cfg.name, cfg.headers);
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  const firstCell = String(sheet.getRange(1, 1).getValue() || "");
  if (!firstCell && lastRow <= 1) {
    sheet.getRange(1, 1, 1, cfg.headers.length).setValues([cfg.headers]);
    sheet.getRange(1, 1, 1, cfg.headers.length).setFontWeight("bold");
    return sheet;
  }
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  if (headers.length < cfg.headers.length) {
    const add = cfg.headers.slice(headers.length);
    sheet.getRange(1, headers.length + 1, 1, add.length).setValues([add]);
  }
  return sheet;
}

function articleSheet_() {
  return ensureSheetColumns_(SHEETS.articles);
}

function fetchGemini_(prompt) {
  const p = PropertiesService.getScriptProperties();
  const key = p.getProperty("GEMINI_API_KEY") || "";
  if (!key) throw new Error("GEMINI_API_KEY is not set (Studio > Settings)");
  const model = p.getProperty("GEMINI_MODEL") || GEMINI_MODEL;
  const res = UrlFetchApp.fetch(
    "https://generativelanguage.googleapis.com/v1beta/" + model + ":generateContent",
    {
      method: "post",
      contentType: "application/json",
      headers: { "x-goog-api-key": key },
      payload: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 2048 }
      }),
      muteHttpExceptions: true
    }
  );
  const code = res.getResponseCode();
  const txt = res.getContentText();
  if (code !== 200) {
    let msg = txt;
    try { msg = JSON.parse(txt).error.message || txt; } catch (err) {}
    throw new Error("Gemini error " + code + ": " + msg);
  }
  const j = JSON.parse(txt);
  const parts = (j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts) || [];
  const text = parts.map(function (pt) { return pt.text || ""; }).join("");
  if (!text.trim()) throw new Error("Gemini returned an empty draft.");
  return text;
}

function buildArticlePrompt_(opts) {
  const topic = String(opts.topic || "").trim();
  if (!topic) throw new Error("Topic is required");
  const lang = String(opts.language || "Nepali").trim();
  const type = String(opts.type || "Article").trim();
  const words = Number(opts.words || 400);
  const keywords = String(opts.keywords || "").trim();
  return [
    "You are the editorial writer of 'Laghubitta Khabar' (लघुवित्त खबर), a Nepali news and updates portal for the microfinance (लघुवित्त) sector, run by SENNA Network.",
    "",
    "Write a ready-to-publish " + type + " article.",
    "Topic: " + topic,
    "Language: " + lang,
    "Approximate length: " + words + " words.",
    keywords ? "Keywords to include naturally: " + keywords : "",
    "",
    "Requirements:",
    "- Factual, balanced, catchy title (no clickbait, no invented facts).",
    "- " + (lang === "Nepali" || lang === "हिन्दी" ? "Write the body in " + lang + " (Devanagari script)." : "Write the body in English."),
    "- 3 to 5 short Blogger labels/tags.",
    "- Body as clean HTML: use <p>, <h2>, <ul><li>, <strong>, <blockquote>. Do NOT use <html>, <head>, <body>, <script>, <style>, or inline styles.",
    "- " + (type === "News" ? "Lead with who/what/when/where, then details, then a short quote or outlook." : "Use a clear intro, 2-4 short sections, and a concise conclusion."),
    "",
    "Reply in exactly this format:",
    "TITLE: <title>",
    "LABELS: <label1>, <label2>, <label3>",
    "BODY:",
    "<p>...</p>",
    "<p>...</p>"
  ].filter(Boolean).join("\n");
}

function generateArticle_(opts) {
  const raw = fetchGemini_(buildArticlePrompt_(opts || {}));
  const draft = parseDraft_(raw);
  if (!draft.title || !draft.body) throw new Error("Gemini reply is missing a title or body. Try again.");
  return draft;
}

function collectBody_(lines) {
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const t = String(lines[i]).trim();
    if (t && /^(TITLE|LABELS?|BODY|CONTENT|HTML)\s*:\s*$/i.test(t)) continue;
    out.push(lines[i]);
  }
  return out.join("\n").trim();
}

function parseDraft_(raw) {
  raw = String(raw || "").trim();
  const lines = raw.split(/\r?\n/);
  let title = "", labels = [], body = "";

  let bodyIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^\s*(BODY|CONTENT|HTML)\s*:\s*(.*)$/i);
    if (m) {
      bodyIdx = i;
      if (m[2].trim()) lines[i] = m[2];
      break;
    }
  }

  const headerLines = bodyIdx > -1 ? lines.slice(0, bodyIdx) : lines;
  for (let i = 0; i < headerLines.length && (!title || !labels.length); i++) {
    const mt = headerLines[i].match(/^\s*TITLE\s*:\s*(.*)$/i);
    const ml = headerLines[i].match(/^\s*LABELS?\s*:\s*(.*)$/i);
    if (mt && !title) title = mt[1].trim();
    if (ml && !labels.length) labels = ml[1].split(/[,;]/).map(function (s) { return s.trim(); }).filter(Boolean).slice(0, 5);
  }

  if (bodyIdx > -1) body = collectBody_(lines.slice(bodyIdx));

  if (!title) {
    for (let i = 0; i < lines.length; i++) {
      const t = lines[i].trim();
      if (t && t.charAt(0) !== "<" && !/^(TITLE|LABELS?|BODY|CONTENT|HTML)\s*:/i.test(t)) { title = t.replace(/^#{1,6}\s*/, ""); break; }
    }
  }
  if (!body) {
    const ti = title ? raw.indexOf(title) : -1;
    const rest = ti > -1 ? raw.substring(ti + title.length).replace(/^\s*[:—-]*\s*/, "") : "";
    if (rest.trim()) body = txtToHtml_(rest);
  }

  title = title.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/^Title\s*:?\s*/i, "").trim();
  return { title: title, labels: labels, body: body };
}

function txtToHtml_(md) {
  md = String(md || "").trim();
  if (/<\/?[a-z][\s\S]*>/i.test(md) && md.indexOf("```") === -1) {
    return md.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "");
  }
  const lines = md.split(/\r?\n/);
  const out = [];
  let list = "";
  let para = [];
  const flush = function () {
    if (para.length) { out.push("<p>" + mdInline_(para.join(" ")) + "</p>"); para = []; }
  };
  const closeList = function () {
    if (list) { out.push("</" + list + ">"); list = ""; }
  };
  lines.forEach(function (ln) {
    const t = ln.trim();
    if (!t) { flush(); closeList(); return; }
    let m;
    if ((m = t.match(/^(#{1,6})\s+(.*)$/))) {
      flush(); closeList();
      const lvl = m[1].length > 4 ? 4 : m[1].length;
      out.push("<h" + lvl + ">" + mdInline_(m[2]) + "</h" + lvl + ">");
    } else if ((m = t.match(/^[-*]\s+(.*)$/)) || (m = t.match(/^(\d+)[.)]\s+(.*)$/))) {
      flush();
      const kind = m[2] !== undefined ? "ol" : "ul";
      const item = m[2] !== undefined ? m[2] : m[1];
      if (list !== kind) { closeList(); list = kind; out.push("<" + kind + ">"); }
      out.push("<li>" + mdInline_(item) + "</li>");
    } else if ((m = t.match(/^>\s?(.*)$/))) {
      flush(); closeList();
      out.push("<blockquote>" + mdInline_(m[1]) + "</blockquote>");
    } else {
      closeList();
      para.push(t);
    }
  });
  flush(); closeList();
  return out.join("\n");
}

function mdInline_(s) {
  s = String(s || "");
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/__([^_]+)__/g, "<strong>$1</strong>");
  s = s.replace(/(^|\s)\*([^*\n]+)\*/g, "$1<em>$2</em>");
  s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
  return s;
}

function saveArticle_(a) {
  const sheet = articleSheet_();
  const labels = Array.isArray(a.labels) ? a.labels.join(", ") : String(a.labels || "");
  sheet.appendRow([
    new Date(),
    String(a.title || ""),
    labels,
    a.status === "Published" ? "Published" : "Draft",
    String(a.sourceLink || ""),
    String(a.body || ""),
    "",
    ""
  ]);
  return sheet.getLastRow() - 2;
}

function getArticle_(id) {
  const sheet = articleSheet_();
  const row = Number(id) + 2;
  if (row > sheet.getLastRow()) throw new Error("Article not found");
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const vals = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];
  const a = {};
  headers.forEach(function (h, j) { a[h] = vals[j]; });
  return {
    id: Number(id),
    timestamp: fmtDate_(a["Timestamp"]),
    title: String(a["Title"] || ""),
    labels: String(a["Labels"] || ""),
    status: String(a["Status"] || "Draft"),
    sourceLink: String(a["Source Link"] || ""),
    body: String(a["Body HTML"] || ""),
    bloggerUrl: String(a["Blogger URL"] || ""),
    facebookUrl: String(a["Facebook URL"] || "")
  };
}

function listArticles_() {
  const sheet = articleSheet_();
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  const idx = {};
  data[0].forEach(function (h, j) { idx[h] = j; });
  const out = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    out.push({
      id: i - 1,
      timestamp: fmtDate_(row[idx["Timestamp"]]),
      title: String(row[idx["Title"]] || ""),
      status: String(row[idx["Status"]] || "Draft"),
      sourceLink: String(row[idx["Source Link"]] || ""),
      bloggerUrl: String(row[idx["Blogger URL"]] || ""),
      facebookUrl: String(row[idx["Facebook URL"]] || "")
    });
  }
  return out.reverse();
}

function markArticlePublished_(id, platform, url) {
  const sheet = articleSheet_();
  const row = Number(id) + 2;
  if (row > sheet.getLastRow()) throw new Error("Article not found");
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const idx = {};
  headers.forEach(function (h, j) { idx[h] = j; });
  sheet.getRange(row, idx[platform === "Blogger" ? "Blogger URL" : "Facebook URL"] + 1).setValue(url);
  sheet.getRange(row, idx["Status"] + 1).setValue("Published");
}

// Studio (google.script.run) versions.
function studioGenArticle(token, opts) {
  if (!authOk_(token)) return { status: "error", message: "Unauthorized" };
  try {
    return { status: "ok", draft: generateArticle_(opts || {}) };
  } catch (err) {
    return { status: "error", message: err.message };
  }
}

function studioSaveArticle(token, article) {
  if (!authOk_(token)) return { status: "error", message: "Unauthorized" };
  try {
    const id = saveArticle_(article || {});
    return { status: "ok", id: id };
  } catch (err) {
    return { status: "error", message: err.message };
  }
}

function studioGetArticle(token, id) {
  if (!authOk_(token)) return { status: "error", message: "Unauthorized" };
  try {
    return { status: "ok", article: getArticle_(id) };
  } catch (err) {
    return { status: "error", message: err.message };
  }
}

function studioListArticles(token) {
  if (!authOk_(token)) return { status: "error", message: "Unauthorized" };
  try {
    return { status: "ok", rows: listArticles_() };
  } catch (err) {
    return { status: "error", message: err.message };
  }
}

function studioPublishArticleBlogger(token, id, title, body, labels, sourceLink) {
  if (!authOk_(token)) return { status: "error", message: "Unauthorized" };
  try {
    const labelArr = String(labels || "").split(/[,;]/).map(function (s) { return s.trim(); }).filter(Boolean).slice(0, 5);
    const url = postToBlogger_(title, body, labelArr, sourceLink);
    markArticlePublished_(id, "Blogger", url);
    return { status: "ok", url: url };
  } catch (err) {
    return { status: "error", message: err.message };
  }
}

function studioPublishArticleFacebook(token, id, message, link) {
  if (!authOk_(token)) return { status: "error", message: "Unauthorized" };
  try {
    const url = postToFacebook_(message, link);
    markArticlePublished_(id, "Facebook", url);
    return { status: "ok", url: url };
  } catch (err) {
    return { status: "error", message: err.message };
  }
}

function json_(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function error_(msg) {
  return ContentService
    .createTextOutput(JSON.stringify({ status: "error", message: msg }))
    .setMimeType(ContentService.MimeType.JSON);
}
