/**
 * Servicio de sincronización con Google Sheets
 * 
 * Este servicio maneja:
 * - Carga de datos (inventario e historial)
 * - Guardado de movimientos
 * - Control de locks para evitar conflictos de concurrencia
 */

const API_URL = import.meta.env.VITE_GOOGLE_SHEETS_API_URL || 
  "https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec";

export interface Product {
  codigo: string;
  descripcion: string;
  categoria: string;
  stockActual: number;
  stockMinimo: number;
  ultimoMovimiento: string;
}

export interface Movement {
  fecha: string;
  codigo: string;
  descripcion: string;
  categoria: string;
  tipo: string;
  cantidad: number;
  responsable: string;
  observacion: string;
  stockAntes: number;
  stockDespues: number;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
}

/**
 * Carga el inventario e historial desde Google Sheets
 */
export async function loadData(): Promise<{
  inventory: Product[];
  history: Movement[];
}> {
  try {
    const response = await fetch(`${API_URL}?action=getData`);
    const data = await response.json();

    if (!data.success) {
      throw new Error(data.message || "Error al cargar datos");
    }

    return {
      inventory: data.inventory || [],
      history: data.history || [],
    };
  } catch (error) {
    console.error("Error loading data:", error);
    throw error;
  }
}

/**
 * Intenta adquirir un lock para realizar un movimiento
 */
export async function acquireLock(userName: string): Promise<boolean> {
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        action: "acquireLock",
        userName,
        timestamp: new Date().toISOString(),
      }),
    });

    const data = await response.json();
    return data.success;
  } catch (error) {
    console.error("Error acquiring lock:", error);
    return false;
  }
}

/**
 * Libera el lock después de completar un movimiento
 */
export async function releaseLock(userName: string): Promise<boolean> {
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        action: "releaseLock",
        userName,
      }),
    });

    const data = await response.json();
    return data.success;
  } catch (error) {
    console.error("Error releasing lock:", error);
    return false;
  }
}

/**
 * Obtiene el estado actual del lock
 */
export async function getLockStatus(): Promise<{
  isLocked: boolean;
  lockedBy: string | null;
  timestamp: string | null;
}> {
  try {
    const response = await fetch(`${API_URL}?action=getLockStatus`);
    const data = await response.json();

    return {
      isLocked: data.isLocked || false,
      lockedBy: data.lockedBy || null,
      timestamp: data.timestamp || null,
    };
  } catch (error) {
    console.error("Error getting lock status:", error);
    return {
      isLocked: false,
      lockedBy: null,
      timestamp: null,
    };
  }
}

/**
 * Guarda un movimiento en Google Sheets
 */
export async function saveMovement(
  movement: {
    codigo: string;
    descripcion: string;
    categoria: string;
    stockMinimo: number;
    tipo: string;
    cantidad: number;
    responsable: string;
    observacion: string;
  },
  userName: string
): Promise<boolean> {
  try {
    // Primero intenta adquirir el lock
    const lockAcquired = await acquireLock(userName);
    if (!lockAcquired) {
      throw new Error("No se pudo adquirir el lock. Intenta de nuevo.");
    }

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({
          action: "saveMovement",
          payload: {
            ...movement,
            fecha: new Date().toISOString(),
            responsable: userName,
          },
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || "Error al guardar movimiento");
      }

      return true;
    } finally {
      // Siempre libera el lock
      await releaseLock(userName);
    }
  } catch (error) {
    console.error("Error saving movement:", error);
    throw error;
  }
}

/**
 * Exporta el inventario a CSV
 */
export function exportInventoryToCSV(products: Product[]): void {
  const headers = [
    "Código",
    "Descripción",
    "Categoría",
    "Stock Actual",
    "Stock Mínimo",
    "Último Movimiento",
  ];

  const rows = products.map((p) => [
    p.codigo,
    p.descripcion,
    p.categoria,
    p.stockActual,
    p.stockMinimo,
    p.ultimoMovimiento,
  ]);

  const csv = [
    headers.join(","),
    ...rows.map((r) =>
      r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
    ),
  ].join("\n");

  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `inventario_${new Date().toISOString().split("T")[0]}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Exporta el historial a CSV
 */
export function exportHistoryToCSV(movements: Movement[]): void {
  const headers = [
    "Fecha",
    "Código",
    "Descripción",
    "Categoría",
    "Tipo",
    "Cantidad",
    "Responsable",
    "Stock Antes",
    "Stock Después",
    "Observación",
  ];

  const rows = movements.map((m) => [
    m.fecha,
    m.codigo,
    m.descripcion,
    m.categoria,
    m.tipo,
    m.cantidad,
    m.responsable,
    m.stockAntes,
    m.stockDespues,
    m.observacion,
  ]);

  const csv = [
    headers.join(","),
    ...rows.map((r) =>
      r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
    ),
  ].join("\n");

  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `historial_${new Date().toISOString().split("T")[0]}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
