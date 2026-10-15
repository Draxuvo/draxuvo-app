import { Pressable, View } from "react-native";
import { getLocale, setLocale, t, useLocale, type Locale } from "@/i18n";
import { colors, MIN_TOUCH, radii, spacing } from "@/theme";
import { AppText } from "./ui";

const OPTIONS: { value: Locale; label: string }[] = [
  { value: "es", label: "Español" },
  { value: "en", label: "English" },
];

/** Cambio de idioma; se guarda en el dispositivo y viaja en la cabecera `locale` (FR-017). */
export function LanguageSwitch() {
  useLocale();
  return (
    <View style={{ gap: spacing[2] }}>
      <AppText variant="label" muted>
        {t("profile.language").toUpperCase()}
      </AppText>
      <View style={{ flexDirection: "row", gap: spacing[2] }}>
        {OPTIONS.map((option) => {
          const selected = getLocale() === option.value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityLabel={option.label}
              accessibilityState={{ selected }}
              onPress={() => void setLocale(option.value)}
              style={{
                flex: 1,
                minHeight: MIN_TOUCH,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: radii.etiqueta,
                borderWidth: 1.5,
                borderColor: colors.tinta,
                backgroundColor: selected ? colors.tinta : colors.etiqueta,
              }}
            >
              <AppText variant="bodyStrong" style={{ color: selected ? colors.etiqueta : colors.tinta }}>
                {option.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
