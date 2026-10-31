// The name of a room, as the standard office names it (a map of a project may draw the rooms anywhere, but a room keeps its id and its name).
import { STANDARD } from "../office/map";

export const roomName = (id: string) => STANDARD.rooms.find((r) => r.id === id)?.name ?? id;
