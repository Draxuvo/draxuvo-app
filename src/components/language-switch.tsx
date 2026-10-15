import { View } from "react-native";
import { getLocale, setLocale, t, useLocale, type Locale } from "@/i18n";
import { space } from "@/theme";
import { AppText, Chip } from "./ui";

const OPTIONS: { value: Locale; label: string }[] = [
  { value: "es", label: "Español" },
  { value: "en", label: "English" },
];

/** Cambio de idioma; se guarda en el dispositivo y viaja en la cabecera `locale` (FR-017). */
export function LanguageSwitch() {
  useLocale();
  return (
    <View style={{ gap: space[2] }}>
      <AppText variant="label" tone="muted">
        {t("profile.language").toUpperCase()}
      </AppText>
      <View style={{ flexDirection: "row", gap: space[2] }}>
        {OPTIONS.map((option) => (
          <Chip key={option.value} role="radio" icon="globe" label={option.label} selected={getLocale() === option.value} onPress={() => void setLocale(option.value)} />
        ))}
      </View>
    </View>
  );
}
