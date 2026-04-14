import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, LogOut, Package, History, Download } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import InventoryForm from "@/components/InventoryForm";
import InventoryTable from "@/components/InventoryTable";
import HistoryTable from "@/components/HistoryTable";
import UserNameDialog from "@/components/UserNameDialog";
import { useInventory } from "@/hooks/useInventory";
import { exportInventoryToCSV, exportHistoryToCSV } from "@/lib/googleSheetsService";

export default function Home() {
  const [userName, setUserName] = useState<string | null>(null);
  const [showNameDialog, setShowNameDialog] = useState(false);
  const { inventory, history, loading, error, isLocked, lockUser, refetch } = useInventory(userName);

  useEffect(() => {
    const savedName = localStorage.getItem("inventarioUserName");
    if (savedName) {
      setUserName(savedName);
    } else {
      setShowNameDialog(true);
    }
  }, []);

  const handleNameSet = (name: string) => {
    setUserName(name);
    localStorage.setItem("inventarioUserName", name);
    setShowNameDialog(false);
  };

  const handleLogout = () => {
    setUserName(null);
    localStorage.removeItem("inventarioUserName");
    setShowNameDialog(true);
  };

  const handleExportInventory = () => {
    exportInventoryToCSV(inventory);
  };

  const handleExportHistory = () => {
    exportHistoryToCSV(history);
  };

  if (!userName) {
    return <UserNameDialog onNameSet={handleNameSet} />;
  }

  const stats = {
    totalProducts: inventory.length,
    totalUnits: inventory.reduce((sum, p) => sum + p.stockActual, 0),
    lowStock: inventory.filter(p => p.stockActual > 0 && p.stockActual <= p.stockMinimo).length,
    noStock: inventory.filter(p => p.stockActual <= 0).length,
  };

  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(135deg, #eaf3f9 0%, #d0e8f4 100%)" }}>
      {/* Header */}
      <header className="border-b border-gray-200 sticky top-0 z-40 shadow-sm" style={{ background: "#24638F" }}>
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Inventario de Útiles de Aseo</h1>
            <p className="text-sm" style={{ color: "#b8d4e8" }}>Tooltek — Gestión centralizada multiusuario</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium text-white">{userName}</p>
              <p className="text-xs" style={{ color: "#b8d4e8" }}>Usuario activo</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="gap-2 border-white text-white hover:bg-white/10"
              style={{ borderColor: "white", color: "white", background: "transparent" }}
            >
              <LogOut className="w-4 h-4" />
              Salir
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {isLocked && (
          <Alert className="mb-6 bg-yellow-50 border-yellow-200">
            <AlertCircle className="h-4 w-4 text-yellow-600" />
            <AlertDescription className="text-yellow-800">
              El inventario está siendo modificado por <strong>{lockUser}</strong>. Por favor espera...
            </AlertDescription>
          </Alert>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card style={{ borderTop: "4px solid #24638F" }}>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-2">Total de Productos</p>
                <p className="text-3xl font-bold" style={{ color: "#24638F" }}>{stats.totalProducts}</p>
              </div>
            </CardContent>
          </Card>
          <Card style={{ borderTop: "4px solid #3a85b8" }}>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-2">Total de Unidades</p>
                <p className="text-3xl font-bold" style={{ color: "#3a85b8" }}>{stats.totalUnits}</p>
              </div>
            </CardContent>
          </Card>
          <Card style={{ borderTop: "4px solid #e08c00" }}>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-2">Bajo Mínimo</p>
                <p className="text-3xl font-bold text-orange-600">{stats.lowStock}</p>
              </div>
            </CardContent>
          </Card>
          <Card style={{ borderTop: "4px solid #d9534f" }}>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-2">Sin Stock</p>
                <p className="text-3xl font-bold text-red-600">{stats.noStock}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="form" className="w-full">
          <TabsList className="grid w-full grid-cols-3" style={{ background: "#eaf3f9" }}>
            <TabsTrigger value="form" className="gap-2">
              <Package className="w-4 h-4" />
              Registrar Movimiento
            </TabsTrigger>
            <TabsTrigger value="inventory" className="gap-2">
              <Package className="w-4 h-4" />
              Inventario
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2">
              <History className="w-4 h-4" />
              Historial
            </TabsTrigger>
          </TabsList>

          <TabsContent value="form" className="mt-6">
            <InventoryForm
              userName={userName}
              onMovementSuccess={refetch}
              isLocked={isLocked}
              inventory={inventory}
            />
          </TabsContent>

          <TabsContent value="inventory" className="mt-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Inventario Actual</CardTitle>
                  <CardDescription>
                    {inventory.length} productos en el sistema
                  </CardDescription>
                </div>
                <Button
                  onClick={handleExportInventory}
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  style={{ borderColor: "#24638F", color: "#24638F" }}
                >
                  <Download className="w-4 h-4" />
                  Descargar CSV
                </Button>
              </CardHeader>
              <CardContent>
                <InventoryTable products={inventory} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="mt-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Historial de Movimientos</CardTitle>
                  <CardDescription>
                    {history.length} movimientos registrados
                  </CardDescription>
                </div>
                <Button
                  onClick={handleExportHistory}
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  style={{ borderColor: "#24638F", color: "#24638F" }}
                >
                  <Download className="w-4 h-4" />
                  Descargar CSV
                </Button>
              </CardHeader>
              <CardContent>
                <HistoryTable movements={history} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
