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
import { Camera, X, AlertCircle } from "lucide-react";
import Quagga from "@ericblade/quagga2";

interface BarcodeScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onBarcodeDetected: (code: string) => void;
}

// Limpia completamente un elemento <video>
function cleanVideo(video: HTMLVideoElement) {
  try { video.pause(); } catch (_) {}
  try {
    const s = video.srcObject as MediaStream | null;
    s?.getTracks().forEach((t) => { try { t.stop(); } catch (_) {} });
  } catch (_) {}
  try { video.srcObject = null; } catch (_) {}
  try { video.removeAttribute("src"); } catch (_) {}
  try { video.load(); } catch (_) {}
}

// Detiene Quagga y limpia todos los videos del contenedor
async function fullStop(container: HTMLElement | null) {
  try { Quagga.offDetected(); } catch (_) {}
  try { Quagga.stop(); } catch (_) {}
  await new Promise((r) => setTimeout(r, 200));
  container?.querySelectorAll<HTMLVideoElement>("video").forEach(cleanVideo);
}

export default function BarcodeScanner({
  isOpen,
  onClose,
  onBarcodeDetected,
}: BarcodeScannerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const quaggaReadyRef = useRef(false);
  const lastCodeRef = useRef<string | null>(null);
  const lastTimeRef = useRef<number>(0);

  const [error, setError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [detectedCode, setDetectedCode] = useState<string | null>(null);

  // ---------- limpieza total ----------
  const stopAll = useCallback(async () => {
    // 1. detener Quagga
    if (quaggaReadyRef.current) {
      try { Quagga.offDetected(); } catch (_) {}
      try { Quagga.stop(); } catch (_) {}
      quaggaReadyRef.current = false;
    }
    await new Promise((r) => setTimeout(r, 200));

    // 2. limpiar el <video> que manejamos directamente
    if (videoRef.current) {
      cleanVideo(videoRef.current);
    }

    // 3. limpiar cualquier video residual que Quagga haya inyectado
    containerRef.current?.querySelectorAll<HTMLVideoElement>("video").forEach(cleanVideo);

    // 4. detener el stream guardado
    streamRef.current?.getTracks().forEach((t) => { try { t.stop(); } catch (_) {} });
    streamRef.current = null;
  }, []);

  // ---------- inicializar ----------
  const startScanner = useCallback(async () => {
    if (!containerRef.current) return;

    await stopAll();
    setIsInitializing(true);
    setError(null);
    setDetectedCode(null);
    lastCodeRef.current = null;
    lastTimeRef.current = 0;

    // Paso 1: abrir la cámara directamente con getUserMedia
    // Esto evita la pantalla negra que ocurre cuando Quagga tarda en reclamar el stream
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { min: 320 }, height: { min: 240 } },
        audio: false,
      });
    } catch (err: any) {
      // Fallback: cámara frontal o sin preferencia
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      } catch (err2: any) {
        setError("No se pudo acceder a la cámara. Verifica los permisos.");
        setIsInitializing(false);
        return;
      }
    }
    streamRef.current = stream;

    // Paso 2: crear el <video> que usaremos y mostrarlo de inmediato
    // (si Quagga luego crea el suyo, el nuestro queda como respaldo visible)
    const existing = containerRef.current.querySelector<HTMLVideoElement>("video");
    const video: HTMLVideoElement = existing ?? document.createElement("video");
    video.setAttribute("autoplay", "true");
    video.setAttribute("muted", "true");
    video.setAttribute("playsinline", "true");
    video.muted = true;
    video.style.width = "100%";
    video.style.height = "100%";
    video.style.objectFit = "cover";
    video.style.display = "block";
    if (!existing) containerRef.current.appendChild(video);
    videoRef.current = video;

    video.srcObject = stream;
    try {
      await video.play();
    } catch (_) {}

    // Paso 3: inicializar Quagga apuntando al mismo elemento de video
    try {
      await new Promise<void>((resolve, reject) => {
        Quagga.init(
          {
            inputStream: {
              type: "LiveStream",
              target: video, // usamos el video que ya tiene stream
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
            numOfWorkers: 0, // 0 = sin workers, más compatible en móvil
            frequency: 10,
          },
          (err) => {
            if (err) {
              console.warn("Quagga init warning (continuando con stream directo):", err);
              // No rechazamos: el video ya está visible, Quagga es opcional aquí
              resolve();
              return;
            }
            quaggaReadyRef.current = true;
            Quagga.start();
            resolve();
          }
        );
      });
    } catch (err) {
      console.warn("Quagga setup error (continuando):", err);
    }

    // Registrar detección
    const onDetected = (result: any) => {
      const code = result?.codeResult?.code;
      if (!code) return;
      const now = Date.now();
      if (code === lastCodeRef.current && now - lastTimeRef.current < 1500) return;
      lastCodeRef.current = code;
      lastTimeRef.current = now;
      setDetectedCode(code);
      onBarcodeDetected(code);
      setTimeout(() => handleClose(), 600);
    };

    if (quaggaReadyRef.current) {
      Quagga.onDetected(onDetected);
    }

    setIsInitializing(false);
  }, [onBarcodeDetected, stopAll]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- cerrar ----------
  const handleClose = useCallback(async () => {
    await stopAll();
    setDetectedCode(null);
    setError(null);
    onClose();
  }, [stopAll, onClose]);

  // ---------- efecto principal: solo reacciona a isOpen ----------
  useEffect(() => {
    if (isOpen) {
      startScanner();
    } else {
      stopAll();
    }
    return () => {
      stopAll();
    };
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
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2" />
                <p className="text-sm text-gray-600">Inicializando cámara...</p>
              </div>
            </div>
          )}

          {!error && (
            <div
              ref={containerRef}
              className="w-full bg-black rounded-lg overflow-hidden relative"
              style={{ minHeight: "300px" }}
            />
          )}

          {detectedCode && (
            <Alert className="bg-green-50 border-green-200">
              <AlertCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                Código detectado: <strong>{detectedCode}</strong>
              </AlertDescription>
            </Alert>
          )}

          <div className="flex gap-2">
            <Button onClick={handleClose} variant="outline" className="flex-1">
              <X className="w-4 h-4 mr-2" />
              Cerrar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
