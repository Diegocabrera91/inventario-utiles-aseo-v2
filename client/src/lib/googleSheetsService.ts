/**
 * Servicio de sincronización con Google Sheets
 *
 * Este servicio maneja:
 * - Carga de datos (inventario e historial)
 * - Guardado de movimientos
 * - Control de locks para evitar conflictos de concurrencia
 */

const API_URL = "https://script.google.com/macros/s/AKfycbz6dhGOAhmPuds6_xLrQHiRwO3z2wu8EJJAG0Js4ifPimJuNAX1O7LUTBN0HfszZOeByA/exec";

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
 * Devuelve la fecha actual local del usuario en formato DD/MM/YYYY.
 * Usa el huso horario del dispositivo, no UTC.
 */
function fechaLocal(): string {
  const hoy = new Date();
  const dia = String(hoy.getDate()).padStart(2, "0");
  const mes = String(hoy.getMonth() + 1).padStart(2, "0");
  const anio = hoy.getFullYear();
  return `${dia}/${mes}/${anio}`;
}

/**
 * Normaliza una cadena de fecha a DD/MM/YYYY.
 * Acepta ISO (2026-04-14T...), YYYY-MM-DD o DD/MM/YYYY.
 * Si no reconoce el formato, devuelve el valor original.
 */
export function formatearFecha(fecha: string): string {
  if (!fecha) return fecha;

  // Ya está en DD/MM/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(fecha)) return fecha;

  // ISO (2026-04-14T...) o YYYY-MM-DD
  const match = fecha.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return `${match[3]}/${match[2]}/${match[1]}`;
  }

  return fecha;
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

    // Normalizar fechas del historial
    const history: Movement[] = (data.history || []).map((m: Movement) => ({
      ...m,
      fecha: formatearFecha(m.fecha),
    }));

    // Normalizar ultimoMovimiento del inventario
    const inventory: Product[] = (data.inventory || []).map((p: Product) => ({
      ...p,
      ultimoMovimiento: p.ultimoMovimiento
        ? formatearFecha(p.ultimoMovimiento)
        : "",
    }));

    return { inventory, history };
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
            fecha: fechaLocal(),
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
  link.download = `inventario_${fechaLocal().split("/").reverse().join("-")}.csv`;
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
    formatearFecha(m.fecha),
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
  link.download = `historial_${fechaLocal().split("/").reverse().join("-")}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
