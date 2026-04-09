import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Camera, X, AlertCircle } from "lucide-react";
import Quagga from "@ericblade/quagga2";

interface BarcodeScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onBarcodeDetected: (code: string) => void;
}

export default function BarcodeScanner({
  isOpen,
  onClose,
  onBarcodeDetected,
}: BarcodeScannerProps) {
  const scannerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [lastDetectedCode, setLastDetectedCode] = useState<string | null>(null);
  const [lastDetectionTime, setLastDetectionTime] = useState<number>(0);

  useEffect(() => {
    if (!isOpen || !scannerRef.current) return;

    const initScanner = async () => {
      setIsInitializing(true);
      setError(null);

      try {
        // Inicializar Quagga
        await Quagga.init(
          {
            inputStream: {
              type: "LiveStream",
              target: scannerRef.current!,
              constraints: {
                facingMode: "environment",
                width: { min: 320 },
                height: { min: 240 },
              },
            },
            decoder: {
              readers: [
                "code_128_reader",
                "ean_reader",
                "ean_8_reader",
                "upc_reader",
                "upc_e_reader",
                "code_39_reader",
                "code_93_reader",
                "codabar_reader",
              ],
            },
            locate: true,
            numOfWorkers: 2,
            frequency: 10,
          },
          (err) => {
            if (err) {
              console.error("Error initializing Quagga:", err);
              setError("No se pudo acceder a la cámara. Verifica los permisos.");
              setIsInitializing(false);
              return;
            }

            Quagga.start();
            setIsInitializing(false);

            // Configurar detección de códigos
            Quagga.onDetected(onDetected);
          }
        );
      } catch (err) {
        console.error("Error setting up scanner:", err);
        setError(
          err instanceof Error
            ? err.message
            : "Error al inicializar el escáner"
        );
        setIsInitializing(false);
      }
    };

    const onDetected = (result: any) => {
      const code = result?.codeResult?.code;
      if (!code) return;

      // Evitar detecciones duplicadas en menos de 1 segundo
      const now = Date.now();
      if (code === lastDetectedCode && now - lastDetectionTime < 1000) {
        return;
      }

      setLastDetectedCode(code);
      setLastDetectionTime(now);

      // Notificar al componente padre
      onBarcodeDetected(code);

      // Cerrar el scanner automáticamente
      setTimeout(() => {
        handleClose();
      }, 500);
    };

    initScanner();

    return () => {
      try {
        Quagga.offDetected(onDetected);
        Quagga.stop();
      } catch (err) {
        console.warn("Error cleaning up scanner:", err);
      }
    };
  }, [isOpen, lastDetectedCode, lastDetectionTime, onBarcodeDetected]);

  const handleClose = () => {
    try {
      Quagga.stop();
    } catch (err) {
      console.warn("Error stopping scanner:", err);
    }
    setLastDetectedCode(null);
    setLastDetectionTime(0);
    setError(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="w-5 h-5" />
            Escanear Código de Barras
          </DialogTitle>
          <DialogDescription>
            Apunta la cámara al código de barras para escanearlo
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {isInitializing && (
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                <p className="text-sm text-gray-600">Inicializando cámara...</p>
              </div>
            </div>
          )}

          {!error && (
            <div
              ref={scannerRef}
              className="w-full bg-black rounded-lg overflow-hidden"
              style={{ minHeight: "300px" }}
            >
              <div className="w-full h-full flex items-center justify-center">
                {isInitializing && (
                  <div className="text-white text-center">
                    <p>Cargando...</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {lastDetectedCode && (
            <Alert className="bg-green-50 border-green-200">
              <AlertCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                Código detectado: <strong>{lastDetectedCode}</strong>
              </AlertDescription>
            </Alert>
          )}

          <div className="flex gap-2">
            <Button
              onClick={handleClose}
              variant="outline"
              className="flex-1"
            >
              <X className="w-4 h-4 mr-2" />
              Cerrar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
