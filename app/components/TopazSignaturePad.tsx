'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Tablet, AlertCircle, CheckCircle, RefreshCw, Wifi, WifiOff } from 'lucide-react';

// Topaz SigWeb API types
declare global {
  interface Window {
    IsSigWebInstalled?: () => boolean;
    SetTabletState?: (state: number, ctx?: any, x?: number, y?: number) => void;
    SetJustifyMode?: (mode: number) => void;
    SetSigCompressionMode?: (mode: number) => void;
    SetImageXSize?: (size: number) => void;
    SetImageYSize?: (size: number) => void;
    SetImagePenWidth?: (width: number) => void;
    SetDisplayXSize?: (size: number) => void;
    SetDisplayYSize?: (size: number) => void;
    GetSigImageB64?: (callback: (sigString: string) => void) => void;
    GetSigString?: (callback: (sigString: string) => void) => void;
    ClearTablet?: () => void;
    NumberOfTabletPoints?: () => number;
    SetLCDCaptureMode?: (mode: number) => void;
    LCDRefresh?: (mode: number, x1: number, y1: number, x2: number, y2: number) => void;
    LCDWriteString?: (mode: number, font: number, x: number, y: number, text: string) => void;
    GetSigWebVersion?: () => string;
    tmr?: any;
  }
}

interface TopazSignaturePadProps {
  onSignatureCapture: (signatureBase64: string, signatureData: string) => void;
  onError?: (error: string) => void;
  width?: number;
  height?: number;
  signerName?: string;
}

export default function TopazSignaturePad({
  onSignatureCapture,
  onError,
  width = 500,
  height = 150,
  signerName = 'Firmante',
}: TopazSignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [isSigWebInstalled, setIsSigWebInstalled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSignature, setHasSignature] = useState(false);

  // Load SigWeb script dynamically
  useEffect(() => {
    // Check if already loaded
    if (typeof window !== 'undefined' && window.IsSigWebInstalled) {
      setIsLoading(false);
      checkSigWebInstalled();
      return;
    }

    // Load the SigWebTablet.js script
    const script = document.createElement('script');
    script.src = '/SigWebTablet.js'; // Must be placed in public folder
    script.async = true;
    
    script.onload = () => {
      setIsLoading(false);
      checkSigWebInstalled();
    };
    
    script.onerror = () => {
      setIsLoading(false);
      setError('No se pudo cargar el SDK de Topaz. Asegúrese de que SigWebTablet.js esté en /public.');
      if (onError) onError('Failed to load Topaz SDK');
    };

    document.body.appendChild(script);

    return () => {
      // Cleanup: stop tablet if connected
      if (window.SetTabletState) {
        try {
          window.SetTabletState(0);
        } catch (e) {
          // Ignore cleanup errors
        }
      }
      // Don't remove script - it might be needed by other components
    };
  }, []);

  const checkSigWebInstalled = useCallback(() => {
    if (typeof window === 'undefined') return;
    
    try {
      // SigWeb runs on localhost port 47289
      // We check if it's available by trying to call the version
      if (window.IsSigWebInstalled && window.IsSigWebInstalled()) {
        setIsSigWebInstalled(true);
        setError(null);
        
        // Get version for debugging
        if (window.GetSigWebVersion) {
          const version = window.GetSigWebVersion();
          console.log('SigWeb Version:', version);
        }
      } else {
        setIsSigWebInstalled(false);
        setError('SigWeb no está instalado o no está ejecutándose. Instálelo desde topazsystems.com');
      }
    } catch (e) {
      setIsSigWebInstalled(false);
      setError('No se pudo conectar con SigWeb. Verifique que el servicio esté activo.');
    }
  }, []);

  const connectToTablet = useCallback(() => {
    if (!isSigWebInstalled || typeof window === 'undefined') {
      setError('SigWeb no está disponible');
      return;
    }

    try {
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Configure tablet settings
      if (window.SetDisplayXSize) window.SetDisplayXSize(width);
      if (window.SetDisplayYSize) window.SetDisplayYSize(height);
      if (window.SetImageXSize) window.SetImageXSize(width);
      if (window.SetImageYSize) window.SetImageYSize(height);
      if (window.SetImagePenWidth) window.SetImagePenWidth(3);
      if (window.SetJustifyMode) window.SetJustifyMode(0);
      if (window.SetSigCompressionMode) window.SetSigCompressionMode(1);

      // Set LCD mode if available (for color pads like T-LBK755)
      if (window.SetLCDCaptureMode) {
        window.SetLCDCaptureMode(2);
      }

      // Write instructions to LCD
      if (window.LCDRefresh && window.LCDWriteString) {
        window.LCDRefresh(0, 0, 0, 240, 64);
        window.LCDWriteString(0, 2, 0, 0, 'Por favor firme abajo');
        window.LCDWriteString(0, 2, 0, 20, signerName);
      }

      // Start signature capture
      if (window.SetTabletState) {
        window.SetTabletState(1, ctx, 50);
      }

      setIsConnected(true);
      setError(null);
      setHasSignature(false);

      // Start polling for signature points
      if (window.tmr) clearInterval(window.tmr);
      window.tmr = setInterval(() => {
        if (window.NumberOfTabletPoints && window.NumberOfTabletPoints() > 0) {
          setHasSignature(true);
        }
      }, 500);

    } catch (e) {
      console.error('Error connecting to tablet:', e);
      setError('Error al conectar con el pad Topaz');
      setIsConnected(false);
    }
  }, [isSigWebInstalled, width, height, signerName]);

  const disconnectTablet = useCallback(() => {
    try {
      if (window.tmr) {
        clearInterval(window.tmr);
        window.tmr = null;
      }
      if (window.SetTabletState) {
        window.SetTabletState(0);
      }
      setIsConnected(false);
    } catch (e) {
      console.error('Error disconnecting:', e);
    }
  }, []);

  const clearSignature = useCallback(() => {
    try {
      // Clear the canvas
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
      }

      // Clear the tablet
      if (window.ClearTablet) {
        window.ClearTablet();
      }

      setHasSignature(false);
    } catch (e) {
      console.error('Error clearing signature:', e);
    }
  }, []);

  const captureSignature = useCallback(() => {
    if (!hasSignature) {
      setError('No hay firma capturada. El cliente debe firmar en el pad.');
      return;
    }

    try {
      // Get signature as Base64 image
      if (window.GetSigImageB64) {
        window.GetSigImageB64((sigImageB64: string) => {
          if (sigImageB64 && sigImageB64.length > 0) {
            // Also get signature data string for storage
            if (window.GetSigString) {
              window.GetSigString((sigString: string) => {
                onSignatureCapture(
                  `data:image/png;base64,${sigImageB64}`,
                  sigString
                );
                disconnectTablet();
              });
            } else {
              onSignatureCapture(`data:image/png;base64,${sigImageB64}`, '');
              disconnectTablet();
            }
          } else {
            setError('No se pudo obtener la imagen de la firma');
          }
        });
      } else {
        setError('Función de captura no disponible');
      }
    } catch (e) {
      console.error('Error capturing signature:', e);
      setError('Error al capturar la firma');
    }
  }, [hasSignature, onSignatureCapture, disconnectTablet]);

  // Render loading state
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-6 bg-purple-500/10 border border-purple-500/30 rounded-xl">
        <RefreshCw className="w-8 h-8 text-purple-400 animate-spin mb-2" />
        <p className="text-purple-300 text-sm">Cargando SDK de Topaz...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Connection Status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isSigWebInstalled ? (
            <>
              <CheckCircle className="w-4 h-4 text-green-400" />
              <span className="text-xs text-green-400 font-medium">SigWeb Detectado</span>
            </>
          ) : (
            <>
              <AlertCircle className="w-4 h-4 text-amber-400" />
              <span className="text-xs text-amber-400 font-medium">SigWeb No Detectado</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isConnected ? (
            <span className="flex items-center gap-1 text-xs text-emerald-400 font-medium">
              <Wifi className="w-3 h-3" /> Pad Conectado
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs text-gray-500 font-medium">
              <WifiOff className="w-3 h-3" /> Pad Desconectado
            </span>
          )}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
          <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-red-300">{error}</p>
        </div>
      )}

      {/* Canvas */}
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className={`w-full bg-white rounded-xl border-2 ${
            isConnected 
              ? 'border-emerald-500' 
              : 'border-dashed border-purple-500/50'
          }`}
        />
        {!isConnected && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/90 rounded-xl">
            <div className="text-center">
              <Tablet className="w-10 h-10 text-purple-400 mx-auto mb-2" />
              <p className="text-gray-600 text-sm">
                Haga clic en "Conectar Pad" para iniciar
              </p>
            </div>
          </div>
        )}
        {isConnected && !hasSignature && (
          <p className="absolute bottom-2 left-1/2 -translate-x-1/2 text-gray-400 text-xs pointer-events-none">
            Esperando firma en el pad Topaz...
          </p>
        )}
        {isConnected && hasSignature && (
          <div className="absolute top-2 right-2 bg-emerald-500 text-white text-xs px-2 py-1 rounded-full">
            ✓ Firma Detectada
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="text-xs text-gray-500 space-y-1">
        <p>• Asegúrese de que SigWeb esté instalado y ejecutándose</p>
        <p>• El pad Topaz debe estar conectado por USB</p>
        <p>• El cliente firmará directamente en el pad</p>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2">
        {!isConnected ? (
          <button
            onClick={connectToTablet}
            disabled={!isSigWebInstalled}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-purple-600 text-white rounded-xl hover:bg-purple-500 text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Tablet className="w-4 h-4" />
            Conectar Pad
          </button>
        ) : (
          <>
            <button
              onClick={clearSignature}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-gray-700/50 text-gray-300 rounded-xl hover:bg-gray-700 text-sm transition"
            >
              <RefreshCw className="w-4 h-4" />
              Limpiar
            </button>
            <button
              onClick={captureSignature}
              disabled={!hasSignature}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-emerald-600 text-white rounded-xl hover:bg-emerald-500 text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CheckCircle className="w-4 h-4" />
              Capturar Firma
            </button>
          </>
        )}
      </div>

      {/* Disconnect Button */}
      {isConnected && (
        <button
          onClick={disconnectTablet}
          className="w-full py-2 text-xs text-gray-500 hover:text-gray-400 transition"
        >
          Desconectar Pad
        </button>
      )}
    </div>
  );
}
