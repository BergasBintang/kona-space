// The name of a room, as the art build wrote it (every side of the building has the same rooms).
import v0 from "../office/views/v0.json";

export const roomName = (id: string) => v0.rooms.find((r) => r.id === id)?.name ?? id;
