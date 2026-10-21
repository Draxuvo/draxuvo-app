import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react-native";
import type { ReactElement } from "react";
import { SessionProvider } from "@/session";
import { resetToasts } from "@/toast/store";
import { ToastHost } from "@/toast/toast-host";

/** Pinta una pantalla con consultas y sesión reales (la sesión sale de lo sembrado en SecureStore). */
export async function renderScreen(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  resetToasts();
  const view = await render(
    <QueryClientProvider client={client}>
      <SessionProvider>
        {ui}
        <ToastHost />
      </SessionProvider>
    </QueryClientProvider>,
  );
  return { ...view, client };
}
