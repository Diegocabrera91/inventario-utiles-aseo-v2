import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2, AlertTriangle } from "lucide-react";

interface Product {
  codigo: string;
  descripcion: string;
  categoria: string;
  stockActual: number;
  stockMinimo: number;
  ultimoMovimiento: string;
}

interface InventoryTableProps {
  products: Product[];
}

export default function InventoryTable({ products }: InventoryTableProps) {
  const getStockStatus = (actual: number, minimo: number) => {
    if (actual <= 0) {
      return {
        label: "Sin stock",
        variant: "destructive" as const,
        icon: AlertCircle,
      };
    }
    if (actual <= minimo) {
      return {
        label: "Bajo mínimo",
        variant: "secondary" as const,
        icon: AlertTriangle,
      };
    }
    return {
      label: "Normal",
      variant: "default" as const,
      icon: CheckCircle2,
    };
  };

  if (products.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No hay productos en el inventario</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Código</TableHead>
            <TableHead>Descripción</TableHead>
            <TableHead>Categoría</TableHead>
            <TableHead className="text-right">Stock Actual</TableHead>
            <TableHead className="text-right">Stock Mínimo</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Último Movimiento</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.map((product) => {
            const status = getStockStatus(product.stockActual, product.stockMinimo);
            const StatusIcon = status.icon;

            return (
              <TableRow key={product.codigo}>
                <TableCell className="font-mono text-sm">{product.codigo}</TableCell>
                <TableCell className="font-medium">{product.descripcion}</TableCell>
                <TableCell className="text-sm text-gray-600">
                  {product.categoria || "—"}
                </TableCell>
                <TableCell className="text-right font-semibold">
                  {product.stockActual}
                </TableCell>
                <TableCell className="text-right text-gray-600">
                  {product.stockMinimo}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <StatusIcon className="w-4 h-4" />
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </div>
                </TableCell>
                <TableCell className="text-sm text-gray-600">
                  {product.ultimoMovimiento || "—"}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
