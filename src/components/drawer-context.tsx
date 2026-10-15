import { createContext, useContext, useMemo, useState, type PropsWithChildren } from "react";

interface DrawerValue {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

const DrawerContext = createContext<DrawerValue | null>(null);

export function DrawerProvider({ children }: PropsWithChildren) {
  const [isOpen, setOpen] = useState(false);
  const value = useMemo(() => ({ isOpen, open: () => setOpen(true), close: () => setOpen(false) }), [isOpen]);
  return <DrawerContext.Provider value={value}>{children}</DrawerContext.Provider>;
}

export function useDrawer(): DrawerValue {
  const value = useContext(DrawerContext);
  if (!value) throw new Error("useDrawer fuera de DrawerProvider");
  return value;
}
