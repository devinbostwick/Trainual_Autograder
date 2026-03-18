// ============================================================
// TEST ASSIGNMENT MANAGER — FULLY STANDALONE
// Manages test/subject assignments via the Trainual API.
// Does NOT depend on trainual_automation.gs.
// ============================================================

// ============================================================
// STANDALONE CONFIG + API CLIENT
// ============================================================

var EXPORT_CONFIG = {
  ADMIN_EMAIL: 'devin@threepointshospitality.com',
  ACCOUNT_ID: 'f9e05a9e-ccec-463e-beae-d1c5489f4c52',
  PASSWORD: PropertiesService.getScriptProperties().getProperty('TRAINUAL_PASSWORD') || '',
  API_BASE: 'https://api.trainual.com/v1'
};

function _buildAuthHeader() {
  var username = EXPORT_CONFIG.ADMIN_EMAIL + '&' + EXPORT_CONFIG.ACCOUNT_ID;
  return 'Basic ' + Utilities.base64Encode(username + ':' + EXPORT_CONFIG.PASSWORD, Utilities.Charset.UTF_8);
}

function trainualFetch(endpoint, method, payload) {
  method = method || 'GET';
  var url = EXPORT_CONFIG.API_BASE + endpoint;
  var options = {
    method: method,
    headers: {
      'Authorization': _buildAuthHeader(),
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    muteHttpExceptions: true
  };
  if (payload) options.payload = JSON.stringify(payload);

  for (var attempt = 0; attempt < 3; attempt++) {
    try {
      var response = UrlFetchApp.fetch(url, options);
      var code = response.getResponseCode();
      if (code === 200 || code === 201) {
        var text = response.getContentText();
        return text ? JSON.parse(text) : {};
      }
      if (code === 204) return {};
      if (code === 429) { Utilities.sleep(Math.pow(2, attempt + 1) * 1000); continue; }
    } catch (e) { Utilities.sleep(Math.pow(2, attempt) * 1000); }
  }
  return null;
}

function fetchAllUsers() {
  return trainualFetch('/users?curriculums_assigned=true&roles_assigned=true');
}

function fetchAllSubjects() {
  return trainualFetch('/curriculums?assigned_users=true');
}

function fetchTests(curriculumId) {
  return trainualFetch('/curriculums/' + curriculumId + '/surveys');
}

function assignSubjects(userId, curriculumIds) {
  return trainualFetch('/users/' + userId + '/assign_curriculums', 'PUT', { curriculum_ids: curriculumIds });
}

function unassignSubjects(userId, curriculumIds) {
  return trainualFetch('/users/' + userId + '/unassign_curriculums', 'PUT', { curriculum_ids: curriculumIds });
}


// ============================================================
// SHEET NAME + MENU
// ============================================================

var TEST_ASSIGN_SHEET = 'Test Assignments';

function onOpen() {
  SpreadsheetApp.getUi().createMenu('🎓 Test Assignments')
    .addItem('📋 Create Test Assignment Sheet', 'createTestAssignmentSheet')
    .addItem('🖥️ Open Dashboard', 'showTestAssignmentDashboard')
    .addItem('▶️ Execute Test Assignments', 'executeTestAssignments')
    .addItem('⚡ Quick Assign Subject to Selected', 'quickAssignSubjectToSelected')
    .addSeparator()
    .addItem('📥 Bulk Assign Selected Users', 'bulkAssignSelected')
    .addItem('📤 Bulk Unassign Selected Users', 'bulkUnassignSelected')
    .addItem('🔄 Bulk Sync Selected Users', 'bulkSyncSelected')
    .addToUi();
}

function onEdit(e) {
  var sheet = e.source.getActiveSheet();
  if (sheet.getName() === TEST_ASSIGN_SHEET) {
    onEditTestAssignment(e);
  }
}


// ============================================================
// 1. BUILD THE TEST ASSIGNMENT SHEET
// ============================================================

function createTestAssignmentSheet() {
  var ui = SpreadsheetApp.getUi();
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  ui.alert('⏳ Building Test Assignment sheet...\nThis fetches live data from Trainual and may take 30-60 seconds.');

  var users = fetchAllUsers();
  var subjects = fetchAllSubjects();

  if (!Array.isArray(users) || !Array.isArray(subjects)) {
    ui.alert('❌ Failed to fetch data from Trainual. Check your API credentials.');
    return;
  }

  var testSubjects = [];
  subjects.forEach(function(s) {
    if ((s.surveys_count || 0) > 0) {
      testSubjects.push({
        id: s.id,
        title: s.title || 'Untitled Subject',
        testCount: s.surveys_count || 0,
        testNames: []
      });
    }
  });

  testSubjects.forEach(function(ts) {
    var tests = fetchTests(ts.id);
    if (Array.isArray(tests)) {
      ts.testNames = tests.map(function(t) { return t.name || 'Unnamed Test'; });
    }
    Utilities.sleep(200);
  });

  testSubjects.sort(function(a, b) { return a.title.localeCompare(b.title); });
  users.sort(function(a, b) { return (a.name || '').localeCompare(b.name || ''); });

  var sheet = ss.getSheetByName(TEST_ASSIGN_SHEET);
  if (sheet) {
    sheet.clear();
    sheet.clearConditionalFormatRules();
    if (sheet.getLastRow() > 0 && sheet.getLastColumn() > 0) {
      sheet.getRange(1, 1, sheet.getMaxRows(), sheet.getMaxColumns()).clearDataValidations();
    }
  } else {
    sheet = ss.insertSheet(TEST_ASSIGN_SHEET);
  }

  var FIXED_COLS = 6;
  var headerRow1 = ['', 'User ID', 'Name', 'Email', 'Status', 'Current Roles'];
  var headerRow2 = ['SELECT ☑️', '', '', '', '', ''];

  testSubjects.forEach(function(ts) {
    var colHeader = ts.title + '\n(ID: ' + ts.id + ', ' + ts.testCount + ' test' + (ts.testCount > 1 ? 's' : '') + ')';
    headerRow1.push(colHeader);
    var testList = ts.testNames.length > 0 ? ts.testNames.join('\n') : '(tests not fetched)';
    headerRow2.push(testList);
  });

  var totalCols = FIXED_COLS + testSubjects.length;

  headerRow1.push('ASSIGN ☑️');
  headerRow1.push('UNASSIGN ☑️');
  headerRow1.push('RESULT');
  headerRow1.push('TIMESTAMP');
  headerRow2.push('');
  headerRow2.push('');
  headerRow2.push('');
  headerRow2.push('');
  var ACTION_COL_ASSIGN = totalCols + 1;
  var ACTION_COL_UNASSIGN = totalCols + 2;
  var RESULT_COL = totalCols + 3;
  var TIMESTAMP_COL = totalCols + 4;
  totalCols += 4;

  sheet.getRange(1, 1, 1, totalCols).setValues([headerRow1]);
  sheet.getRange(2, 1, 1, totalCols).setValues([headerRow2]);

  sheet.getRange(1, 1, 1, totalCols)
    .setFontWeight('bold')
    .setBackground('#1a1a2e')
    .setFontColor('#ffffff')
    .setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP)
    .setVerticalAlignment('middle')
    .setHorizontalAlignment('center');

  sheet.getRange(2, 1, 1, totalCols)
    .setFontSize(9)
    .setBackground('#2d2d44')
    .setFontColor('#aaaaaa')
    .setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP)
    .setVerticalAlignment('top');

  sheet.setFrozenRows(2);
  sheet.setFrozenColumns(FIXED_COLS);

  var dataRows = [];
  users.forEach(function(user) {
    if (user.status === 'archived') return;

    var roles = (user.roles_assigned || []).map(function(r) { return r.name; }).join(', ');
    var assignedSubjIds = {};
    (user.curriculums_assigned || []).forEach(function(c) {
      assignedSubjIds[c.id] = true;
    });

    var row = [
      false,
      user.id,
      user.name || '',
      user.email || '',
      user.status || '',
      roles
    ];

    testSubjects.forEach(function(ts) {
      row.push(assignedSubjIds[ts.id] ? true : false);
    });

    row.push(false);
    row.push(false);
    row.push('');
    row.push('');

    dataRows.push(row);
  });

  if (dataRows.length > 0) {
    sheet.getRange(3, 1, dataRows.length, totalCols).setValues(dataRows);

    sheet.getRange(3, 1, dataRows.length, 1).insertCheckboxes();

    if (testSubjects.length > 0) {
      sheet.getRange(3, FIXED_COLS + 1, dataRows.length, testSubjects.length).insertCheckboxes();
    }

    sheet.getRange(3, ACTION_COL_ASSIGN, dataRows.length, 1).insertCheckboxes();
    sheet.getRange(3, ACTION_COL_UNASSIGN, dataRows.length, 1).insertCheckboxes();

    var subjectRange = sheet.getRange(3, FIXED_COLS + 1, dataRows.length, testSubjects.length);
    var rules = [
      SpreadsheetApp.newConditionalFormatRule()
        .whenFormulaSatisfied('=INDIRECT("RC",FALSE)=TRUE')
        .setBackground('#c6efce')
        .setRanges([subjectRange])
        .build(),
      SpreadsheetApp.newConditionalFormatRule()
        .whenFormulaSatisfied('=INDIRECT("RC",FALSE)=FALSE')
        .setBackground('#fce4ec')
        .setRanges([subjectRange])
        .build()
    ];
    sheet.setConditionalFormatRules(rules);

    sheet.getRange(3, 2, dataRows.length, 1).setHorizontalAlignment('center');
    sheet.getRange(3, 5, dataRows.length, 1).setHorizontalAlignment('center');
    sheet.getRange(3, FIXED_COLS + 1, dataRows.length, testSubjects.length)
      .setHorizontalAlignment('center');
  }

  sheet.setColumnWidth(1, 80);
  sheet.setColumnWidth(2, 80);
  sheet.setColumnWidth(3, 180);
  sheet.setColumnWidth(4, 250);
  sheet.setColumnWidth(5, 80);
  sheet.setColumnWidth(6, 200);

  for (var c = FIXED_COLS + 1; c <= FIXED_COLS + testSubjects.length; c++) {
    sheet.setColumnWidth(c, 200);
  }
  sheet.setColumnWidth(ACTION_COL_ASSIGN, 100);
  sheet.setColumnWidth(ACTION_COL_UNASSIGN, 110);
  sheet.setColumnWidth(RESULT_COL, 250);
  sheet.setColumnWidth(TIMESTAMP_COL, 180);

  sheet.setRowHeight(1, 80);
  sheet.setRowHeight(2, 100);

  var instrRow = dataRows.length + 5;
  var instructions = [
    ['TEST ASSIGNMENT MANAGER — INSTRUCTIONS'],
    [''],
    ['HOW IT WORKS:'],
    ['• Each column (G+) represents a test-containing SUBJECT in Trainual.'],
    ['• A ✅ checkbox means the user IS currently assigned to that subject (and its tests).'],
    ['• An ☐ unchecked box means the user is NOT assigned.'],
    [''],
    ['TO ASSIGN NEW TESTS:'],
    ['1. Check the subject column(s) you want to assign for the user\'s row.'],
    ['2. Check the "ASSIGN ☑️" checkbox at the end of that row.'],
    ['3. Run: 🎓 Test Assignments → Execute Test Assignments'],
    ['   (or it auto-executes if the onEdit trigger is installed)'],
    [''],
    ['TO UNASSIGN TESTS:'],
    ['1. Uncheck the subject column(s) you want to remove.'],
    ['2. Check the "UNASSIGN ☑️" checkbox at the end of that row.'],
    ['3. Run: 🎓 Test Assignments → Execute Test Assignments'],
    [''],
    ['BULK OPERATIONS:'],
    ['• Use the "SELECT" column (A) to mark multiple users.'],
    ['• Then run: 🎓 Test Assignments → Bulk Assign / Bulk Unassign'],
    [''],
    ['NOTES:'],
    ['• Tests live INSIDE subjects. Assigning a subject assigns ALL its tests.'],
    ['• The Trainual API does not support assigning individual tests — only whole subjects.'],
    ['• Refresh this sheet (Create Test Assignment Sheet) to see updated data.'],
    ['• Subject IDs are shown in the column headers for reference.']
  ];
  sheet.getRange(instrRow, 1, instructions.length, 1).setValues(instructions);
  sheet.getRange(instrRow, 1).setFontWeight('bold').setFontSize(12);
  sheet.getRange(instrRow + 2, 1).setFontWeight('bold');
  sheet.getRange(instrRow + 7, 1).setFontWeight('bold');
  sheet.getRange(instrRow + 13, 1).setFontWeight('bold');
  sheet.getRange(instrRow + 18, 1).setFontWeight('bold');
  sheet.getRange(instrRow + 22, 1).setFontWeight('bold');

  var colMap = {
    fixedCols: FIXED_COLS,
    subjectIds: testSubjects.map(function(ts) { return ts.id; }),
    subjectTitles: testSubjects.map(function(ts) { return ts.title; }),
    actionColAssign: ACTION_COL_ASSIGN,
    actionColUnassign: ACTION_COL_UNASSIGN,
    resultCol: RESULT_COL,
    timestampCol: TIMESTAMP_COL,
    totalCols: totalCols,
    dataStartRow: 3
  };
  PropertiesService.getScriptProperties().setProperty('TEST_ASSIGN_COL_MAP', JSON.stringify(colMap));

  ui.alert(
    '✅ Test Assignment sheet created!\n\n' +
    '• ' + dataRows.length + ' active users\n' +
    '• ' + testSubjects.length + ' test-containing subjects\n\n' +
    'Check/uncheck subject boxes, then use the ASSIGN/UNASSIGN checkboxes or run from the menu.'
  );
}


// ============================================================
// 2. EXECUTE ASSIGNMENTS — PROCESS INDIVIDUAL ROWS
// ============================================================

function _getTestAssignColMap() {
  var raw = PropertiesService.getScriptProperties().getProperty('TEST_ASSIGN_COL_MAP');
  if (!raw) return null;
  return JSON.parse(raw);
}

function processTestAssignmentRow(sheet, row, mode) {
  var colMap = _getTestAssignColMap();
  if (!colMap) {
    return '❌ Column map not found. Rebuild the sheet first.';
  }

  var userId = sheet.getRange(row, 2).getValue();
  if (!userId) {
    return '❌ No User ID in this row.';
  }

  var userName = sheet.getRange(row, 3).getValue();

  var desiredAssigned = [];
  var desiredUnassigned = [];

  for (var i = 0; i < colMap.subjectIds.length; i++) {
    var col = colMap.fixedCols + 1 + i;
    var isChecked = sheet.getRange(row, col).getValue() === true;
    if (isChecked) {
      desiredAssigned.push(colMap.subjectIds[i]);
    } else {
      desiredUnassigned.push(colMap.subjectIds[i]);
    }
  }

  var users = fetchAllUsers();
  var currentUser = null;
  if (Array.isArray(users)) {
    for (var u = 0; u < users.length; u++) {
      if (users[u].id == userId) {
        currentUser = users[u];
        break;
      }
    }
  }

  var currentSubjIds = {};
  if (currentUser && currentUser.curriculums_assigned) {
    currentUser.curriculums_assigned.forEach(function(c) {
      currentSubjIds[c.id] = true;
    });
  }

  var toAssign = [];
  var toUnassign = [];
  var results = [];

  if (mode === 'assign' || mode === 'sync') {
    desiredAssigned.forEach(function(subjId) {
      if (!currentSubjIds[subjId]) {
        toAssign.push(subjId);
      }
    });
  }

  if (mode === 'unassign' || mode === 'sync') {
    desiredUnassigned.forEach(function(subjId) {
      if (currentSubjIds[subjId]) {
        toUnassign.push(subjId);
      }
    });
  }

  if (toAssign.length > 0) {
    var assignResult = assignSubjects(userId, toAssign);
    if (assignResult) {
      results.push('✅ Assigned ' + toAssign.length + ' subject(s)');
      Logger.log('Assigned subjects ' + toAssign.join(',') + ' to user ' + userId + ' (' + userName + ')');
    } else {
      results.push('❌ Assign failed for ' + toAssign.length + ' subject(s)');
    }
  }

  if (toUnassign.length > 0) {
    var unassignResult = unassignSubjects(userId, toUnassign);
    if (unassignResult) {
      results.push('✅ Unassigned ' + toUnassign.length + ' subject(s)');
      Logger.log('Unassigned subjects ' + toUnassign.join(',') + ' from user ' + userId + ' (' + userName + ')');
    } else {
      results.push('❌ Unassign failed for ' + toUnassign.length + ' subject(s)');
    }
  }

  if (toAssign.length === 0 && toUnassign.length === 0) {
    results.push('ℹ️ No changes needed — already in sync.');
  }

  return results.join(' | ');
}


// ============================================================
// 3. TRIGGER-BASED AND MENU-BASED EXECUTION
// ============================================================

function onEditTestAssignment(e) {
  var sheet = e.source.getActiveSheet();
  if (sheet.getName() !== TEST_ASSIGN_SHEET) return;

  var colMap = _getTestAssignColMap();
  if (!colMap) return;

  var row = e.range.getRow();
  var col = e.range.getColumn();
  if (row < colMap.dataStartRow) return;

  if (col === colMap.actionColAssign && e.range.getValue() === true) {
    var result = processTestAssignmentRow(sheet, row, 'assign');
    sheet.getRange(row, colMap.resultCol).setValue(result);
    sheet.getRange(row, colMap.timestampCol).setValue(new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' }));
    sheet.getRange(row, colMap.actionColAssign).setValue(false);
  }

  if (col === colMap.actionColUnassign && e.range.getValue() === true) {
    var result = processTestAssignmentRow(sheet, row, 'unassign');
    sheet.getRange(row, colMap.resultCol).setValue(result);
    sheet.getRange(row, colMap.timestampCol).setValue(new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' }));
    sheet.getRange(row, colMap.actionColUnassign).setValue(false);
  }
}

function executeTestAssignments() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(TEST_ASSIGN_SHEET);
  if (!sheet) {
    SpreadsheetApp.getUi().alert('❌ No "' + TEST_ASSIGN_SHEET + '" sheet found.\nRun "Create Test Assignment Sheet" first.');
    return;
  }

  var colMap = _getTestAssignColMap();
  if (!colMap) {
    SpreadsheetApp.getUi().alert('❌ Column mapping not found. Rebuild the sheet.');
    return;
  }

  var lastRow = sheet.getLastRow();
  var processed = 0;

  for (var row = colMap.dataStartRow; row <= lastRow; row++) {
    var assignChecked = sheet.getRange(row, colMap.actionColAssign).getValue() === true;
    var unassignChecked = sheet.getRange(row, colMap.actionColUnassign).getValue() === true;

    if (!assignChecked && !unassignChecked) continue;

    var mode = 'sync';
    if (assignChecked && !unassignChecked) mode = 'assign';
    if (!assignChecked && unassignChecked) mode = 'unassign';

    var result = processTestAssignmentRow(sheet, row, mode);
    sheet.getRange(row, colMap.resultCol).setValue(result);
    sheet.getRange(row, colMap.timestampCol).setValue(new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' }));

    sheet.getRange(row, colMap.actionColAssign).setValue(false);
    sheet.getRange(row, colMap.actionColUnassign).setValue(false);

    processed++;
    Utilities.sleep(300);
  }

  SpreadsheetApp.getUi().alert('✅ Processed ' + processed + ' row(s).\nCheck the RESULT column for details.');
}


// ============================================================
// 4. BULK OPERATIONS
// ============================================================

function bulkAssignSelected() {
  _bulkOperation('assign');
}

function bulkUnassignSelected() {
  _bulkOperation('unassign');
}

function bulkSyncSelected() {
  _bulkOperation('sync');
}

function _bulkOperation(mode) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(TEST_ASSIGN_SHEET);
  if (!sheet) {
    SpreadsheetApp.getUi().alert('❌ No "' + TEST_ASSIGN_SHEET + '" sheet found.');
    return;
  }

  var colMap = _getTestAssignColMap();
  if (!colMap) {
    SpreadsheetApp.getUi().alert('❌ Column mapping not found. Rebuild the sheet.');
    return;
  }

  var lastRow = sheet.getLastRow();
  var processed = 0;

  for (var row = colMap.dataStartRow; row <= lastRow; row++) {
    var isSelected = sheet.getRange(row, 1).getValue() === true;
    if (!isSelected) continue;

    var result = processTestAssignmentRow(sheet, row, mode);
    sheet.getRange(row, colMap.resultCol).setValue(result);
    sheet.getRange(row, colMap.timestampCol).setValue(new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' }));

    sheet.getRange(row, 1).setValue(false);

    processed++;
    Utilities.sleep(300);
  }

  var modeLabel = mode === 'assign' ? 'assigned' : mode === 'unassign' ? 'unassigned' : 'synced';
  SpreadsheetApp.getUi().alert('✅ Bulk ' + modeLabel + ' ' + processed + ' user(s).\nCheck the RESULT column for details.');
}


// ============================================================
// 5. QUICK ASSIGN
// ============================================================

function quickAssignSubjectToSelected() {
  var ui = SpreadsheetApp.getUi();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(TEST_ASSIGN_SHEET);

  if (!sheet) {
    ui.alert('❌ No "' + TEST_ASSIGN_SHEET + '" sheet found.');
    return;
  }

  var colMap = _getTestAssignColMap();
  if (!colMap) {
    ui.alert('❌ Column mapping not found. Rebuild the sheet.');
    return;
  }

  var subjectList = colMap.subjectIds.map(function(id, i) {
    return id + ' — ' + colMap.subjectTitles[i];
  }).join('\n');

  var response = ui.prompt(
    'Quick Assign Subject',
    'Enter the Subject ID to assign:\n\n' +
    'Available test subjects:\n' + subjectList +
    '\n\nThis will be assigned to all users with a ☑️ in column A (SELECT).',
    ui.ButtonSet.OK_CANCEL
  );

  if (response.getSelectedButton() !== ui.Button.OK) return;

  var subjId = parseInt(response.getResponseText().trim(), 10);
  if (isNaN(subjId)) {
    ui.alert('❌ Invalid Subject ID.');
    return;
  }

  var subjIdx = colMap.subjectIds.indexOf(subjId);
  if (subjIdx === -1) {
    ui.alert('❌ Subject ID ' + subjId + ' is not a test-containing subject in the sheet.');
    return;
  }

  var lastRow = sheet.getLastRow();
  var assigned = 0;
  var failed = 0;

  for (var row = colMap.dataStartRow; row <= lastRow; row++) {
    var isSelected = sheet.getRange(row, 1).getValue() === true;
    if (!isSelected) continue;

    var userId = sheet.getRange(row, 2).getValue();
    var userName = sheet.getRange(row, 3).getValue();
    if (!userId) continue;

    var result = assignSubjects(userId, [subjId]);
    if (result) {
      var subjCol = colMap.fixedCols + 1 + subjIdx;
      sheet.getRange(row, subjCol).setValue(true);
      sheet.getRange(row, colMap.resultCol).setValue('✅ Assigned: ' + colMap.subjectTitles[subjIdx]);
      sheet.getRange(row, colMap.timestampCol).setValue(new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' }));
      assigned++;
      Logger.log('Quick assigned subject ' + subjId + ' to user ' + userId + ' (' + userName + ')');
    } else {
      sheet.getRange(row, colMap.resultCol).setValue('❌ Failed to assign: ' + colMap.subjectTitles[subjIdx]);
      failed++;
    }

    sheet.getRange(row, 1).setValue(false);
    Utilities.sleep(300);
  }

  ui.alert(
    '✅ Quick Assign Complete\n\n' +
    'Subject: ' + colMap.subjectTitles[subjIdx] + ' (ID: ' + subjId + ')\n' +
    'Assigned: ' + assigned + '\n' +
    'Failed: ' + failed
  );
}


// ============================================================
// 6. DASHBOARD (WEB APP + SIDEBAR/DIALOG)
// ============================================================

/**
 * Required entry point for web app deployment.
 * Deploy via: Extensions → Apps Script → Deploy → New deployment → Web app
 */
function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('test_assignment_dashboard')
    .setTitle('Test Assignment Manager — Three Points Hospitality')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function showTestAssignmentDashboard() {
  var html = HtmlService.createHtmlOutputFromFile('test_assignment_dashboard')
    .setTitle('Test Assignment Manager')
    .setWidth(1000)
    .setHeight(700);
  SpreadsheetApp.getUi().showModalDialog(html, 'Test Assignment Manager');
}

function getAssignmentData() {
  var users = fetchAllUsers();
  var subjects = fetchAllSubjects();

  if (!Array.isArray(users) || !Array.isArray(subjects)) {
    return { users: [], subjects: [] };
  }

  var testSubjects = [];
  subjects.forEach(function(s) {
    if ((s.surveys_count || 0) > 0) {
      var tests = fetchTests(s.id);
      testSubjects.push({
        id: s.id,
        title: s.title || 'Untitled',
        testCount: s.surveys_count || 0,
        tests: Array.isArray(tests) ? tests.map(function(t) {
          return { id: t.id, name: t.name || 'Unnamed Test' };
        }) : []
      });
      Utilities.sleep(200);
    }
  });

  testSubjects.sort(function(a, b) { return a.title.localeCompare(b.title); });

  var userData = [];
  users.forEach(function(u) {
    if (u.status === 'archived') return;
    var assignedSubjectIds = {};
    (u.curriculums_assigned || []).forEach(function(c) {
      assignedSubjectIds[c.id] = true;
    });
    userData.push({
      id: u.id,
      name: u.name || '',
      email: u.email || '',
      status: u.status || '',
      roles: (u.roles_assigned || []).map(function(r) { return r.name; }),
      assignedSubjectIds: assignedSubjectIds
    });
  });

  userData.sort(function(a, b) { return a.name.localeCompare(b.name); });

  return { users: userData, subjects: testSubjects };
}

function assignToUser(userId, subjectIds) {
  if (!userId || !Array.isArray(subjectIds) || subjectIds.length === 0) {
    return { success: false, message: 'Missing user ID or subject IDs.' };
  }
  var result = assignSubjects(userId, subjectIds);
  if (result) {
    return { success: true, message: 'Assigned ' + subjectIds.length + ' subject(s) to user ' + userId + '.' };
  }
  return { success: false, message: 'API call failed for user ' + userId + '.' };
}

function unassignFromUser(userId, subjectIds) {
  if (!userId || !Array.isArray(subjectIds) || subjectIds.length === 0) {
    return { success: false, message: 'Missing user ID or subject IDs.' };
  }
  var result = unassignSubjects(userId, subjectIds);
  if (result) {
    return { success: true, message: 'Unassigned ' + subjectIds.length + ' subject(s) from user ' + userId + '.' };
  }
  return { success: false, message: 'API call failed for user ' + userId + '.' };
}

function bulkAssignSubject(subjectId, userIds) {
  if (!subjectId || !Array.isArray(userIds) || userIds.length === 0) {
    return { success: false, message: 'Missing subject ID or user IDs.' };
  }
  var success = 0;
  var failed = 0;
  userIds.forEach(function(uid) {
    var result = assignSubjects(uid, [subjectId]);
    if (result) { success++; } else { failed++; }
    Utilities.sleep(300);
  });
  return {
    success: failed === 0,
    message: 'Assigned to ' + success + '/' + userIds.length + ' user(s).' + (failed > 0 ? ' (' + failed + ' failed)' : '')
  };
}

function bulkUnassignSubject(subjectId, userIds) {
  if (!subjectId || !Array.isArray(userIds) || userIds.length === 0) {
    return { success: false, message: 'Missing subject ID or user IDs.' };
  }
  var success = 0;
  var failed = 0;
  userIds.forEach(function(uid) {
    var result = unassignSubjects(uid, [subjectId]);
    if (result) { success++; } else { failed++; }
    Utilities.sleep(300);
  });
  return {
    success: failed === 0,
    message: 'Unassigned from ' + success + '/' + userIds.length + ' user(s).' + (failed > 0 ? ' (' + failed + ' failed)' : '')
  };
}