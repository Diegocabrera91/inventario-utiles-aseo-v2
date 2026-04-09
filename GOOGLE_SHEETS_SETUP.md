# Configuración de Google Sheets y Google Apps Script

Este documento explica cómo configurar Google Sheets y Google Apps Script para que el inventario multiusuario funcione correctamente.

## Paso 1: Crear una hoja de cálculo en Google Sheets

1. Ve a [Google Sheets](https://sheets.google.com) y crea una nueva hoja de cálculo
2. Renómbrala a "Inventario de Útiles de Aseo"
3. Crea tres hojas (pestañas):
   - **Inventario**: Para almacenar los productos
   - **Historial**: Para registrar todos los movimientos
   - **Lock**: Para controlar el acceso concurrente

### Estructura de la hoja "Inventario"

| Código | Descripción | Categoría | Stock Actual | Stock Mínimo | Último Movimiento |
|--------|-------------|-----------|--------------|--------------|-------------------|
| 001    | Papel higiénico | Baño | 50 | 10 | 2026-04-08 10:30 |

### Estructura de la hoja "Historial"

| Fecha | Código | Descripción | Categoría | Tipo | Cantidad | Responsable | Stock Antes | Stock Después | Observación |
|-------|--------|-------------|-----------|------|----------|-------------|-------------|---------------|-------------|
| 2026-04-08 10:30 | 001 | Papel higiénico | Baño | Entrada | 50 | Juan | 0 | 50 | Reposición mensual |

### Estructura de la hoja "Lock"

| Usuario | Timestamp | Activo |
|---------|-----------|--------|
| | | |

## Paso 2: Crear el Google Apps Script

1. En la hoja de cálculo, ve a **Extensiones > Apps Script**
2. Elimina el código por defecto y reemplázalo con el siguiente:

```javascript
// =====================================
// INVENTARIO MULTIUSUARIO - GOOGLE APPS SCRIPT
// =====================================

const SHEET_INVENTARIO = "Inventario";
const SHEET_HISTORIAL = "Historial";
const SHEET_LOCK = "Lock";
const LOCK_TIMEOUT = 30000; // 30 segundos

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
  const inventario = inventarioData.slice(1).map((row) => ({
    codigo: row[0],
    descripcion: row[1],
    categoria: row[2],
    stockActual: row[3],
    stockMinimo: row[4],
    ultimoMovimiento: row[5],
  }));

  // Obtener historial
  const historialSheet = ss.getSheetByName(SHEET_HISTORIAL);
  const historialData = historialSheet.getDataRange().getValues();
  const historial = historialData.slice(1).map((row) => ({
    fecha: row[0],
    codigo: row[1],
    descripcion: row[2],
    categoria: row[3],
    tipo: row[4],
    cantidad: row[5],
    responsable: row[6],
    stockAntes: row[7],
    stockDespues: row[8],
    observacion: row[9],
  }));

  return {
    success: true,
    inventario,
    historial,
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
      // Lock aún activo
      return {
        success: false,
        message: `El inventario está siendo modificado por ${lastLock[0]}`,
      };
    }
  }

  // Crear nuevo lock
  lockSheet.appendRow([userName, timestamp, true]);

  return {
    success: true,
    message: "Lock adquirido",
  };
}

function releaseLock(userName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const lockSheet = ss.getSheetByName(SHEET_LOCK);

  // Limpiar locks antiguos
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
    // Lock expirado
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
      productRow = i + 1; // Google Sheets usa índices de 1
      stockAntes = inventarioData[i][3];
      break;
    }
  }

  let stockDespues = stockAntes;

  // Calcular nuevo stock
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

  // Actualizar o crear producto
  if (productRow > 0) {
    inventarioSheet.getRange(productRow, 4).setValue(stockDespues);
    inventarioSheet.getRange(productRow, 6).setValue(new Date().toLocaleString());
  } else {
    // Crear nuevo producto
    inventarioSheet.appendRow([
      movement.codigo,
      movement.descripcion,
      movement.categoria,
      stockDespues,
      movement.stockMinimo,
      new Date().toLocaleString(),
    ]);
  }

  // Registrar en historial
  historialSheet.appendRow([
    new Date().toLocaleString(),
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
```

## Paso 3: Desplegar el Apps Script

1. En el editor de Apps Script, haz clic en **Implementar > Nueva implementación**
2. Selecciona **Tipo: Aplicación web**
3. Configura:
   - **Ejecutar como**: Tu cuenta de Google
   - **Quién tiene acceso**: Cualquiera
4. Copia la URL de implementación (se verá algo como: `https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec`)

## Paso 4: Configurar la URL en la aplicación

1. En el archivo `.env` o `.env.local` del proyecto, añade:
   ```
   VITE_GOOGLE_SHEETS_API_URL=https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec
   ```

2. Reemplaza `YOUR_SCRIPT_ID` con el ID real de tu script (está en la URL de implementación)

## Paso 5: Probar la aplicación

1. Inicia la aplicación en desarrollo: `npm run dev`
2. Ingresa con un nombre de usuario
3. Intenta registrar un movimiento
4. Verifica que los datos se guarden en Google Sheets

## Notas Importantes

- El **lock** expira después de 30 segundos. Si un usuario se desconecta sin liberar el lock, otro usuario podrá continuar después de ese tiempo.
- Los datos se sincronizan en **tiempo real** con Google Sheets.
- Solo **un usuario a la vez** puede hacer cambios en el inventario.
- El sistema es **completamente multiusuario** sin requerir autenticación.

## Solución de Problemas

### "Error: No se pudo cargar los datos"
- Verifica que la URL del Google Apps Script sea correcta
- Asegúrate de que el script esté desplegado como "Aplicación web"
- Comprueba que el acceso sea "Cualquiera"

### "El inventario está siendo modificado por..."
- Espera 30 segundos para que el lock expire
- O pide al usuario que recargue la página

### Los datos no se guardan
- Verifica que las hojas de cálculo tengan los nombres correctos: "Inventario", "Historial", "Lock"
- Comprueba que los encabezados estén en la primera fila
