// =====================================
// INVENTARIO MULTIUSUARIO - GOOGLE APPS SCRIPT
// =====================================
// Copia este código completo en tu Google Apps Script
// Extensiones > Apps Script en tu hoja de cálculo

const SHEET_INVENTARIO = "Inventario";
const SHEET_HISTORIAL = "Historial";
const SHEET_LOCK = "Lock";
const LOCK_TIMEOUT = 30000; // 30 segundos

// =====================================
// HELPER: Fecha local DD/MM/YYYY (sin hora)
// =====================================

/**
 * Devuelve la fecha actual en zona horaria de Chile (America/Santiago)
 * formateada como DD/MM/YYYY, sin hora.
 */
function fechaDD_MM_YYYY() {
  var ahora = new Date();
  var opciones = {
    timeZone: "America/Santiago",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  };
  // Formatter produce "14/04/2026" en es-CL con timeZone
  return new Intl.DateTimeFormat("es-CL", opciones).format(ahora);
}

// =====================================
// FUNCIÓN PRINCIPAL (doPost)
// =====================================

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const action = payload.action;

    switch (action) {
      case "getData":
        return ContentService.createTextOutput(
          JSON.stringify(getData())
        ).setMimeType(ContentService.MimeType.JSON);

      case "acquireLock":
        return ContentService.createTextOutput(
          JSON.stringify(acquireLock(payload.userName, payload.timestamp))
        ).setMimeType(ContentService.MimeType.JSON);

      case "releaseLock":
        return ContentService.createTextOutput(
          JSON.stringify(releaseLock(payload.userName))
        ).setMimeType(ContentService.MimeType.JSON);

      case "getLockStatus":
        return ContentService.createTextOutput(
          JSON.stringify(getLockStatus())
        ).setMimeType(ContentService.MimeType.JSON);

      case "saveMovement":
        return ContentService.createTextOutput(
          JSON.stringify(saveMovement(payload.payload))
        ).setMimeType(ContentService.MimeType.JSON);

      default:
        return ContentService.createTextOutput(
          JSON.stringify({ success: false, message: "Acción no reconocida" })
        ).setMimeType(ContentService.MimeType.JSON);
    }
  } catch (error) {
    return ContentService.createTextOutput(
      JSON.stringify({
        success: false,
        message: "Error: " + error.toString(),
      })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

// =====================================
// FUNCIONES DE DATOS
// =====================================

function getData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // Obtener inventario
  const inventarioSheet = ss.getSheetByName(SHEET_INVENTARIO);
  const inventarioData = inventarioSheet.getDataRange().getValues();
  const inventario = inventarioData
    .slice(1)
    .map((row) => ({
      codigo: row[0] || "",
      descripcion: row[1] || "",
      categoria: row[2] || "",
      stockActual: row[3] || 0,
      stockMinimo: row[4] || 0,
      ultimoMovimiento: row[5] ? String(row[5]) : "",
    }))
    .filter((item) => item.codigo); // Filtrar filas vacías

  // Obtener historial
  const historialSheet = ss.getSheetByName(SHEET_HISTORIAL);
  const historialData = historialSheet.getDataRange().getValues();
  const historial = historialData
    .slice(1)
    .map((row) => ({
      fecha: row[0] ? String(row[0]) : "",
      codigo: row[1] || "",
      descripcion: row[2] || "",
      categoria: row[3] || "",
      tipo: row[4] || "",
      cantidad: row[5] || 0,
      responsable: row[6] || "",
      stockAntes: row[7] || 0,
      stockDespues: row[8] || 0,
      observacion: row[9] || "",
    }))
    .filter((item) => item.codigo); // Filtrar filas vacías

  return {
    success: true,
    inventory: inventario,
    history: historial,
  };
}

// =====================================
// FUNCIONES DE LOCK
// =====================================

function acquireLock(userName, timestamp) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const lockSheet = ss.getSheetByName(SHEET_LOCK);
  const lockData = lockSheet.getDataRange().getValues();

  // Verificar si hay un lock activo
  if (lockData.length > 1) {
    const lastLock = lockData[lockData.length - 1];
    const lockTime = new Date(lastLock[1]).getTime();
    const now = new Date(timestamp).getTime();

    if (now - lockTime < LOCK_TIMEOUT) {
      return {
        success: false,
        message: `El inventario está siendo modificado por ${lastLock[0]}`,
      };
    }
  }

  lockSheet.appendRow([userName, timestamp, true]);

  return {
    success: true,
    message: "Lock adquirido",
  };
}

function releaseLock(userName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const lockSheet = ss.getSheetByName(SHEET_LOCK);

  const lockData = lockSheet.getDataRange().getValues();
  if (lockData.length > 1) {
    lockSheet.deleteRows(2, lockData.length - 1);
  }

  return {
    success: true,
    message: "Lock liberado",
  };
}

function getLockStatus() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const lockSheet = ss.getSheetByName(SHEET_LOCK);
  const lockData = lockSheet.getDataRange().getValues();

  if (lockData.length <= 1) {
    return {
      isLocked: false,
      lockedBy: null,
      timestamp: null,
    };
  }

  const lastLock = lockData[lockData.length - 1];
  const lockTime = new Date(lastLock[1]).getTime();
  const now = new Date().getTime();

  if (now - lockTime > LOCK_TIMEOUT) {
    return {
      isLocked: false,
      lockedBy: null,
      timestamp: null,
    };
  }

  return {
    isLocked: true,
    lockedBy: lastLock[0],
    timestamp: lastLock[1],
  };
}

// =====================================
// FUNCIONES DE MOVIMIENTO
// =====================================

function saveMovement(movement) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const inventarioSheet = ss.getSheetByName(SHEET_INVENTARIO);
  const historialSheet = ss.getSheetByName(SHEET_HISTORIAL);

  // Buscar producto en inventario
  const inventarioData = inventarioSheet.getDataRange().getValues();
  let productRow = -1;
  let stockAntes = 0;

  for (let i = 1; i < inventarioData.length; i++) {
    if (inventarioData[i][0] === movement.codigo) {
      productRow = i + 1;
      stockAntes = inventarioData[i][3];
      break;
    }
  }

  let stockDespues = stockAntes;

  if (movement.tipo === "entrada") {
    stockDespues = stockAntes + movement.cantidad;
  } else if (movement.tipo === "salida") {
    stockDespues = stockAntes - movement.cantidad;
    if (stockDespues < 0) {
      return {
        success: false,
        message: "Stock insuficiente para realizar la salida",
      };
    }
  } else if (movement.tipo === "ajuste") {
    stockDespues = movement.cantidad;
  }

  // Fecha solo DD/MM/YYYY, sin hora
  var fecha = movement.fecha || fechaDD_MM_YYYY();

  if (productRow > 0) {
    inventarioSheet.getRange(productRow, 4).setValue(stockDespues);
    inventarioSheet.getRange(productRow, 6).setValue(fecha); // ultimoMovimiento
  } else {
    inventarioSheet.appendRow([
      movement.codigo,
      movement.descripcion,
      movement.categoria,
      stockDespues,
      movement.stockMinimo,
      fecha,
    ]);
  }

  historialSheet.appendRow([
    fecha,
    movement.codigo,
    movement.descripcion,
    movement.categoria,
    movement.tipo,
    movement.cantidad,
    movement.responsable,
    stockAntes,
    stockDespues,
    movement.observacion,
  ]);

  return {
    success: true,
    message: "Movimiento guardado exitosamente",
  };
}

// =====================================
// FUNCIÓN DE PRUEBA (Opcional)
// =====================================

function testScript() {
  const result = getData();
  Logger.log("Datos cargados:");
  Logger.log("Inventario: " + result.inventory.length + " productos");
  Logger.log("Historial: " + result.history.length + " movimientos");
}
