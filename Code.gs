/**
 * Laghubitta Khabar — Forms Portal Backend
 * Handles: Job Career Sathi, Client Help, SENNA Network membership
 *
 * Deploy as: Extensions > Apps Script (inside a Google Sheet) > Deploy > Web App
 *   - Execute as: Me
 *   - Who has access: Anyone
 * Copy the Web App URL into SCRIPT_URL in index.html
 */

const SHEETS = {
  job: { name: "JobCareer", headers: ["Timestamp","Full Name","Mobile","Email","Academic Qualification","District","Desired Sector","Help Needed","Notes"] },
  help: { name: "ClientHelp", headers: ["Timestamp","Name","Mobile","Institution Name","Institution Type","Issue Type","Issue Description","Preferred Contact"] },
  senna: { name: "SennaNetwork", headers: ["Timestamp","Full Name","Mobile","Email","District","Profession","Contribution","Reason","Consent"] }
};

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const form = data.form || "";

    if (form === "job") return submitRow_("job", data);
    if (form === "help") return submitRow_("help", data);
    if (form === "senna") return submitRow_("senna", data);

    return error_("Unknown form type: " + form);
  } catch (err) {
    return error_(err.message);
  }
}

function doGet(e) {
  const action = e.parameter.action;
  if (action === "records" && e.parameter.form) {
    const cfg = SHEETS[e.parameter.form];
    if (!cfg) return error_("Unknown form");
    return json_(getSheetData_(cfg.name));
  }
  return ContentService.createTextOutput("Laghubitta Khabar Forms API is live.");
}

function submitRow_(form, data) {
  const cfg = SHEETS[form];
  const sheet = getOrCreateSheet_(cfg.name, cfg.headers);

  const timestamp = new Date(data.timestamp || new Date());

  if (form === "job") {
    sheet.appendRow([
      timestamp, data.fullName, data.mobile, data.email,
      data.academic, data.district, data.sector, data.helpNeeded, data.notes
    ]);
  } else if (form === "help") {
    sheet.appendRow([
      timestamp, data.name, data.mobile, data.institution,
      data.institutionType, data.issueType, data.issue, data.contactTime
    ]);
  } else if (form === "senna") {
    sheet.appendRow([
      timestamp, data.fullName, data.mobile, data.email,
      data.district, data.profession, data.contribution, data.reason, data.consent
    ]);
  }

  return json_({ status: "ok", form: form });
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

function getSheetData_(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(name);
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  const headers = data[0];
  const rows = [];
  for (let i = 1; i < data.length; i++) {
    const row = {};
    headers.forEach((h, j) => { row[h] = data[i][j]; });
    rows.push(row);
  }
  return rows;
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
