import { changeOrMissing, formatMoney, parseMoney } from "../money";

describe("dinero", () => {
  it("da formato en pesos", () => {
    expect(formatMoney(1234.5)).toBe("$1,234.50");
    expect(formatMoney("80")).toBe("$80.00");
    expect(formatMoney(null)).toBe("$0.00");
  });

  it("lee montos escritos a mano", () => {
    expect(parseMoney("1,200.5")).toBe(1200.5);
    expect(parseMoney("$ 300")).toBe(300);
    expect(parseMoney("")).toBeNull();
    expect(parseMoney("abc")).toBeNull();
    expect(parseMoney("1.234")).toBeNull();
    expect(parseMoney("-5")).toBeNull();
  });

  it("calcula cambio o faltante sin errores de punto flotante", () => {
    expect(changeOrMissing(80, 100)).toEqual({ change: 20, missing: 0 });
    expect(changeOrMissing(0.3, 0.1 + 0.2)).toEqual({ change: 0, missing: 0 });
    expect(changeOrMissing(100, 60.5)).toEqual({ change: 0, missing: 39.5 });
  });
});
