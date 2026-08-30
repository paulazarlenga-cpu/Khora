export type SequentialCodeKind = "PRODUCT" | "COMBO" | "MIXTURE";

type ParsedCode = { prefix: string; number: number; width: number };

function parseSequentialCode(value: string): ParsedCode | null {
  const match = value.trim().toUpperCase().match(/^(.*?)(\d+)$/);
  if (!match || !match[1]) return null;
  return { prefix: match[1], number: Number(match[2]), width: match[2].length };
}

export function nextSequentialCode(codes: string[], kind: SequentialCodeKind) {
  const fallback = kind === "COMBO" ? { prefix: "COM-", width: 3 } : kind === "MIXTURE" ? { prefix: "MZ-", width: 3 } : { prefix: "PRO-", width: 3 };
  const groups = new Map<string, ParsedCode[]>();

  for (const code of codes) {
    const parsed = parseSequentialCode(code);
    if (!parsed || !Number.isSafeInteger(parsed.number)) continue;
    groups.set(parsed.prefix, [...(groups.get(parsed.prefix) ?? []), parsed]);
  }

  const selected = [...groups.values()].sort((left, right) => {
    if (right.length !== left.length) return right.length - left.length;
    return Math.max(...right.map((item) => item.number)) - Math.max(...left.map((item) => item.number));
  })[0];
  if (!selected) return `${fallback.prefix}${String(1).padStart(fallback.width, "0")}`;

  const highest = Math.max(...selected.map((item) => item.number));
  const width = Math.max(...selected.map((item) => item.width));
  return `${selected[0].prefix}${String(highest + 1).padStart(width, "0")}`;
}

export function isSequentialCodeConflict(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /unique constraint failed:\s*code_base\.code/i.test(message)
    || /code_base_code_uq/i.test(message);
}

export async function createWithGeneratedCode<T>(options: {
  listCodes: () => Promise<string[]>;
  nextCode: (codes: string[]) => string;
  create: (code: string) => Promise<T>;
  attempts?: number;
}) {
  const attempts = Math.max(1, options.attempts ?? 5);
  let lastConflict: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const code = options.nextCode(await options.listCodes());
    try {
      return { code, value: await options.create(code) };
    } catch (error) {
      if (!isSequentialCodeConflict(error)) throw error;
      lastConflict = error;
    }
  }
  throw new Error(`No se pudo reservar un código único después de ${attempts} intentos. ${String(lastConflict ?? "")}`.trim());
}

export function createWithSequentialCode<T>(options: {
  kind: SequentialCodeKind;
  listCodes: () => Promise<string[]>;
  create: (code: string) => Promise<T>;
  attempts?: number;
}) {
  return createWithGeneratedCode({ ...options, nextCode: (codes) => nextSequentialCode(codes, options.kind) });
}
