import { compact, duplicates, parseChoices, pickAlert, resolve } from "./choices";

describe("parseChoices", () => {
  it("devuelve vacío con JSON inválido o de otro tipo", () => {
    expect(parseChoices(null)).toEqual({});
    expect(parseChoices("{")).toEqual({});
    expect(parseChoices("[]")).toEqual({});
  });

  it("descarta alertas desconocidas y sonidos fuera del catálogo", () => {
    expect(parseChoices('{"ready":"campana","urgent":"nope","otra":"gota"}')).toEqual({ ready: "campana" });
  });
});

describe("resolve", () => {
  it("usa clasico para 'lista' sin elección o con un id inexistente", () => {
    expect(resolve("ready", {})).toBe("clasico");
    expect(resolve("ready", { ready: "nope" as never })).toBe("clasico");
  });

  it("las alertas que no suenan en el teléfono no tienen sonido por omisión", () => {
    expect(resolve("new_kitchen", {})).toBeUndefined();
  });

  it("usa la elección cuando existe", () => {
    expect(resolve("ready", { ready: "marimba" })).toBe("marimba");
  });
});

describe("pickAlert", () => {
  it("prefiere atrasada sobre nueva y nueva sobre lista", () => {
    expect(pickAlert(["ready", "new_bar", "urgent"])).toBe("urgent");
    expect(pickAlert(["ready", "new_bar"])).toBe("new_bar");
    expect(pickAlert([])).toBeUndefined();
  });
});

describe("duplicates", () => {
  it("con una sola alerta mostrada nunca hay repetidos", () => {
    expect(duplicates({ ready: "campana" }, ["ready"])).toEqual([]);
  });
});

describe("compact", () => {
  it("quita lo que coincide con el valor por omisión", () => {
    expect(compact({ ready: "clasico" })).toEqual({});
    expect(compact({ ready: "gota" })).toEqual({ ready: "gota" });
  });
});
