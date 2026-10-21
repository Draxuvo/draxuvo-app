import { TakeOrderScreen } from "@/components/take-order/take-order-screen";

// La pestaña Mesas es la pantalla visual de tomar pedido (spec 018): plano, orden y menú en un solo lugar.
export default function Mesas() {
  return <TakeOrderScreen mode="restaurant" />;
}
