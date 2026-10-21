import { View } from "react-native";
import { t } from "@/i18n";
import { space } from "@/theme";
import { AppText, Button } from "../ui";

/** Personas a quienes se puede pasar la cuenta (encargados), dentro de la hoja de la orden (spec 025). */
export function WaiterList({ waiters, currentId, loading, onPick }: { waiters: { id: number; name: string }[]; currentId?: number; loading: boolean; onPick: (id: number) => void }) {
  return (
    <View style={{ gap: space[1] }}>
      {loading ? <AppText tone="muted">{t("common.loading")}</AppText> : null}
      {waiters.map((person) => (
        <Button key={person.id} label={person.name} variant={person.id === currentId ? "tonal" : "text"} onPress={() => onPick(person.id)} />
      ))}
    </View>
  );
}
