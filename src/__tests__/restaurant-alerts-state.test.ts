import type { CheckSummary, ReadyItem, TablesResponse, TableState, TableSummary } from "@/api/types";
import { alertsDelta } from "@/hooks/use-restaurant-alerts";

const ready = (id: number, name = "Tacos al pastor"): ReadyItem => ({
  id, name, quantity: 1, check_id: 31, table: "4", takeout_name: null, ready_at: "2026-10-19T19:00:00Z",
});
const check = (id: number, over: Partial<CheckSummary> = {}): CheckSummary => ({
  id, opened_at: "2026-10-19T18:00:00Z", total: "120.00", counts: { new: 0, preparing: 0, ready: 0, delivered: 2 }, mine: true, ...over,
});
const table = (id: number, name: string, state: TableState, own: CheckSummary | null): TableSummary => ({ id, name, active: true, position: id, state, check: own });
const overview = (over: Partial<TablesResponse> = {}): TablesResponse => ({ results: [], takeouts: [], ready_items: [], ...over });

describe("diferencia entre sondeos de los avisos", () => {
  it("la carga inicial no anuncia nada", () => {
    const data = overview({ ready_items: [ready(1)], results: [table(4, "Mesa 4", "to_pay", check(31))] });

    const delta = alertsDelta(null, data);

    expect(delta.fresh).toEqual([]);
    expect(delta.opened).toEqual([]);
    expect(delta.freshReady).toBe(false);
    expect([...delta.present].sort()).toEqual(["ready:1", "to_pay:31"]);
  });

  it("un artículo nuevo que pasa a listo se anuncia y hace sonar", () => {
    const delta = alertsDelta(overview(), overview({ ready_items: [ready(1)] }));

    expect(delta.fresh).toEqual(["ready:1"]);
    expect(delta.freshReady).toBe(true);
  });

  it("una cuenta propia que queda por cobrar se anuncia", () => {
    const before = overview({ results: [table(4, "Mesa 4", "occupied", check(31))] });
    const after = overview({ results: [table(4, "Mesa 4", "to_pay", check(31))] });

    const delta = alertsDelta(before, after);

    expect(delta.fresh).toEqual(["to_pay:31"]);
    expect(delta.freshReady).toBe(false);
  });

  it("una cuenta que no es de la persona no se anuncia", () => {
    const before = overview({ results: [table(4, "Mesa 4", "occupied", check(31, { mine: false }))] });
    const after = overview({ results: [table(4, "Mesa 4", "to_pay", check(31, { mine: false }))] });

    expect(alertsDelta(before, after).fresh).toEqual([]);
  });

  it("una mesa que toma otra persona se avisa", () => {
    const before = overview({ results: [table(4, "Mesa 4", "free", null)] });
    const after = overview({ results: [table(4, "Mesa 4", "occupied", check(31, { mine: false }))] });

    const delta = alertsDelta(before, after);

    expect(delta.opened).toEqual([{ key: "table:4", check: { id: 31, name: "Mesa 4" } }]);
  });

  it("una mesa que abre la propia persona no se avisa", () => {
    const before = overview({ results: [table(4, "Mesa 4", "free", null)] });
    const after = overview({ results: [table(4, "Mesa 4", "occupied", check(31))] });

    expect(alertsDelta(before, after).opened).toEqual([]);
  });

  it("lo que ya no está deja de estar presente", () => {
    const before = overview({ ready_items: [ready(1), ready(2)] });
    const after = overview({ ready_items: [ready(2)] });

    const delta = alertsDelta(before, after);

    expect([...delta.present]).toEqual(["ready:2"]);
    expect(delta.fresh).toEqual([]);
  });
});
