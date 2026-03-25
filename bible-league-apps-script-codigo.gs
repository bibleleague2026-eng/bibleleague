/**
 * Bible League — Google Apps Script (cole TUDO no editor e publique nova versão)
 *
 * Planilha: 15 colunas A–O (linha 1 = cabeçalhos):
 * id | email | password_hash | token | nickname | city | state | country | church | xp | read_json | time_vt | time_nt | theme | updated_at
 *
 * Aba: nome "profiles" se existir; senão a aba ativa.
 */
var NUM_COLS = 15;
var COL_LAST = 'O';

var C = {
  id: 1, email: 2, password_hash: 3, token: 4, nickname: 5, city: 6, state: 7,
  country: 8, church: 9, xp: 10, read_json: 11, time_vt: 12, time_nt: 13, theme: 14, updated_at: 15
};

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonOut({ ok: false, error: 'invalid_request' });
    }
    var body = JSON.parse(e.postData.contents);
    var action = body.action;
    var sh = getSheet_();

    if (action === 'ping') return jsonOut({ ok: true, status: 'ok' });
    if (action === 'register') return jsonOut(registerUser_(sh, body));
    if (action === 'login') return jsonOut(loginUser_(sh, body));
    if (action === 'getProfile') return jsonOut(getProfile_(sh, body));
    if (action === 'saveProfile') return jsonOut(saveProfile_(sh, body));
    if (action === 'ranking') return jsonOut(getRanking_(sh, body));

    return jsonOut({ ok: false, error: 'unknown_action' });
  } catch (err) {
    return jsonOut({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

function doGet() {
  return jsonOut({ ok: true, status: 'ok', hint: 'use POST com JSON' });
}

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('profiles');
  return sh || ss.getActiveSheet();
}

/** Uma linha A–O sem confusão com getRange(row,col,rows,cols) */
function readRowA1_(sh, rowIndex) {
  return sh.getRange('A' + rowIndex + ':' + COL_LAST + rowIndex).getValues()[0];
}

function hashPassword_(email, password) {
  var raw = String(email).toLowerCase().trim() + '|' + String(password);
  var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, raw, Utilities.Charset.UTF_8);
  return digest.map(function (b) {
    var v = (b + 256) % 256;
    return ('0' + v.toString(16)).slice(-2);
  }).join('');
}

function newToken_() {
  return Utilities.getUuid();
}

function rowToProfile_(row) {
  var read = [];
  try {
    read = JSON.parse(row[C.read_json - 1] || '[]');
  } catch (e1) { read = []; }
  return {
    id: row[C.id - 1],
    email: row[C.email - 1],
    nickname: row[C.nickname - 1],
    city: row[C.city - 1],
    state: row[C.state - 1],
    country: row[C.country - 1],
    church: row[C.church - 1],
    xp: Number(row[C.xp - 1]) || 0,
    read: read,
    time_vt: Number(row[C.time_vt - 1]) || 0,
    time_nt: Number(row[C.time_nt - 1]) || 0,
    theme: row[C.theme - 1] || 'roblox',
    updated_at: row[C.updated_at - 1]
  };
}

function findRowByEmail_(sh, email) {
  var data = sh.getDataRange().getValues();
  var em = String(email).toLowerCase().trim();
  var ec = C.email - 1;
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][ec] || '').toLowerCase().trim() === em) return i + 1;
  }
  return 0;
}

function findRowById_(sh, id) {
  var data = sh.getDataRange().getValues();
  var sid = String(id);
  var ic = C.id - 1;
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][ic]) === sid) return i + 1;
  }
  return 0;
}

function registerUser_(sh, body) {
  var email = (body.email || '').trim();
  var password = body.password || '';
  var nickname = (body.nickname || '').trim();
  if (!email || !password) return { ok: false, error: 'email_e_senha_obrigatorios' };
  if (!nickname) return { ok: false, error: 'apelido_obrigatorio' };
  if (findRowByEmail_(sh, email)) return { ok: false, error: 'email_ja_cadastrado' };

  var id = Utilities.getUuid();
  var token = newToken_();
  var now = new Date().toISOString();

  var row = [];
  for (var j = 0; j < NUM_COLS; j++) row[j] = '';
  row[C.id - 1] = id;
  row[C.email - 1] = email;
  row[C.password_hash - 1] = hashPassword_(email, password);
  row[C.token - 1] = token;
  row[C.nickname - 1] = nickname;
  row[C.city - 1] = body.city || '';
  row[C.state - 1] = body.state || '';
  row[C.country - 1] = body.country || '';
  row[C.church - 1] = body.church || '';
  row[C.xp - 1] = 0;
  row[C.read_json - 1] = '[]';
  row[C.time_vt - 1] = 0;
  row[C.time_nt - 1] = 0;
  row[C.theme - 1] = 'roblox';
  row[C.updated_at - 1] = now;

  sh.appendRow(row);

  var rowIndex = findRowById_(sh, id);
  var saved = readRowA1_(sh, rowIndex);
  return { ok: true, id: id, token: token, profile: rowToProfile_(saved) };
}

function loginUser_(sh, body) {
  var email = (body.email || '').trim();
  var password = body.password || '';
  var rowIndex = findRowByEmail_(sh, email);
  if (!rowIndex) return { ok: false, error: 'email_ou_senha_invalidos' };
  var row = readRowA1_(sh, rowIndex);
  if (row[C.password_hash - 1] !== hashPassword_(email, password)) {
    return { ok: false, error: 'email_ou_senha_invalidos' };
  }
  var token = newToken_();
  sh.getRange(rowIndex, C.token).setValue(token);
  row = readRowA1_(sh, rowIndex);
  return { ok: true, id: row[C.id - 1], token: token, profile: rowToProfile_(row) };
}

function getProfile_(sh, body) {
  var id = body.id;
  var token = body.token;
  if (!id || !token) return { ok: false, error: 'sessao_invalida' };
  var rowIndex = findRowById_(sh, id);
  if (!rowIndex) return { ok: false, error: 'usuario_nao_encontrado' };
  var row = readRowA1_(sh, rowIndex);
  if (String(row[C.token - 1]) !== String(token)) return { ok: false, error: 'sessao_expirada' };
  return { ok: true, profile: rowToProfile_(row) };
}

function saveProfile_(sh, body) {
  var id = body.id;
  var token = body.token;
  if (!id || !token) return { ok: false, error: 'sessao_invalida' };
  var rowIndex = findRowById_(sh, id);
  if (!rowIndex) return { ok: false, error: 'usuario_nao_encontrado' };
  var row = readRowA1_(sh, rowIndex);
  if (String(row[C.token - 1]) !== String(token)) return { ok: false, error: 'sessao_expirada' };

  var readJson = '[]';
  try {
    readJson = JSON.stringify(Array.isArray(body.read) ? body.read : []);
  } catch (e2) { readJson = '[]'; }

  sh.getRange(rowIndex, C.email).setValue(body.email != null ? body.email : row[C.email - 1]);
  sh.getRange(rowIndex, C.nickname).setValue(body.nickname != null ? body.nickname : row[C.nickname - 1]);
  sh.getRange(rowIndex, C.city).setValue(body.city != null ? body.city : row[C.city - 1]);
  sh.getRange(rowIndex, C.state).setValue(body.state != null ? body.state : row[C.state - 1]);
  sh.getRange(rowIndex, C.country).setValue(body.country != null ? body.country : row[C.country - 1]);
  sh.getRange(rowIndex, C.church).setValue(body.church != null ? body.church : row[C.church - 1]);
  sh.getRange(rowIndex, C.xp).setValue(Number(body.xp) || 0);
  sh.getRange(rowIndex, C.read_json).setValue(readJson);
  sh.getRange(rowIndex, C.time_vt).setValue(Number(body.time_vt) || 0);
  sh.getRange(rowIndex, C.time_nt).setValue(Number(body.time_nt) || 0);
  sh.getRange(rowIndex, C.theme).setValue(body.theme || row[C.theme - 1] || 'roblox');
  sh.getRange(rowIndex, C.updated_at).setValue(new Date().toISOString());

  return { ok: true, profile: rowToProfile_(readRowA1_(sh, rowIndex)) };
}

function getRanking_(sh, body) {
  body = body || {};
  var limit = Math.min(100, Math.max(1, Number(body.limit) || 100));
  var data = sh.getDataRange().getValues();
  var rows = [];
  var ic = C.id - 1;
  for (var i = 1; i < data.length; i++) {
    var r = data[i];
    if (!r[ic]) continue;
    rows.push({
      nickname: r[C.nickname - 1],
      city: r[C.city - 1],
      state: r[C.state - 1],
      country: r[C.country - 1],
      church: r[C.church - 1],
      xp: Number(r[C.xp - 1]) || 0
    });
  }
  rows.sort(function (a, b) { return b.xp - a.xp; });
  return { ok: true, rows: rows.slice(0, limit) };
}
