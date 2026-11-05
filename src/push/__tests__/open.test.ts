import { multiUser, staffUser } from "@/test/helpers";
import { parsePushData, planOpen } from "../open";

describe("abrir un aviso push (spec 057)", () => {
  it("lee los datos del aviso y solo acepta rutas conocidas", () => {
    expect(parsePushData({ kind: "check_ready", company_id: 10, path: "/pedido?cuenta=5&hoja=1" })).toEqual({
      kind: "check_ready",
      companyId: 10,
      path: "/pedido?cuenta=5&hoja=1",
    });
    expect(parsePushData({ kind: "x", company_id: 10, path: "https://evil.test" })?.path).toBe("/ordenes");
    expect(parsePushData(null)).toBeNull();
  });

  it("abre en la empresa activa sin cambiarla", () => {
    expect(planOpen({ kind: "check_ready", companyId: 10, path: "/pedido?cuenta=5&hoja=1" }, staffUser, 10)).toEqual({
      action: "open",
      switchTo: null,
      path: "/pedido?cuenta=5&hoja=1",
    });
  });

  it("cambia a la empresa del aviso si la persona sigue en ella", () => {
    expect(planOpen({ kind: "check_ready", companyId: 20, path: "/pedido?cuenta=5&hoja=1" }, multiUser, 10)).toMatchObject({
      action: "open",
      switchTo: 20,
    });
  });

  it("una empresa que ya no es suya no se abre", () => {
    expect(planOpen({ kind: "check_ready", companyId: 99, path: "/ordenes" }, staffUser, 10)).toEqual({ action: "noAccess" });
  });

  it("Alertas solo para jefes de esa empresa", () => {
    expect(planOpen({ kind: "operational_alert", companyId: 10, path: "/alertas" }, multiUser, 10)).toMatchObject({ path: "/alertas" });
    expect(planOpen({ kind: "operational_alert", companyId: 20, path: "/alertas" }, multiUser, 10)).toMatchObject({ path: "/ordenes" });
  });
});
