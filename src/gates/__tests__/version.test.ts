import { fetchAppConfig } from "@/api/config";
import { compareVersions, mustUpdate } from "../version";

jest.mock("@/api/config", () => ({ fetchAppConfig: jest.fn() }));
jest.mock("@/api/client", () => ({ appVersion: () => "1.2.0" }));
jest.mock("react-native", () => ({ Platform: { OS: "ios" } }));

const config = (ios: string, android = "0.0.0") => ({ min_app_version: { ios, android } });

describe("compareVersions", () => {
  it("compara numéricamente, no como texto", () => {
    expect(compareVersions("1.10.0", "1.9.0")).toBeGreaterThan(0);
    expect(compareVersions("1.2.0", "1.2")).toBe(0);
    expect(compareVersions("0.9.9", "1.0.0")).toBeLessThan(0);
  });
});

describe("mustUpdate", () => {
  it("pide actualizar si la instalada es menor que la mínima", async () => {
    (fetchAppConfig as jest.Mock).mockResolvedValue(config("1.3.0"));
    await expect(mustUpdate()).resolves.toBe(true);
  });

  it("deja pasar si es igual o mayor", async () => {
    (fetchAppConfig as jest.Mock).mockResolvedValue(config("1.2.0"));
    await expect(mustUpdate()).resolves.toBe(false);
  });

  it("deja pasar si la API no responde (FR-027)", async () => {
    (fetchAppConfig as jest.Mock).mockResolvedValue(null);
    await expect(mustUpdate()).resolves.toBe(false);
  });
});
