// Whether the page that holds a component is the one shown. A page the owner minimized stays alive behind the tray (decision 95), but it must not react to keys or ask for things
// while it is out of sight. The sheet that holds a page provides this; outside a sheet it is always true.
import { createContext, useContext } from "react";

export const PageActive = createContext(true);
export const usePageActive = (): boolean => useContext(PageActive);
