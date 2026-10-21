// Icono de producto (spec 026). Decorativo: el nombre del producto sigue siendo la etiqueta.
import { memo } from "react";
import { View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { isProductIconKey } from "@/lib/product-icons/catalog";
import { resolveProductIcon, type IconSource } from "@/lib/product-icons/resolve";
import { SHAPES } from "@/lib/product-icons/shapes";
import { AppText } from "./ui";

export const ProductIcon = memo(function ProductIcon({ name, size = 20, color }: { name: string; size?: number; color: string }) {
  if (!isProductIconKey(name)) return null;
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      testID={`product-icon-${name}`}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {SHAPES[name].map((d, i) => (
        <Path key={i} d={d} />
      ))}
    </Svg>
  );
});

/** Cuadro de color con el icono del producto en blanco; sin icono conocido, la inicial del nombre. */
export const ProductIconBadge = memo(function ProductIconBadge({
  product,
  color,
  size = 36,
}: {
  product: IconSource & { name: string };
  color: string;
  size?: number;
}) {
  const key = resolveProductIcon(product);
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: size, height: size, borderRadius: 10, backgroundColor: color, alignItems: "center", justifyContent: "center" }}
    >
      {key ? (
        <ProductIcon name={key} size={Math.round(size * 0.56)} color="#FFFFFF" />
      ) : (
        <AppText variant="headline" style={{ color: "#FFFFFF" }}>
          {product.name.trim().charAt(0).toUpperCase()}
        </AppText>
      )}
    </View>
  );
});

/** Icono suelto (renglones, chips): nada si no hay icono conocido. */
export function ProductGlyph({ product, size = 18, color }: { product: IconSource; size?: number; color: string }) {
  const key = resolveProductIcon(product);
  return key ? <ProductIcon name={key} size={size} color={color} /> : null;
}
