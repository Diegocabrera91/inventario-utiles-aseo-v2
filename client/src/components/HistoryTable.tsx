import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";

interface Movement {
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

interface HistoryTableProps {
  movements: Movement[];
}

function formatFecha(fecha: string): string {
  try {
    const date = new Date(fecha);
    if (isNaN(date.getTime())) return fecha;
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  } catch {
    return fecha;
  }
}

export default function HistoryTable({ movements }: HistoryTableProps) {
  const getMovementBadge = (tipo: string) => {
    switch (tipo.toLowerCase()) {
      case "entrada":
        return {
          label: "Entrada",
          variant: "default" as const,
          icon: ArrowDown,
          color: "text-green-600",
        };
      case "salida":
        return {
          label: "Salida",
          variant: "secondary" as const,
          icon: ArrowUp,
          color: "text-red-600",
        };
      case "ajuste":
        return {
          label: "Ajuste",
          variant: "outline" as const,
          icon: Minus,
          color: "text-blue-600",
        };
      default:
        return {
          label: tipo,
          variant: "secondary" as const,
          icon: Minus,
          color: "text-gray-600",
        };
    }
  };

  if (movements.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No hay movimientos registrados</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Fecha</TableHead>
            <TableHead>Código</TableHead>
            <TableHead>Descripción</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead className="text-right">Cantidad</TableHead>
            <TableHead>Responsable</TableHead>
            <TableHead className="text-right">Stock Antes</TableHead>
            <TableHead className="text-right">Stock Después</TableHead>
            <TableHead>Observación</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {movements.map((movement, index) => {
            const badge = getMovementBadge(movement.tipo);
            const BadgeIcon = badge.icon;

            return (
              <TableRow key={index}>
                <TableCell className="text-sm text-gray-600">
                  {formatFecha(movement.fecha)}
                </TableCell>
                <TableCell className="font-mono text-sm">{movement.codigo}</TableCell>
                <TableCell className="font-medium">{movement.descripcion}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <BadgeIcon className={`w-4 h-4 ${badge.color}`} />
                    <Badge variant={badge.variant}>{badge.label}</Badge>
                  </div>
                </TableCell>
                <TableCell className="text-right font-semibold">
                  {movement.cantidad}
                </TableCell>
                <TableCell className="text-sm">{movement.responsable}</TableCell>
                <TableCell className="text-right text-gray-600">
                  {movement.stockAntes}
                </TableCell>
                <TableCell className="text-right font-semibold">
                  {movement.stockDespues}
                </TableCell>
                <TableCell className="text-sm text-gray-600 max-w-xs truncate">
                  {movement.observacion || "—"}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
