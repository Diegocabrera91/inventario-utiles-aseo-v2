import { useState, useEffect, useCallback } from "react";
import { loadData, getLockStatus, Product, Movement } from "@/lib/googleSheetsService";

export function useInventory(userName: string | null) {
  const [inventory, setInventory] = useState<Product[]>([]);
  const [history, setHistory] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [lockUser, setLockUser] = useState<string | null>(null);

  // Cargar datos iniciales
  const fetchData = useCallback(async () => {
    if (!userName) return;

    setLoading(true);
    setError(null);

    try {
      const { inventory: inv, history: hist } = await loadData();
      setInventory(inv);
      setHistory(hist);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Error al cargar los datos del inventario"
      );
    } finally {
      setLoading(false);
    }
  }, [userName]);

  // Verificar estado del lock periódicamente
  const checkLockStatus = useCallback(async () => {
    try {
      const { isLocked: locked, lockedBy } = await getLockStatus();
      setIsLocked(locked);
      setLockUser(lockedBy);
    } catch (err) {
      console.error("Error checking lock status:", err);
    }
  }, []);

  // Cargar datos al montar el componente
  useEffect(() => {
    if (userName) {
      fetchData();
      // Verificar lock cada 2 segundos
      const interval = setInterval(checkLockStatus, 2000);
      return () => clearInterval(interval);
    }
  }, [userName, fetchData, checkLockStatus]);

  return {
    inventory,
    history,
    loading,
    error,
    isLocked,
    lockUser,
    refetch: fetchData,
  };
}
