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
  job: { name: "JobCareer", headers: ["Timestamp","Full Name","Mobile","Email","Academic Qualification","Experience","Current Status","Home District","Preferred Province","Preferred City","Desired Sector","Help Needed","Notes"] },
  help: { name: "ClientHelp", headers: ["Timestamp","Name","Mobile","Home District","Institution Name","Institution Type","Issue Type","Issue Description","Preferred Contact Time","Contact Method"] },
  senna: { name: "SennaNetwork", headers: ["Timestamp","Full Name","Mobile","Email","Home District","Category","Institution","Profession","Contribution","Reason","Consent"] },
  confession: { name: "Confessions", headers: ["Timestamp","Category","Confession","Nickname","District"] }
};

const SALT = "lk-senna-network-2026";

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const form = data.form || "";

    if (data.action === "import") return importRows_(data);
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
    return json_({ total: countRows_(cfg.name), rows: getSheetData_(cfg.name, limit) });
  }
  if (action === "export") {
    const cfg = SHEETS[e.parameter.form];
    if (!cfg) return error_("Unknown form");
    return ContentService.createTextOutput(toCsv_(cfg.name, cfg.headers))
      .setMimeType(ContentService.MimeType.TEXT);
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
      data.province, data.city, data.sector, data.helpNeeded, data.notes
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
      data.contribution, data.reason, data.consent
    ]);
  } else if (form === "confession") {
    sheet.appendRow([
      timestamp, data.category, data.text, data.nickname, data.district
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

function getSheetData_(name, limit) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(name);
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  const headers = data[0];
  const body = data.slice(1);
  const selected = body.slice(-limit).reverse();
  return selected.map(function (row) {
    const obj = {};
    headers.forEach(function (h, j) { obj[h] = row[j]; });
    return obj;
  });
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
  return { status: "ok", stats: getStats_() };
}

function studioRecords(token, form, limit) {
  if (!authOk_(token)) return { status: "error", message: "Unauthorized" };
  const cfg = SHEETS[form];
  if (!cfg) return { status: "error", message: "Unknown form" };
  return { status: "ok", total: countRows_(cfg.name), rows: getSheetData_(cfg.name, limit || 500) };
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
  if (s.geminiKey !== undefined) p.setProperty("GEMINI_API_KEY", (s.geminiKey || "").trim());
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
    geminiKey: mask(p.getProperty("GEMINI_API_KEY")),
    folderId: p.getProperty("FOLDER_ID") || ""
  };
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
