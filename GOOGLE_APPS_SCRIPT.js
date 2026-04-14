// =====================================
// INVENTARIO MULTIUSUARIO - GOOGLE APPS SCRIPT
// =====================================
// Copia este código completo en tu Google Apps Script
// Extensiones > Apps Script en tu hoja de cálculo

const SHEET_INVENTARIO = "Inventario";
const SHEET_HISTORIAL = "Historial";
const SHEET_LOCK = "Lock";
const LOCK_TIMEOUT = 30000; // 30 segundos

// Correo que recibe las alertas de stock bajo / sin stock
const EMAIL_ALERTA = "diego.cabrera@tooltek.cl";

// =====================================
// HELPER: Fecha local DD/MM/YYYY (sin hora)
// =====================================

function fechaDD_MM_YYYY() {
  var ahora = new Date();
  var opciones = {
    timeZone: "America/Santiago",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  };
  return new Intl.DateTimeFormat("es-CL", opciones).format(ahora);
}

// =====================================
// HELPER: Enviar alerta de stock por correo
// =====================================

function enviarAlertaStock(producto, responsable, fecha) {
  try {
    var codigo = producto["codigo"] || "";
    var descripcion = producto["descripcion"] || "";
    var categoria = producto["categoria"] || "";
    var stockDespues = producto["stockDespues"] || 0;
    var stockMinimo = producto["stockMinimo"] || 0;

    var sinStock = stockDespues <= 0;
    var asunto = sinStock
      ? "SIN STOCK: " + descripcion + " [" + codigo + "]"
      : "Stock bajo: " + descripcion + " [" + codigo + "]";

    var estadoTexto = sinStock ? "SIN STOCK" : "BAJO MINIMO";
    var estadoColor = sinStock ? "#dc2626" : "#d97706";

    var cuerpo = "<div style='font-family:Arial,sans-serif;max-width:600px;margin:0 auto;'>"
      + "<div style='background:#1e3a5f;padding:20px 24px;border-radius:8px 8px 0 0;'>"
      + "<h2 style='color:#ffffff;margin:0;font-size:18px;'>Alerta de Inventario</h2>"
      + "<p style='color:#93c5fd;margin:4px 0 0;font-size:13px;'>Sistema Inventario Utiles de Aseo - Tooltek</p>"
      + "</div>"
      + "<div style='background:#f8fafc;padding:24px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px;'>"
      + "<table style='width:100%;border-collapse:collapse;'>"
      + "<tr><td style='padding:8px 0;color:#64748b;font-size:13px;width:140px;'>Estado</td>"
      + "<td><span style='background:" + estadoColor + ";color:#fff;padding:3px 10px;border-radius:4px;font-size:13px;font-weight:bold;'>" + estadoTexto + "</span></td></tr>"
      + "<tr><td style='padding:8px 0;color:#64748b;font-size:13px;'>Codigo</td>"
      + "<td style='font-family:monospace;font-size:14px;color:#1e293b;'>" + codigo + "</td></tr>"
      + "<tr><td style='padding:8px 0;color:#64748b;font-size:13px;'>Descripcion</td>"
      + "<td style='font-size:14px;color:#1e293b;font-weight:bold;'>" + descripcion + "</td></tr>"
      + "<tr><td style='padding:8px 0;color:#64748b;font-size:13px;'>Categoria</td>"
      + "<td style='font-size:14px;color:#1e293b;'>" + categoria + "</td></tr>"
      + "<tr><td style='padding:8px 0;color:#64748b;font-size:13px;'>Stock actual</td>"
      + "<td style='font-size:22px;font-weight:bold;color:" + estadoColor + ";'>" + stockDespues + "</td></tr>"
      + "<tr><td style='padding:8px 0;color:#64748b;font-size:13px;'>Stock minimo</td>"
      + "<td style='font-size:14px;color:#475569;'>" + stockMinimo + "</td></tr>"
      + "<tr><td style='padding:8px 0;color:#64748b;font-size:13px;'>Registrado por</td>"
      + "<td style='font-size:14px;color:#1e293b;'>" + responsable + "</td></tr>"
      + "<tr><td style='padding:8px 0;color:#64748b;font-size:13px;'>Fecha</td>"
      + "<td style='font-size:14px;color:#1e293b;'>" + fecha + "</td></tr>"
      + "</table>"
      + "<p style='margin-top:20px;font-size:12px;color:#94a3b8;'>Este correo fue generado automaticamente por el sistema de inventario.</p>"
      + "</div>"
      + "</div>";

    MailApp.sendEmail({
      to: EMAIL_ALERTA,
      subject: asunto,
      htmlBody: cuerpo
    });

    Logger.log("Alerta enviada OK: " + asunto);
  } catch (err) {
    Logger.log("Error enviando alerta: " + err.toString());
  }
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
          JSON.stringify({ success: false, message: "Accion no reconocida" })
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
    .filter((item) => item.codigo);

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
    .filter((item) => item.codigo);

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

  if (lockData.length > 1) {
    const lastLock = lockData[lockData.length - 1];
    const lockTime = new Date(lastLock[1]).getTime();
    const now = new Date(timestamp).getTime();

    if (now - lockTime < LOCK_TIMEOUT) {
      return {
        success: false,
        message: "El inventario esta siendo modificado por " + lastLock[0],
      };
    }
  }

  lockSheet.appendRow([userName, timestamp, true]);
  return { success: true, message: "Lock adquirido" };
}

function releaseLock(userName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const lockSheet = ss.getSheetByName(SHEET_LOCK);

  const lockData = lockSheet.getDataRange().getValues();
  if (lockData.length > 1) {
    lockSheet.deleteRows(2, lockData.length - 1);
  }

  return { success: true, message: "Lock liberado" };
}

function getLockStatus() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const lockSheet = ss.getSheetByName(SHEET_LOCK);
  const lockData = lockSheet.getDataRange().getValues();

  if (lockData.length <= 1) {
    return { isLocked: false, lockedBy: null, timestamp: null };
  }

  const lastLock = lockData[lockData.length - 1];
  const lockTime = new Date(lastLock[1]).getTime();
  const now = new Date().getTime();

  if (now - lockTime > LOCK_TIMEOUT) {
    return { isLocked: false, lockedBy: null, timestamp: null };
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

  const inventarioData = inventarioSheet.getDataRange().getValues();
  let productRow = -1;
  let stockAntes = 0;
  let stockMinimo = movement.stockMinimo || 0;

  for (let i = 1; i < inventarioData.length; i++) {
    if (inventarioData[i][0] === movement.codigo) {
      productRow = i + 1;
      stockAntes = inventarioData[i][3];
      stockMinimo = inventarioData[i][4] || movement.stockMinimo || 0;
      break;
    }
  }

  let stockDespues = stockAntes;

  if (movement.tipo === "entrada") {
    stockDespues = stockAntes + movement.cantidad;
  } else if (movement.tipo === "salida") {
    stockDespues = stockAntes - movement.cantidad;
    if (stockDespues < 0) {
      return { success: false, message: "Stock insuficiente para realizar la salida" };
    }
  } else if (movement.tipo === "ajuste") {
    stockDespues = movement.cantidad;
  }

  var fecha = movement.fecha || fechaDD_MM_YYYY();

  if (productRow > 0) {
    inventarioSheet.getRange(productRow, 4).setValue(stockDespues);
    inventarioSheet.getRange(productRow, 6).setValue(fecha);
  } else {
    inventarioSheet.appendRow([
      movement.codigo,
      movement.descripcion,
      movement.categoria,
      stockDespues,
      stockMinimo,
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

  // Enviar alerta si el stock quedo en 0 o por debajo del minimo
  if (stockDespues <= stockMinimo) {
    var productoAlerta = {};
    productoAlerta["codigo"] = movement.codigo;
    productoAlerta["descripcion"] = movement.descripcion;
    productoAlerta["categoria"] = movement.categoria;
    productoAlerta["stockDespues"] = stockDespues;
    productoAlerta["stockMinimo"] = stockMinimo;
    enviarAlertaStock(productoAlerta, movement.responsable, fecha);
  }

  return { success: true, message: "Movimiento guardado exitosamente" };
}

// =====================================
// FUNCIONES DE PRUEBA
// =====================================

function testScript() {
  const result = getData();
  Logger.log("Datos cargados:");
  Logger.log("Inventario: " + result.inventory.length + " productos");
  Logger.log("Historial: " + result.history.length + " movimientos");
}

function testAlertaStock() {
  var p = {};
  p["codigo"] = "PROD-001";
  p["descripcion"] = "Escoba Industrial";
  p["categoria"] = "Limpieza";
  p["stockDespues"] = 2;
  p["stockMinimo"] = 5;
  enviarAlertaStock(p, "Diego Cabrera", fechaDD_MM_YYYY());
  Logger.log("Correo de prueba enviado a " + EMAIL_ALERTA);
}
