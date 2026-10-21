import { PRODUCT_ICON_GROUPS, PRODUCT_ICON_KEYS, isProductIconKey } from "../product-icons/catalog";
import { resolveProductIcon } from "../product-icons/resolve";
import { SHAPES } from "../product-icons/shapes";

describe("catálogo de iconos de producto (spec 026)", () => {
  it("tiene 54 claves únicas, cada una con trazo", () => {
    expect(PRODUCT_ICON_KEYS).toHaveLength(54);
    expect(new Set(PRODUCT_ICON_KEYS).size).toBe(54);
    for (const key of PRODUCT_ICON_KEYS) expect(SHAPES[key].length).toBeGreaterThan(0);
    expect(Object.keys(PRODUCT_ICON_GROUPS)).toHaveLength(6);
  });

  it("solo reconoce claves del catálogo", () => {
    expect(isProductIconKey("taco")).toBe(true);
    expect(isProductIconKey("nope")).toBe(false);
    expect(isProductIconKey(undefined)).toBe(false);
  });
});

describe("resolveProductIcon", () => {
  it("usa el icono del producto, luego el del tipo y si no hay, nada", () => {
    expect(resolveProductIcon({ icon: "taco", product_type: { icon: "cup" } })).toBe("taco");
    expect(resolveProductIcon({ icon: null, product_type: { icon: "cup" } })).toBe("cup");
    expect(resolveProductIcon({ icon: null, type_icon: "gear" })).toBe("gear");
    expect(resolveProductIcon({ icon: null })).toBeNull();
    expect(resolveProductIcon(undefined)).toBeNull();
  });

  it("ignora una clave desconocida (versión más nueva de la API) y cae al respaldo", () => {
    expect(resolveProductIcon({ icon: "futuro", product_type: { icon: "cup" } })).toBe("cup");
    expect(resolveProductIcon({ icon: "futuro", type_icon: "viejo" })).toBeNull();
  });
});
