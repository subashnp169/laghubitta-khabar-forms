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
  confession: { name: "Confessions", headers: ["Timestamp","Category","Confession","Nickname","District","Status","Published"] }
};

const SALT = "lk-senna-network-2026";

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
    return json_({ total: countRows_(cfg.name), rows: getSheetData_(cfg.name, limit) });
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
  if (s.bloggerToken !== undefined) p.setProperty("BLOGGER_TOKEN", (s.bloggerToken || "").trim());
  if (s.bloggerRefresh !== undefined) p.setProperty("BLOGGER_REFRESH_TOKEN", (s.bloggerRefresh || "").trim());
  if (s.bloggerClientId !== undefined) p.setProperty("BLOGGER_CLIENT_ID", (s.bloggerClientId || "").trim());
  if (s.bloggerClientSecret !== undefined) p.setProperty("BLOGGER_CLIENT_SECRET", (s.bloggerClientSecret || "").trim());
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
    bloggerToken: mask(p.getProperty("BLOGGER_TOKEN")),
    bloggerRefresh: mask(p.getProperty("BLOGGER_REFRESH_TOKEN")),
    bloggerClientId: p.getProperty("BLOGGER_CLIENT_ID") || "",
    bloggerClientSecret: mask(p.getProperty("BLOGGER_CLIENT_SECRET")),
    geminiKey: mask(p.getProperty("GEMINI_API_KEY")),
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

function publishBlogger_(id, title, body) {
  const p = PropertiesService.getScriptProperties();
  const blogId = p.getProperty("BLOG_ID") || "";
  if (!blogId) throw new Error("Blogger Blog ID is not set (Studio > Settings)");
  if (!title) throw new Error("Title is required");
  const token = getBloggerToken_();
  if (!token) throw new Error("Blogger access token is not set (Studio > Settings)");

  const res = UrlFetchApp.fetch(
    "https://www.googleapis.com/blogger/v3/blogs/" + encodeURIComponent(blogId) + "/posts/",
    {
      method: "post",
      contentType: "application/json",
      headers: { Authorization: "Bearer " + token },
      payload: JSON.stringify({ title: title, content: body || "" }),
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

function publishFacebook_(id, message) {
  const p = PropertiesService.getScriptProperties();
  const pageId = p.getProperty("FB_PAGE_ID") || "";
  const token = p.getProperty("FB_TOKEN") || "";
  if (!pageId) throw new Error("Facebook Page ID is not set (Studio > Settings)");
  if (!token) throw new Error("Facebook Page Access Token is not set (Studio > Settings)");
  if (!message) throw new Error("Message is required");

  const res = UrlFetchApp.fetch(
    "https://graph.facebook.com/v20.0/" + encodeURIComponent(pageId) + "/feed",
    {
      method: "post",
      payload: { message: message, access_token: token },
      muteHttpExceptions: true
    }
  );
  const code = res.getResponseCode();
  const txt = res.getContentText();
  if (code !== 200) throw new Error("Facebook error " + code + ": " + txt);
  return "https://www.facebook.com/" + pageId + "/posts/" + JSON.parse(txt).id;
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
