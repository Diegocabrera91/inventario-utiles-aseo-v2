import { useEffect, useRef, useState, useCallback } from "react";
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

function resetVideoElement(container: HTMLDivElement | null) {
  if (!container) return;
  const videos = container.querySelectorAll("video");
  videos.forEach((video) => {
    try { video.pause(); } catch (_) {}
    try {
      const stream = video.srcObject as MediaStream | null;
      if (stream) stream.getTracks().forEach((t) => { try { t.stop(); } catch (_) {} });
    } catch (_) {}
    try { video.srcObject = null; } catch (_) {}
    try { video.removeAttribute("src"); } catch (_) {}
    try { video.load(); } catch (_) {}
  });
}

async function stopQuagga(container: HTMLDivElement | null) {
  try { Quagga.offDetected(); } catch (_) {}
  try { Quagga.stop(); } catch (_) {}
  // pequeña pausa para que el navegador libere la cámara
  await new Promise((r) => setTimeout(r, 150));
  resetVideoElement(container);
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

  // Usar ref para el anti-duplicado en lugar de estado (evita re-ejecución del efecto)
  const lastDetectionTimeRef = useRef<number>(0);
  const lastDetectedCodeRef = useRef<string | null>(null);
  const isStoppingRef = useRef(false);

  const handleClose = useCallback(async () => {
    if (isStoppingRef.current) return;
    isStoppingRef.current = true;
    await stopQuagga(scannerRef.current);
    setLastDetectedCode(null);
    lastDetectedCodeRef.current = null;
    lastDetectionTimeRef.current = 0;
    setError(null);
    isStoppingRef.current = false;
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!isOpen || !scannerRef.current) return;

    let cancelled = false;

    const initScanner = async () => {
      // Limpiar cualquier instancia previa antes de iniciar
      await stopQuagga(scannerRef.current);
      if (cancelled) return;

      setIsInitializing(true);
      setError(null);

      try {
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
            if (cancelled) return;
            if (err) {
              console.error("Error initializing Quagga:", err);
              setError("No se pudo acceder a la cámara. Verifica los permisos.");
              setIsInitializing(false);
              return;
            }

            // Forzar atributos en el video que Quagga crea
            if (scannerRef.current) {
              const videos = scannerRef.current.querySelectorAll("video");
              videos.forEach((v) => {
                v.setAttribute("autoplay", "true");
                v.setAttribute("muted", "true");
                v.setAttribute("playsinline", "true");
                v.muted = true;
                v.onloadedmetadata = () => {
                  v.play().catch((e) => console.warn("play() failed:", e));
                };
                // Forzar play por si loadedmetadata ya pasó
                setTimeout(() => {
                  v.play().catch(() => {});
                }, 300);
              });
            }

            Quagga.start();
            setIsInitializing(false);
          }
        );
      } catch (err) {
        if (cancelled) return;
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

      const now = Date.now();
      if (
        code === lastDetectedCodeRef.current &&
        now - lastDetectionTimeRef.current < 1000
      ) {
        return;
      }

      lastDetectedCodeRef.current = code;
      lastDetectionTimeRef.current = now;
      setLastDetectedCode(code);

      onBarcodeDetected(code);

      setTimeout(() => {
        handleClose();
      }, 500);
    };

    initScanner().then(() => {
      if (!cancelled) {
        Quagga.onDetected(onDetected);
      }
    });

    return () => {
      cancelled = true;
      Quagga.offDetected(onDetected);
      stopQuagga(scannerRef.current);
    };
  // Solo se re-ejecuta cuando isOpen cambia — no al detectar códigos
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

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
