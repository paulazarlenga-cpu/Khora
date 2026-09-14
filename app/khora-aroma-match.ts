export type PublicSensoryKind =
  | "FAMILY"
  | "NOTE"
  | "SENSATION"
  | "INTENSITY"
  | "ROOM"
  | "MOMENT";

export type PublicSensoryOption = {
  kind: PublicSensoryKind;
  slug: string;
  label: string;
};

export type PublicSensoryProfile = {
  families: PublicSensoryOption[];
  notes: PublicSensoryOption[];
  sensations: PublicSensoryOption[];
  intensity: PublicSensoryOption | null;
  rooms: PublicSensoryOption[];
  moment: PublicSensoryOption | null;
};

export type AromaAnswers = {
  sensation: string;
  room: string;
  family: string;
  intensity: string;
};

export type AromaMatch = {
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
};

type PublicSensoryRow = {
  kind: string;
  slug: string;
  label: string;
  sort_order?: number;
};

const emptyProfile = (): PublicSensoryProfile => ({
  families: [],
  notes: [],
  sensations: [],
  intensity: null,
  rooms: [],
  moment: null,
});

function isPublicSensoryKind(kind: string): kind is PublicSensoryKind {
  return ["FAMILY", "NOTE", "SENSATION", "INTENSITY", "ROOM", "MOMENT"].includes(kind);
}

export function publicSensoryProfileFromRows(rows: PublicSensoryRow[]): PublicSensoryProfile {
  const profile = emptyProfile();
  const orderedRows = [...rows].sort((left, right) => (left.sort_order ?? 0) - (right.sort_order ?? 0));

  for (const row of orderedRows) {
    if (!isPublicSensoryKind(row.kind)) continue;
    const option: PublicSensoryOption = { kind: row.kind, slug: row.slug, label: row.label };
    if (row.kind === "FAMILY") profile.families.push(option);
    if (row.kind === "NOTE") profile.notes.push(option);
    if (row.kind === "SENSATION") profile.sensations.push(option);
    if (row.kind === "ROOM") profile.rooms.push(option);
    if (row.kind === "INTENSITY" && !profile.intensity) profile.intensity = option;
    if (row.kind === "MOMENT" && !profile.moment) profile.moment = option;
  }

  return profile;
}

export function aromaMatchLabel(score: AromaMatch["score"]): string {
  if (score === 4) return "Excelente compatibilidad";
  if (score === 3) return "Muy buena compatibilidad";
  if (score === 2) return "Buena compatibilidad";
  if (score === 1) return "Compatibilidad baja";
  return "";
}

export function calculateAromaMatch(profile: PublicSensoryProfile, answers: AromaAnswers): AromaMatch {
  const score = [
    profile.sensations.some((option) => option.slug === answers.sensation),
    profile.rooms.some((option) => option.slug === answers.room),
    profile.families.some((option) => option.slug === answers.family),
    profile.intensity?.slug === answers.intensity,
  ].filter(Boolean).length as AromaMatch["score"];

  return { score, label: aromaMatchLabel(score) };
}

export function hasPublicSensoryContent(profile: PublicSensoryProfile): boolean {
  return Boolean(
    profile.families.length ||
      profile.notes.length ||
      profile.sensations.length ||
      profile.intensity ||
      profile.rooms.length ||
      profile.moment,
  );
}
