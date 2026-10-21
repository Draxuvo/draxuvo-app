
import {
  categoryColor, filterMenu, inOrderCount, groupByRound, normalize, orderSummary, runningTotal, screenMode, tapProduct, type Line,
} from "@/components/take-order/lib";

const line = (over: Partial<Line> = {}): Line => ({
  id: 1, product_id: 10, name: "Tostada", quantity: 1, unit_price: 30, editable: true, sent: false, ...over,
});

describe("screenMode", () => {
  it("usa cuentas de mesa con el módulo de restaurante", () => {
    expect(screenMode(["restaurant", "work_orders"], "service")).toBe("restaurant");
  });
  it("usa órdenes sin restaurante y en modo pedido", () => {
    expect(screenMode(["work_orders"], "order")).toBe("orders");
  });
  it("no aplica en modo servicio sin restaurante", () => {
    expect(screenMode(["work_orders"], "service")).toBe("none");
  });
});

describe("normalize y filterMenu", () => {
  const menu = [
    { category: "Antojitos", items: [{ id: 1, name: "Tostada de camarón", price: 30 }, { id: 2, name: "Sope", price: 25 }] },
    { category: "Bebidas", items: [{ id: 3, name: "Café", price: 20 }] },
  ];
  it("quita acentos y mayúsculas", () => expect(normalize("  CAFÉ ")).toBe("cafe"));
  it("filtra sin acentos y descarta grupos vacíos", () => {
    expect(filterMenu(menu, "CAMARON")).toEqual([{ category: "Antojitos", items: [menu[0].items[0]] }]);
    expect(filterMenu(menu, "cafe").map((s) => s.category)).toEqual(["Bebidas"]);
  });
  it("sin término devuelve todo", () => expect(filterMenu(menu, " ")).toBe(menu));
});

describe("tapProduct", () => {
  it("sube el renglón editable del producto", () => {
    const l = line();
    expect(tapProduct([l], { id: 10, name: "Tostada" })).toEqual({ kind: "increment", line: l });
  });
  it("agrega si no hay renglón, si ya se mandó o si lleva nota", () => {
    expect(tapProduct([], { id: 10, name: "Tostada" })).toEqual({ kind: "add" });
    expect(tapProduct([line({ editable: false, sent: true })], { id: 10, name: "Tostada" })).toEqual({ kind: "add" });
    expect(tapProduct([line({ note: "sin cebolla" })], { id: 10, name: "Tostada" })).toEqual({ kind: "add" });
  });
});

describe("runningTotal e inOrderCount", () => {
  it("suma los renglones no cancelados", () => {
    expect(runningTotal([line({ quantity: 2 }), line({ id: 2, unit_price: 10.1 }), line({ id: 3, cancelled: true })])).toBe(70.1);
  });
  it("cuenta solo lo editable del producto", () => {
    expect(inOrderCount([line({ quantity: 2 }), line({ id: 2, editable: false })], { id: 10, name: "Tostada" })).toBe(2);
  });
  it("en una cuenta compara por nombre porque el renglón no trae el producto", () => {
    expect(inOrderCount([line({ product_id: null, quantity: 3 })], { id: 99, name: "Tostada" })).toBe(3);
  });
});

describe("categoryColor", () => {
  it("es estable", () => expect(categoryColor("Bebidas")).toBe(categoryColor("Bebidas")));
  it("usa un color de la paleta", () => expect(categoryColor("x")).toMatch(/^#[0-9A-F]{6}$/));
});

describe("orderSummary", () => {
  it("suma productos y total sin los renglones cancelados", () => {
    expect(orderSummary([line({ quantity: 2 }), line({ id: 2, quantity: 1, unit_price: 25 }), line({ id: 3, quantity: 5, cancelled: true })])).toEqual({ count: 3, total: 85 });
  });
  it("una orden vacía da cero", () => expect(orderSummary([])).toEqual({ count: 0, total: 0 }));
});

describe("groupByRound", () => {
  const it_ = (id: number, round: number | null) => ({ id, kitchen_order_number: round }) as never;
  it("agrupa por comanda en orden y deja fuera lo sin mandar", () => {
    const groups = groupByRound([it_(1, 2), it_(2, 1), it_(3, null), it_(4, 2)]);
    expect(groups.map((g) => [g.number, g.items.map((i: { id: number }) => i.id)])).toEqual([[1, [2]], [2, [1, 4]]]);
  });
});
