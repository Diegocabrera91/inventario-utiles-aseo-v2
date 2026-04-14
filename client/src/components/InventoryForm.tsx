import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  CheckCircle,
  AlertCircle,
  Camera,
  PackageCheck,
  PackagePlus,
} from "lucide-react";
import BarcodeScanner from "./BarcodeScanner";
import { saveMovement, Product } from "@/lib/googleSheetsService";

interface InventoryFormProps {
  userName: string;
  onMovementSuccess: () => void;
  isLocked: boolean;
  inventory: Product[];
}

export default function InventoryForm({
  userName,
  onMovementSuccess,
  isLocked,
  inventory,
}: InventoryFormProps) {
  const [codigo, setCodigo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [categoria, setCategoria] = useState("");
  const [stockMinimo, setStockMinimo] = useState("0");
  const [tipoMovimiento, setTipoMovimiento] = useState("salida");
  const [cantidad, setCantidad] = useState("1");
  const [observacion, setObservacion] = useState("");
  const [loading, setLoading] = useState(false);
  const [productoEncontrado, setProductoEncontrado] = useState<Product | null>(null);
  const [message, setMessage] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);

  // Buscar producto en inventario cada vez que cambia el código
  useEffect(() => {
    const codigoTrim = codigo.trim();
    if (!codigoTrim) {
      setProductoEncontrado(null);
      setDescripcion("");
      setCategoria("");
      setStockMinimo("0");
      return;
    }
    const encontrado = inventory.find(
      (p) => p.codigo.trim().toLowerCase() === codigoTrim.toLowerCase()
    );
    if (encontrado) {
      setProductoEncontrado(encontrado);
      setDescripcion(encontrado.descripcion);
      setCategoria(encontrado.categoria);
      setStockMinimo(String(encontrado.stockMinimo));
    } else {
      setProductoEncontrado(null);
      // Solo limpiar si venía de un producto previo encontrado
      setDescripcion((prev) => (prev && productoEncontrado ? "" : prev));
      setCategoria((prev) => (prev && productoEncontrado ? "" : prev));
      setStockMinimo((prev) => (prev !== "0" && productoEncontrado ? "0" : prev));
    }
  }, [codigo, inventory]);

  const handleBarcodeDetected = (code: string) => {
    setCodigo(code);
    setScannerOpen(false);
    // Enfocar cantidad automáticamente después del escaneo
    setTimeout(() => {
      const cantidadInput = document.getElementById("cantidad") as HTMLInputElement;
      if (cantidadInput) {
        cantidadInput.focus();
        cantidadInput.select();
      }
    }, 150);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

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
      setCantidad("1");
      setObservacion("");
      setProductoEncontrado(null);

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

  const esSalida = tipoMovimiento === "salida";

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
          {/* Tipo de Movimiento — siempre visible primero */}
          <div className="space-y-2">
            <Label htmlFor="tipo">Tipo de Movimiento *</Label>
            <Select
              value={tipoMovimiento}
              onValueChange={setTipoMovimiento}
              disabled={isLocked || loading}
              name="tipo"
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Código */}
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="codigo">Código de Barras *</Label>
              <div className="flex gap-2">
                <Input
                  id="codigo"
                  name="codigo"
                  type="text"
                  placeholder="Escanea o escribe el código..."
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value)}
                  disabled={isLocked || loading}
                  autoComplete="off"
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

              {/* Badge estado del producto */}
              {codigo.trim() && (
                <div className="flex items-center gap-2 pt-1">
                  {productoEncontrado ? (
                    <Badge className="bg-green-100 text-green-800 border-green-300 gap-1">
                      <PackageCheck className="w-3 h-3" />
                      Producto encontrado — Stock actual: {productoEncontrado.stockActual}
                    </Badge>
                  ) : (
                    <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300 gap-1">
                      <PackagePlus className="w-3 h-3" />
                      Producto nuevo — se creará al guardar
                    </Badge>
                  )}
                </div>
              )}
            </div>

            {/* En modo SALIDA: mostrar datos del producto como solo lectura */}
            {esSalida && productoEncontrado ? (
              <div className="md:col-span-2 rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-2">
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Datos del producto</p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                  <div>
                    <span className="text-gray-500">Descripción:</span>{" "}
                    <span className="font-medium text-gray-900">{productoEncontrado.descripcion}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Categoría:</span>{" "}
                    <span className="font-medium text-gray-900">{productoEncontrado.categoria || "—"}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Stock actual:</span>{" "}
                    <span className="font-semibold text-blue-700">{productoEncontrado.stockActual}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Stock mínimo:</span>{" "}
                    <span className="font-medium text-gray-900">{productoEncontrado.stockMinimo}</span>
                  </div>
                </div>
              </div>
            ) : (
              /* En modo ENTRADA / AJUSTE o producto nuevo: mostrar campos editables */
              <>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="descripcion">Descripción *</Label>
                  <Input
                    id="descripcion"
                    name="descripcion"
                    type="text"
                    placeholder="Ej: Papel higiénico..."
                    value={descripcion}
                    onChange={(e) => setDescripcion(e.target.value)}
                    disabled={isLocked || loading}
                    autoComplete="off"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="categoria">Categoría</Label>
                  <Input
                    id="categoria"
                    name="categoria"
                    type="text"
                    placeholder="Ej: Baño, Limpieza..."
                    value={categoria}
                    onChange={(e) => setCategoria(e.target.value)}
                    disabled={isLocked || loading}
                    autoComplete="off"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="stockMinimo">Stock Mínimo</Label>
                  <Input
                    id="stockMinimo"
                    name="stockMinimo"
                    type="number"
                    placeholder="0"
                    value={stockMinimo}
                    onChange={(e) => setStockMinimo(e.target.value)}
                    disabled={isLocked || loading}
                    autoComplete="off"
                  />
                </div>
              </>
            )}

            {/* Cantidad — siempre visible */}
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="cantidad">
                Cantidad *
                {esSalida && productoEncontrado && (
                  <span className="text-gray-400 font-normal ml-2 text-xs">
                    (máx. {productoEncontrado.stockActual})
                  </span>
                )}
              </Label>
              <Input
                id="cantidad"
                name="cantidad"
                type="number"
                min="1"
                max={esSalida && productoEncontrado ? productoEncontrado.stockActual : undefined}
                placeholder="1"
                value={cantidad}
                onChange={(e) => setCantidad(e.target.value)}
                disabled={isLocked || loading}
                autoComplete="off"
                className="text-lg font-semibold"
              />
            </div>
          </div>

          {/* Observación */}
          <div className="space-y-2">
            <Label htmlFor="observacion">Observación</Label>
            <Textarea
              id="observacion"
              name="observacion"
              placeholder="Ej: Entrega a baño 2, reposición mensual..."
              value={observacion}
              onChange={(e) => setObservacion(e.target.value)}
              disabled={isLocked || loading}
              rows={2}
              autoComplete="off"
            />
          </div>

          {/* Botones */}
          <div className="flex gap-3 pt-2">
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
                setCantidad("1");
                setObservacion("");
                setProductoEncontrado(null);
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
