/** @OnlyCurrentDoc */
/**
 * Coast to Crusi · RSVP receiver
 *
 * Lives inside the Google Sheet (Extensions → Apps Script).
 * The website's /api/rsvp endpoint sends each RSVP here, and this
 * script writes it as a new row on the "RSVPs" tab.
 *
 * SECRET must match the RSVP_SECRET environment variable in Vercel,
 * so only your website can add rows.
 */
const SECRET = 'PASTE_THE_RSVP_SECRET_FROM_VERCEL_HERE';

const SHEET_NAME = 'RSVPs';
const SUMMARY_NAME = 'Summary';
const HEADERS = [
  'Submitted', 'Guest name', 'Attending', 'Starter', 'Main', 'Dessert',
  'Dietary / allergies', 'Song request', 'Possible duplicate?'
];

const MENU = {
  starter: ['Caprese Salad', 'Togarashi Tuna', 'Short Rib & Bone Marrow'],
  main: ['Lamb Shank', 'Beef Fillet', 'Exotic Mushroom Risotto'],
  dessert: ['Cheesecake', 'Chocolate Marquise'],
};

function doPost(e) {
  try {
    const data = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (data.secret !== SECRET) return reply_({ ok: false, error: 'unauthorised' });

    const rsvp = validate_(data);
    if (rsvp.error) return reply_({ ok: false, error: rsvp.error });

    const lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      const sheet = getRsvpSheet_();
      const last = sheet.getLastRow();
      const existing = last > 1
        ? sheet.getRange(2, 2, last - 1, 1).getValues().map(r => normalise_(r[0]))
        : [];
      const duplicate = existing.indexOf(normalise_(rsvp.guest)) !== -1;

      sheet.appendRow([
        new Date(),
        rsvp.guest,
        rsvp.attending ? 'Yes' : 'No',
        rsvp.starter, rsvp.main, rsvp.dessert,
        rsvp.dietary, rsvp.song,
        duplicate ? 'Yes – check' : '',
      ]);
    } finally {
      lock.releaseLock();
    }
    return reply_({ ok: true });
  } catch (err) {
    console.error(err);
    return reply_({ ok: false, error: 'server' });
  }
}

/** Lets you open the web-app URL in a browser to check it is live. */
function doGet() {
  return reply_({ ok: true, message: 'Coast to Crusi RSVP receiver is running.' });
}

/** Run once from the editor (▶ Run → setup) to create the tabs and the meal tally. */
function setup() {
  getRsvpSheet_();
  const ss = SpreadsheetApp.getActive();
  let sum = ss.getSheetByName(SUMMARY_NAME) || ss.insertSheet(SUMMARY_NAME);
  sum.clear();
  const R = `'${SHEET_NAME}'!`;
  const rows = [
    ['Overview', ''],
    ['Total responses', `=COUNTA(${R}B2:B)`],
    ['Attending', `=COUNTIF(${R}C2:C,"Yes")`],
    ['Declined', `=COUNTIF(${R}C2:C,"No")`],
    ['Flagged possible duplicates', `=COUNTIF(${R}I2:I,"Yes*")`],
    ['', ''],
  ];
  [['Starter', 'D', MENU.starter], ['Main', 'E', MENU.main], ['Dessert', 'F', MENU.dessert]]
    .forEach(([title, col, dishes]) => {
      rows.push([title, 'Count']);
      dishes.forEach(d => rows.push([d, `=COUNTIFS(${R}${col}2:${col},"${d}",${R}C2:C,"Yes")`]));
      rows.push(['', '']);
    });
  sum.getRange(1, 1, rows.length, 2).setValues(rows);
  rows.forEach((r, i) => {
    if (r[1] === 'Count' || r[0] === 'Overview') sum.getRange(i + 1, 1, 1, 2).setFontWeight('bold');
  });
  sum.setColumnWidth(1, 240);
}

function getRsvpSheet_() {
  const ss = SpreadsheetApp.getActive();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.getSheets()[0];
    if (sheet.getLastRow() > 0 || sheet.getName() === SUMMARY_NAME) sheet = ss.insertSheet(SHEET_NAME);
    else sheet.setName(SHEET_NAME);
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
    sheet.getRange('A:A').setNumberFormat('d mmm yyyy HH:mm');
  }
  return sheet;
}

function validate_(d) {
  const clean = (v, max) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max);
  const guest = clean(d.guest, 100);
  if (!guest) return { error: 'name' };
  if (d.attendance !== 'yes' && d.attendance !== 'no') return { error: 'attendance' };
  const attending = d.attendance === 'yes';
  const out = { guest, attending, starter: '', main: '', dessert: '', dietary: '', song: '' };
  if (attending) {
    for (const course of ['starter', 'main', 'dessert']) {
      if (MENU[course].indexOf(d[course]) === -1) return { error: course };
      out[course] = d[course];
    }
    out.dietary = clean(d.dietary, 500);
    out.song = clean(d.song, 200);
  }
  // Stop spreadsheet formula injection from free-text fields.
  ['guest', 'dietary', 'song'].forEach(k => { if (/^[=+\-@]/.test(out[k])) out[k] = "'" + out[k]; });
  return out;
}

function normalise_(s) {
  return String(s).toLowerCase().replace(/\s+/g, ' ').trim();
}

function reply_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
