import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CheckCircle, AlertCircle, Camera } from "lucide-react";
import BarcodeScanner from "./BarcodeScanner";
import { saveMovement } from "@/lib/googleSheetsService";

interface InventoryFormProps {
  userName: string;
  onMovementSuccess: () => void;
  isLocked: boolean;
}

export default function InventoryForm({
  userName,
  onMovementSuccess,
  isLocked,
}: InventoryFormProps) {
  const [codigo, setCodigo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [categoria, setCategoria] = useState("");
  const [stockMinimo, setStockMinimo] = useState("0");
  const [tipoMovimiento, setTipoMovimiento] = useState("entrada");
  const [cantidad, setCantidad] = useState("1");
  const [observacion, setObservacion] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);

  const handleBarcodeDetected = (code: string) => {
    setCodigo(code);
    setScannerOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    // Validaciones
    if (!codigo.trim()) {
      setMessage({ type: "error", text: "El código es requerido" });
      return;
    }
    if (!descripcion.trim()) {
      setMessage({ type: "error", text: "La descripción es requerida" });
      return;
    }
    if (parseInt(cantidad) <= 0) {
      setMessage({ type: "error", text: "La cantidad debe ser mayor a 0" });
      return;
    }

    setLoading(true);

    try {
      await saveMovement(
        {
          codigo: codigo.trim(),
          descripcion: descripcion.trim(),
          categoria: categoria.trim(),
          stockMinimo: parseInt(stockMinimo) || 0,
          tipo: tipoMovimiento,
          cantidad: parseInt(cantidad),
          responsable: userName,
          observacion: observacion.trim(),
        },
        userName
      );

      setMessage({
        type: "success",
        text: `Movimiento registrado exitosamente por ${userName}`,
      });

      // Limpiar formulario
      setCodigo("");
      setDescripcion("");
      setCategoria("");
      setStockMinimo("0");
      setTipoMovimiento("entrada");
      setCantidad("1");
      setObservacion("");

      // Recargar datos
      onMovementSuccess();
    } catch (error: any) {
      const msg = error?.message || "";
      if (msg.includes("lock")) {
        setMessage({
          type: "error",
          text: "Otro usuario está guardando en este momento. Espera unos segundos e intenta de nuevo.",
        });
      } else if (
        msg.includes("Failed to fetch") ||
        msg.includes("NetworkError") ||
        msg.includes("Load failed")
      ) {
        setMessage({
          type: "error",
          text: "Error de conexión. Verifica tu internet e intenta de nuevo.",
        });
      } else {
        setMessage({
          type: "error",
          text: msg || "Error al registrar el movimiento. Intenta de nuevo.",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Registrar Movimiento</CardTitle>
        <CardDescription>
          Registra entradas, salidas o ajustes al inventario
        </CardDescription>
      </CardHeader>
      <CardContent>
        {message && (
          <Alert
            className={`mb-6 ${
              message.type === "success"
                ? "bg-green-50 border-green-200"
                : message.type === "error"
                  ? "bg-red-50 border-red-200"
                  : "bg-blue-50 border-blue-200"
            }`}
          >
            {message.type === "success" ? (
              <CheckCircle className="h-4 w-4 text-green-600" />
            ) : (
              <AlertCircle className="h-4 w-4 text-red-600" />
            )}
            <AlertDescription
              className={
                message.type === "success"
                  ? "text-green-800"
                  : message.type === "error"
                    ? "text-red-800"
                    : "text-blue-800"
              }
            >
              {message.text}
            </AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Código */}
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="codigo">Código de Barras *</Label>
              <div className="flex gap-2">
                <Input
                  id="codigo"
                  type="text"
                  placeholder="Ej: 001, SKU-123..."
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value)}
                  disabled={isLocked || loading}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setScannerOpen(true)}
                  disabled={isLocked || loading}
                  title="Escanear código de barras"
                >
                  <Camera className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Descripción */}
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="descripcion">Descripción *</Label>
              <Input
                id="descripcion"
                type="text"
                placeholder="Ej: Papel higiénico..."
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                disabled={isLocked || loading}
              />
            </div>

            {/* Categoría */}
            <div className="space-y-2">
              <Label htmlFor="categoria">Categoría</Label>
              <Input
                id="categoria"
                type="text"
                placeholder="Ej: Baño, Limpieza..."
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                disabled={isLocked || loading}
              />
            </div>

            {/* Stock Mínimo */}
            <div className="space-y-2">
              <Label htmlFor="stockMinimo">Stock Mínimo</Label>
              <Input
                id="stockMinimo"
                type="number"
                placeholder="0"
                value={stockMinimo}
                onChange={(e) => setStockMinimo(e.target.value)}
                disabled={isLocked || loading}
              />
            </div>

            {/* Tipo de Movimiento */}
            <div className="space-y-2">
              <Label htmlFor="tipo">Tipo de Movimiento *</Label>
              <Select
                value={tipoMovimiento}
                onValueChange={setTipoMovimiento}
                disabled={isLocked || loading}
              >
                <SelectTrigger id="tipo">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="entrada">Entrada</SelectItem>
                  <SelectItem value="salida">Salida</SelectItem>
                  <SelectItem value="ajuste">Ajuste</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Cantidad */}
            <div className="space-y-2">
              <Label htmlFor="cantidad">Cantidad *</Label>
              <Input
                id="cantidad"
                type="number"
                placeholder="1"
                value={cantidad}
                onChange={(e) => setCantidad(e.target.value)}
                disabled={isLocked || loading}
              />
            </div>
          </div>

          {/* Observación */}
          <div className="space-y-2">
            <Label htmlFor="observacion">Observación</Label>
            <Textarea
              id="observacion"
              placeholder="Ej: Reposición mensual, entrega a baño 2..."
              value={observacion}
              onChange={(e) => setObservacion(e.target.value)}
              disabled={isLocked || loading}
              rows={3}
            />
          </div>

          {/* Botones */}
          <div className="flex gap-3 pt-4">
            <Button
              type="submit"
              disabled={isLocked || loading}
              className="flex-1 bg-blue-600 hover:bg-blue-700"
              size="lg"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : (
                "Aplicar Movimiento"
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setCodigo("");
                setDescripcion("");
                setCategoria("");
                setStockMinimo("0");
                setTipoMovimiento("entrada");
                setCantidad("1");
                setObservacion("");
                setMessage(null);
              }}
              disabled={isLocked || loading}
            >
              Limpiar
            </Button>
          </div>
        </form>

        <BarcodeScanner
          isOpen={scannerOpen}
          onClose={() => setScannerOpen(false)}
          onBarcodeDetected={handleBarcodeDetected}
        />
      </CardContent>
    </Card>
  );
}
