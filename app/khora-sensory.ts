export const SENSORY_KINDS = ["FAMILY", "NOTE", "SENSATION", "INTENSITY", "ROOM", "MOMENT"] as const;
export type SensoryKind = typeof SENSORY_KINDS[number];

export type SensoryOption = {
  id: number;
  kind: SensoryKind;
  slug: string;
  label: string;
  sort_order: number;
};

export type SensoryProfile = {
  families: number[];
  notes: number[];
  sensations: number[];
  intensity: number | null;
  rooms: number[];
  moment: number | null;
};

export function emptySensoryProfile(): SensoryProfile {
  return {
    families: [],
    notes: [],
    sensations: [],
    intensity: null,
    rooms: [],
    moment: null,
  };
}

export type SensorySelection = { optionId: number; kind: SensoryKind; sortOrder: number };
export type ParsedSensoryProfile = { provided: boolean; profile: SensoryProfile };

const positiveId = (value: unknown, label: string) => {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new Error(`${label}: cada ID debe ser un entero positivo.`);
  return id;
};

const multipleIds = (value: unknown, label: string) => {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error(`${label}: se esperaba una lista.`);
  return [...new Set(value.map((item) => positiveId(item, label)))];
};

const singleId = (value: unknown, label: string) => {
  if (value === undefined || value === null || value === "") return null;
  if (Array.isArray(value)) throw new Error(`${label}: elegí una sola opción.`);
  return positiveId(value, label);
};

export function parseSensoryProfile(value: unknown): ParsedSensoryProfile {
  if (value === undefined) return { provided: false, profile: emptySensoryProfile() };
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("El perfil sensorial es inválido.");
  const input = value as Record<string, unknown>;
  return { provided: true, profile: {
    families: multipleIds(input.families, "Familias"),
    notes: multipleIds(input.notes, "Notas aromáticas"),
    sensations: multipleIds(input.sensations, "Sensaciones"),
    intensity: singleId(input.intensity, "Intensidad"),
    rooms: multipleIds(input.rooms, "Ambientes"),
    moment: singleId(input.moment, "Momento recomendado"),
  } };
}

const ordered = (ids: number[], kind: SensoryKind): SensorySelection[] =>
  ids.map((optionId, sortOrder) => ({ optionId, kind, sortOrder }));

export function sensorySelections(profile: SensoryProfile): SensorySelection[] {
  return [
    ...ordered(profile.families, "FAMILY"),
    ...ordered(profile.notes, "NOTE"),
    ...ordered(profile.sensations, "SENSATION"),
    ...(profile.intensity ? [{ optionId: profile.intensity, kind: "INTENSITY" as const, sortOrder: 0 }] : []),
    ...ordered(profile.rooms, "ROOM"),
    ...(profile.moment ? [{ optionId: profile.moment, kind: "MOMENT" as const, sortOrder: 0 }] : []),
  ];
}

export function sensoryProfileFromRows(rows: Array<Record<string, unknown>>): SensoryProfile {
  const profile: SensoryProfile = { families: [], notes: [], sensations: [], intensity: null, rooms: [], moment: null };
  const sorted = [...rows].sort((a, b) => Number(a.sort_order) - Number(b.sort_order));
  for (const row of sorted) {
    const optionId = positiveId(row.option_id, "Perfil guardado");
    if (row.kind === "FAMILY") profile.families.push(optionId);
    else if (row.kind === "NOTE") profile.notes.push(optionId);
    else if (row.kind === "SENSATION") profile.sensations.push(optionId);
    else if (row.kind === "INTENSITY") profile.intensity = optionId;
    else if (row.kind === "ROOM") profile.rooms.push(optionId);
    else if (row.kind === "MOMENT") profile.moment = optionId;
  }
  return profile;
}