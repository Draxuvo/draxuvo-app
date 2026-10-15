import { Redirect } from "expo-router";

// La raíz no es una pantalla: AppGate decide entre entrar, el bloqueo o la lista.
export default function Index() {
  return <Redirect href="/(tabs)/ordenes" />;
}
