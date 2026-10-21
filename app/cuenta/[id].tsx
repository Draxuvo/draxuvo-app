import { Redirect, useLocalSearchParams } from "expo-router";

/** Enlace antiguo a "Cuenta completa" (spec 025): la cuenta ahora vive en la hoja de la orden de Tomar pedido. */
export default function CuentaRedirect() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <Redirect href={`/pedido?cuenta=${id}&hoja=1` as never} />;
}
