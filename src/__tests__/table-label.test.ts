import { tableLabel } from "@/lib/table-label";

describe("tableLabel", () => {
  it("antepone Mesa a una mesa que se llama con un número", () => {
    expect(tableLabel("check.table", "4")).toBe("Mesa 4");
    expect(tableLabel("ticket.table", "12")).toBe("Mesa 12");
  });
  it("no repite la palabra si la mesa ya se llama Mesa 1", () => {
    expect(tableLabel("check.table", "Mesa 1")).toBe("Mesa 1");
    expect(tableLabel("orders.openChecks.table", " mesa 7 ")).toBe(" mesa 7 ");
  });
  it("una mesa cuyo nombre solo empieza parecido sí lleva el prefijo", () => {
    expect(tableLabel("check.table", "Mesanine")).toBe("Mesa Mesanine");
  });
});
