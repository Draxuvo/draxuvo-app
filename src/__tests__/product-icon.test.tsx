import { render, screen } from "@testing-library/react-native";
import { ProductGlyph, ProductIcon, ProductIconBadge } from "@/components/product-icon";

describe("ProductIcon (spec 026)", () => {
  it("pinta el trazo de una clave conocida y está oculto a lectores de pantalla", async () => {
    await render(<ProductIcon name="taco" color="#000" />);
    const icon = screen.getByTestId("product-icon-taco", { includeHiddenElements: true });
    expect(icon.props.accessibilityElementsHidden).toBe(true);
    expect(icon.props.importantForAccessibility).toBe("no-hide-descendants");
  });

  it("no pinta nada con una clave desconocida", async () => {
    await render(<ProductIcon name="futuro" color="#000" />);
    expect(screen.queryByTestId("product-icon-futuro", { includeHiddenElements: true })).toBeNull();
  });

  it("el cuadro usa el icono propio, luego el del tipo y por último la inicial", async () => {
    await render(
      <>
        <ProductIconBadge product={{ name: "Taco", icon: "taco" }} color="#c00" />
        <ProductIconBadge product={{ name: "Sope", product_type: { icon: "utensils" } }} color="#c00" />
        <ProductIconBadge product={{ name: "Gordita" }} color="#c00" />
      </>,
    );
    expect(screen.getByTestId("product-icon-taco", { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByTestId("product-icon-utensils", { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByText("G", { includeHiddenElements: true })).toBeTruthy();
  });

  it("el glifo suelto no pinta nada sin icono", async () => {
    await render(<ProductGlyph product={{ icon: null }} color="#000" />);
    expect(screen.toJSON()).toBeNull();
  });
});
