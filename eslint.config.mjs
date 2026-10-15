import { defineConfig, globalIgnores } from "eslint/config";
import expo from "eslint-config-expo/flat.js";

export default defineConfig([
  ...expo,
  globalIgnores(["node_modules/**", ".expo/**", "dist/**", "coverage/**", "expo-env.d.ts"]),
  {
    files: ["**/*.test.{ts,tsx}", "jest.setup.ts"],
    rules: { "@typescript-eslint/no-explicit-any": "off" },
  },
]);
