// Lector de códigos del teléfono (spec 056): hoja con la cámara y, siempre debajo, un campo para escribir el número.
// Pide el permiso al abrirse, filtra rebotes, lee el código más cercano al centro y se queda abierta entre lecturas
// (`continuous`). Las imágenes no salen del teléfono: solo el texto llega a `onScan`.
import { CameraView, useCameraPermissions } from "expo-camera";
import { useCallback, useEffect, useRef, useState } from "react";
import { Linking, Modal, StyleSheet, TextInput, View } from "react-native";
import { AppText, Button, IconButton } from "@/components/ui";
import { haptic } from "@/lib/haptics";
import { createDebounce, normalizeCode, pickCentral, type DetectedCode } from "@/lib/scan";
import { t, useLocale } from "@/i18n";
import { ToastHost } from "@/toast/toast-host";
import { toast } from "@/toast/store";
import { radius, space, useTheme } from "@/theme";

/** Las lecturas que llegan casi juntas se agrupan este rato para elegir la más cercana al centro. */
const BATCH_MS = 120;
const BARCODE_TYPES = ["ean13", "upc_a", "ean8", "code128"] as const;

interface ScanSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Se llama con cada lectura aceptada, de una en una. */
  onScan: (code: string) => Promise<void> | void;
  /** Sigue abierta tras cada lectura (por omisión sí). */
  continuous?: boolean;
}

interface ScannedEvent {
  data: string;
  bounds?: { origin: { x: number; y: number }; size: { width: number; height: number } };
}

export function ScanSheet({ visible, onClose, onScan, continuous = true }: ScanSheetProps) {
  // El contenido se monta solo mientras la hoja está abierta: cada apertura empieza con el estado limpio.
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      {visible && <ScanBody onClose={onClose} onScan={onScan} continuous={continuous} />}
    </Modal>
  );
}

function ScanBody({ onClose, onScan, continuous }: Omit<ScanSheetProps, "visible"> & { continuous: boolean }) {
  useLocale();
  const { c } = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const [manual, setManual] = useState("");
  const [announce, setAnnounce] = useState("");
  const [size, setSize] = useState({ width: 1, height: 1 });
  const debounce = useRef(createDebounce());
  const batch = useRef<DetectedCode[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const busy = useRef(false);
  const onScanRef = useRef(onScan);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onScanRef.current = onScan;
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    // Pedir el permiso al abrir la hoja (al tocar el botón), no antes.
    if (permission && !permission.granted && permission.canAskAgain) void requestPermission();
    // Solo al montar: una apertura, una petición.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const deliver = useCallback(
    async (code: string) => {
      if (busy.current) return;
      busy.current = true;
      try {
        await onScanRef.current(code);
      } catch {
        // El aviso del error ya lo dio quien procesa el código.
      } finally {
        busy.current = false;
      }
      if (!continuous) onCloseRef.current();
    },
    [continuous],
  );

  const flush = useCallback(() => {
    timer.current = null;
    const best = pickCentral(batch.current, size.width, size.height);
    batch.current = [];
    if (!best) return;
    const code = normalizeCode(best.value);
    if (!code) return void setAnnounce(t("scan.invalid"));
    if (!debounce.current.accept(code)) return;
    haptic.success();
    setAnnounce(t("scan.read", { code }));
    void deliver(code);
  }, [deliver, size.height, size.width]);

  const onBarcode = useCallback(
    (event: ScannedEvent) => {
      const b = event.bounds;
      batch.current.push({
        value: event.data,
        center: b ? { x: b.origin.x + b.size.width / 2, y: b.origin.y + b.size.height / 2 } : undefined,
      });
      if (!timer.current) timer.current = setTimeout(flush, BATCH_MS);
    },
    [flush],
  );

  const submitManual = () => {
    const code = normalizeCode(manual);
    setManual("");
    if (!code) return;
    void deliver(code);
  };

  const granted = permission?.granted === true;
  const denied = permission !== null && !granted && !permission.canAskAgain;

  return (
    <>
      <View style={{ flex: 1, backgroundColor: c.surface, padding: space[4], gap: space[3] }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <AppText variant="title" accessibilityRole="header">
            {t("scan.title")}
          </AppText>
          <IconButton icon="x" label={t("scan.close")} onPress={onClose} />
        </View>
        <AppText tone="muted">{t("scan.hint")}</AppText>

        {granted ? (
          <View
            style={{ flex: 1, borderRadius: radius.sheet, overflow: "hidden", backgroundColor: "#000" }}
            onLayout={(e) => setSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
          >
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              enableTorch={torch}
              barcodeScannerSettings={{ barcodeTypes: [...BARCODE_TYPES] }}
              onBarcodeScanned={onBarcode}
            />
            <View
              accessibilityLabel={t("scan.frame")}
              pointerEvents="none"
              style={{ position: "absolute", left: "10%", right: "10%", top: "30%", bottom: "30%", borderWidth: 2, borderColor: "rgba(255,255,255,0.85)", borderRadius: 12 }}
            />
          </View>
        ) : (
          <View style={{ flex: 1, justifyContent: "center", gap: space[3] }}>
            <AppText accessibilityRole="alert">{denied ? t("scan.permissionDenied") : t("scan.permissionAsk")}</AppText>
            {denied ? (
              <Button label={t("scan.openSettings")} variant="outline" onPress={() => void Linking.openSettings()} />
            ) : (
              <Button label={t("scan.permissionAllow")} onPress={() => void requestPermission()} />
            )}
          </View>
        )}

        <AppText accessibilityLiveRegion="polite" tone="muted" style={{ textAlign: "center", minHeight: 20 }}>
          {announce}
        </AppText>

        {granted && <Button label={torch ? t("scan.torchOff") : t("scan.torchOn")} variant="outline" icon="zap" onPress={() => setTorch((v) => !v)} />}

        <View style={{ flexDirection: "row", gap: space[2], alignItems: "center" }}>
          <TextInput
            value={manual}
            onChangeText={setManual}
            onSubmitEditing={submitManual}
            accessibilityLabel={t("scan.manualLabel")}
            placeholder={t("scan.manualPlaceholder")}
            placeholderTextColor={c.inkMuted}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="characters"
            style={{ flex: 1, minHeight: 48, borderWidth: 1, borderColor: c.line, borderRadius: radius.sheet / 2, paddingHorizontal: space[3], color: c.ink }}
          />
          <Button label={t("scan.manualSubmit")} onPress={submitManual} disabled={!manual.trim()} />
        </View>
      </View>
      <ToastHost />
    </>
  );
}

// Exportado para que otras pantallas muestren el mismo aviso de "no encontrado".
export const scanToast = {
  notFound: (code: string) => toast.error(t("scan.notFound", { code })),
};
