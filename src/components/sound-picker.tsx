import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { AppText, Button, Icon, IconButton } from "@/components/ui";
import { useSoundChoices } from "@/hooks/use-sound-choices";
import { useSoundPreference } from "@/hooks/use-sound-preference";
import { haptic } from "@/lib/haptics";
import { playSound } from "@/lib/sound";
import { DEFAULTS, SOUND_IDS, type SoundId } from "@/lib/sounds/catalog";
import { resolve } from "@/lib/sounds/choices";
import { t, useLocale } from "@/i18n";
import { ToastHost } from "@/toast/toast-host";
import { toast } from "@/toast/store";
import { radius, space, useTheme } from "@/theme";

/** Nombre del sonido que suena hoy para "comanda lista" en este teléfono. */
export function useReadySoundName(): string {
  const { choices } = useSoundChoices();
  return t(`sounds.${resolve("ready", choices) ?? DEFAULTS.ready}`);
}

/**
 * Hoja para elegir y probar el sonido de "comanda lista" (spec 046). "Probar" suena aunque el sonido de comandas
 * esté apagado: es una acción explícita.
 */
export function SoundPicker({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  useLocale();
  const { c } = useTheme();
  const { choices, choose, reset } = useSoundChoices();
  const { volume } = useSoundPreference("ready");
  const current = resolve("ready", choices);

  const preview = (id: SoundId) => {
    if (!playSound(id, volume)) toast.error(t("sounds.playError"));
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: c.scrim, justifyContent: "flex-end" }]}>
        <Pressable accessibilityElementsHidden importantForAccessibility="no" style={StyleSheet.absoluteFill} onPress={onClose} />
        <View accessibilityViewIsModal style={{ backgroundColor: c.surface, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, padding: space[5], gap: space[3], maxHeight: "85%" }}>
          <AppText variant="title" accessibilityRole="header">
            {t("sounds.title")}
          </AppText>
          <AppText tone="muted">{t("sounds.hint")}</AppText>
          <ScrollView contentContainerStyle={{ gap: space[1] }}>
            {SOUND_IDS.map((id) => {
              const selected = id === current;
              return (
                <View key={id} style={{ flexDirection: "row", alignItems: "center", gap: space[2], minHeight: 52 }}>
                  <Pressable
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    accessibilityLabel={t(`sounds.${id}`)}
                    onPress={() => {
                      haptic.select();
                      choose("ready", id);
                    }}
                    style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: space[3], minHeight: 48 }}
                  >
                    <Icon name={selected ? "check-circle" : "circle"} tone={selected ? "primary" : "muted"} />
                    <AppText style={{ flexShrink: 1, fontWeight: selected ? "700" : "400" }}>{t(`sounds.${id}`)}</AppText>
                  </Pressable>
                  <IconButton icon="play" label={t("sounds.previewLabel", { sound: t(`sounds.${id}`) })} onPress={() => preview(id)} />
                </View>
              );
            })}
          </ScrollView>
          <View style={{ gap: space[2] }}>
            {current !== DEFAULTS.ready && <Button label={t("sounds.reset")} variant="outline" onPress={() => reset("ready")} />}
            <Button label={t("sounds.close")} onPress={onClose} />
          </View>
        </View>
        <ToastHost announce={false} />
      </View>
    </Modal>
  );
}
