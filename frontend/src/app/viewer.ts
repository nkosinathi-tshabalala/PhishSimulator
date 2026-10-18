// Who is signed in, for the "to" line of training messages (the player is the recipient)

import { createContext, useContext } from "react";

export interface Viewer {
  name: string;
  email: string;
}

export const ViewerContext = createContext<Viewer | null>(null);

/** The signed-in player, or null outside a player page. */
export function useViewer() {
  return useContext(ViewerContext);
}
