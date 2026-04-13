import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Camera, X, AlertCircle, Loader2 } from "lucide-react";
import Quagga from "@ericblade/quagga2";

interface BarcodeScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onBarcodeDetected: (code: string) => void;
}

const BARCODE_FORMATS = [
  "ean_13",
  "ean_8",
  "code_128",
  "code_39",
  "code_93",
  "qr_code",
  "upc_a",
  "upc_e",
  "itf",
  "codabar",
] as const;

const QUAGGA_READERS = [
  "code_128_reader",
  "ean_reader",
  "ean_8_reader",
  "upc_reader",
  "upc_e_reader",
  "code_39_reader",
  "code_93_reader",
  "codabar_reader",
];

export default function BarcodeScanner({
  isOpen,
  onClose,
  onBarcodeDetected,
}: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const quaggaActiveRef = useRef(false);
  const lastCodeRef = useRef<string | null>(null);
  const lastTimeRef = useRef<number>(0);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [detectedCode, setDetectedCode] = useState<string | null>(null);

  // Detectar soporte de BarcodeDetector al montar
  const hasBarcodeDetector =
    typeof window !== "undefined" && "BarcodeDetector" in window;

  // ---------- limpieza ----------
  const stopAll = useCallback(async () => {
    // Cancelar animation frame
    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }

    // Detener Quagga si estaba activo
    if (quaggaActiveRef.current) {
      try { Quagga.offDetected(); } catch (_) {}
      try { Quagga.stop(); } catch (_) {}
      quaggaActiveRef.current = false;
      await new Promise((r) => setTimeout(r, 150));
    }

    // Detener stream de cámara
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => {
        try { t.stop(); } catch (_) {}
      });
      streamRef.current = null;
    }

    // Limpiar video
    if (videoRef.current) {
      try { videoRef.current.pause(); } catch (_) {}
      try { videoRef.current.srcObject = null; } catch (_) {}
    }

    // Limpiar videos residuales de Quagga en el contenedor
    containerRef.current?.querySelectorAll<HTMLVideoElement>("video").forEach((v) => {
      try { v.pause(); } catch (_) {}
      try { (v.srcObject as MediaStream | null)?.getTracks().forEach((t) => t.stop()); } catch (_) {}
      try { v.srcObject = null; } catch (_) {}
    });
  }, []);

  // ---------- detección con BarcodeDetector ----------
  const startNativeDetection = useCallback(
    (detector: BarcodeDetector) => {
      setScanning(true);

      const detect = async () => {
        try {
          const video = videoRef.current;
          if (video && video.readyState >= 2) {
            const barcodes = await detector.detect(video);
            if (barcodes.length > 0) {
              const code = barcodes[0].rawValue;
              if (code) {
                stopAll();
                onBarcodeDetected(code);
                return;
              }
            }
          }
        } catch (_) {}
        animFrameRef.current = requestAnimationFrame(detect);
      };

      animFrameRef.current = requestAnimationFrame(detect);
    },
    [onBarcodeDetected, stopAll]
  );

  // ---------- detección con Quagga (fallback) ----------
  const startQuaggaDetection = useCallback(async () => {
    if (!containerRef.current) return;

    try {
      await new Promise<void>((resolve) => {
        Quagga.init(
          {
            inputStream: {
              type: "LiveStream",
              target: containerRef.current!,
              constraints: {
                facingMode: "environment",
                width: { min: 320 },
                height: { min: 240 },
              },
            },
            decoder: { readers: QUAGGA_READERS },
            locate: true,
            numOfWorkers: 0,
            frequency: 10,
          },
          (err) => {
            if (err) {
              console.warn("Quagga init error:", err);
              resolve();
              return;
            }
            quaggaActiveRef.current = true;
            Quagga.start();
            resolve();
          }
        );
      });

      if (quaggaActiveRef.current) {
        setScanning(true);
        Quagga.offDetected();
        Quagga.onDetected((result: any) => {
          const code = result?.codeResult?.code;
          if (!code) return;
          const now = Date.now();
          if (code === lastCodeRef.current && now - lastTimeRef.current < 1500) return;
          lastCodeRef.current = code;
          lastTimeRef.current = now;
          setDetectedCode(code);
          stopAll().then(() => {
            onBarcodeDetected(code);
          });
        });
      }
    } catch (err) {
      console.warn("Quagga setup error:", err);
    }
  }, [onBarcodeDetected, stopAll]);

  // ---------- iniciar cámara ----------
  const startCamera = useCallback(async () => {
    if (!containerRef.current) return;

    await stopAll();
    setLoading(true);
    setError(null);
    setDetectedCode(null);
    setScanning(false);
    lastCodeRef.current = null;
    lastTimeRef.current = 0;

    try {
      // Solicitar cámara trasera, con fallback a cualquier cámara
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }

      streamRef.current = stream;

      // Si BarcodeDetector está disponible: montar video manualmente
      if (hasBarcodeDetector) {
        const video = videoRef.current!;
        video.srcObject = stream;

        await new Promise<void>((resolve) => {
          video.onloadedmetadata = () => resolve();
        });

        await video.play();
        setLoading(false);

        // Iniciar detección nativa
        const detector = new (window as any).BarcodeDetector({
          formats: BARCODE_FORMATS,
        }) as BarcodeDetector;

        startNativeDetection(detector);
      } else {
        // Fallback: Quagga maneja el video internamente
        setLoading(false);
        await startQuaggaDetection();
      }
    } catch (err: any) {
      console.error("Error accediendo a la cámara:", err);
      setLoading(false);
      setScanning(false);

      if (err?.name === "NotAllowedError" || err?.name === "PermissionDeniedError") {
        setError("Permiso de cámara denegado. Ve a Configuración > Permisos del sitio y habilita la cámara.");
      } else if (err?.name === "NotFoundError") {
        setError("No se encontró ninguna cámara en este dispositivo.");
      } else {
        setError("No se pudo acceder a la cámara. Verifica que no esté en uso por otra aplicación.");
      }
    }
  }, [hasBarcodeDetector, startNativeDetection, startQuaggaDetection, stopAll]);

  // ---------- cerrar ----------
  const handleClose = useCallback(async () => {
    await stopAll();
    setDetectedCode(null);
    setError(null);
    setScanning(false);
    setLoading(false);
    onClose();
  }, [stopAll, onClose]);

  // ---------- efecto principal ----------
  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopAll();
    }
    return () => {
      stopAll();
    };
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        <DialogHeader className="px-4 pt-4 pb-2">
          <DialogTitle className="flex items-center gap-2">
            <Camera className="w-5 h-5" />
            Escanear Código de Barras
          </DialogTitle>
          <DialogDescription>
            Apunta la cámara al código de barras para escanearlo
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 px-4 pb-4">
          {/* Error */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <Loader2 className="animate-spin h-8 w-8 text-blue-600 mx-auto mb-2" />
                <p className="text-sm text-gray-600">Inicializando cámara...</p>
              </div>
            </div>
          )}

          {/* Vista de cámara */}
          {!error && (
            <div
              ref={containerRef}
              className="w-full bg-black rounded-lg overflow-hidden relative"
              style={{ minHeight: "300px" }}
            >
              {/* Video para BarcodeDetector nativo */}
              {hasBarcodeDetector && (
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  playsInline
                  muted
                  autoPlay
                  style={{ display: "block" }}
                />
              )}

              {/* Marco de escaneo */}
              {!loading && scanning && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="relative w-64 h-40">
                    <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-blue-400 rounded-tl-lg" />
                    <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-blue-400 rounded-tr-lg" />
                    <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-blue-400 rounded-bl-lg" />
                    <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-blue-400 rounded-br-lg" />
                    <div className="absolute inset-x-0 top-1/2 h-0.5 bg-blue-400/70 animate-pulse" />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Código detectado */}
          {detectedCode && (
            <Alert className="bg-green-50 border-green-200">
              <AlertCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                Código detectado: <strong>{detectedCode}</strong>
              </AlertDescription>
            </Alert>
          )}

          {/* Fallback manual si no hay soporte de ninguna API */}
          {error && (
            <div className="space-y-2">
              <p className="text-sm text-gray-600">
                Puedes ingresar el código manualmente:
              </p>
              <div className="flex gap-2">
                <input
                  id="manual-barcode-input"
                  type="text"
                  placeholder="Código de barras..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  onKeyDown={(e) => {
                    const val = (e.target as HTMLInputElement).value.trim();
                    if (e.key === "Enter" && val) {
                      onBarcodeDetected(val);
                      onClose();
                    }
                  }}
                />
                <Button
                  onClick={() => {
                    const el = document.getElementById("manual-barcode-input") as HTMLInputElement | null;
                    const val = el?.value?.trim();
                    if (val) {
                      onBarcodeDetected(val);
                      onClose();
                    }
                  }}
                  size="sm"
                >
                  OK
                </Button>
              </div>
            </div>
          )}

          {/* Estado de escaneo */}
          {!loading && !error && (
            <p className="text-center text-xs text-gray-500">
              {scanning
                ? "Apunta la cámara al código de barras"
                : !hasBarcodeDetector
                ? "Usando modo compatible (Quagga)"
                : "Iniciando detector..."}
            </p>
          )}

          {/* Botón cerrar */}
          <Button onClick={handleClose} variant="outline" className="w-full">
            <X className="w-4 h-4 mr-2" />
            Cerrar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
