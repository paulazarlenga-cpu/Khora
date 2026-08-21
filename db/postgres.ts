import postgres, { type Sql } from "postgres";

type Row = Record<string, unknown>;
type Queryable = Sql | Sql<Record<string, never>>;

export type KhoraQueryResult<T extends Row = Row> = {
  results: T[];
  success: true;
  meta: {
    changes: number;
  };
};

function databaseUrl() {
  const value = process.env.DATABASE_URL?.trim();
  if (!value) {
    throw new Error(
      "Falta DATABASE_URL. Usá la conexión Pooler de Supabase en las variables de entorno.",
    );
  }
  return value;
}

function postgresSql(source: string) {
  let parameter = 0;
  let quote: "'" | '"' | null = null;
  let output = "";

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    const next = source[index + 1];

    if (quote) {
      output += character;
      if (character === quote) {
        if (next === quote) {
          output += next;
          index += 1;
        } else {
          quote = null;
        }
      }
      continue;
    }

    if (character === "'" || character === '"') {
      quote = character;
      output += character;
      continue;
    }

    if (character === "?") {
      parameter += 1;
      output += `$${parameter}`;
      continue;
    }

    output += character;
  }

  if (/^\s*INSERT\s+OR\s+IGNORE\s+INTO/i.test(output)) {
    output = output.replace(/^\s*INSERT\s+OR\s+IGNORE\s+INTO/i, "INSERT INTO");
    output = `${output.replace(/;\s*$/, "")} ON CONFLICT DO NOTHING`;
  }

  return output;
}

class KhoraPreparedStatement {
  private parameters: unknown[] = [];

  constructor(
    private readonly source: string,
    private readonly connection?: Queryable,
  ) {}

  bind(...parameters: unknown[]) {
    this.parameters = parameters;
    return this;
  }

  withConnection(connection: Queryable) {
    const statement = new KhoraPreparedStatement(this.source, connection);
    statement.parameters = this.parameters;
    return statement;
  }

  private async execute() {
    const connection = this.connection ?? getPostgresClient();
    return connection.unsafe(postgresSql(this.source), this.parameters as never[]);
  }

  async all<T extends Row = Row>(): Promise<KhoraQueryResult<T>> {
    const queryResult = await this.execute();
    const rows = queryResult as unknown as T[];
    const count = (queryResult as unknown as { count?: number }).count;
    return {
      results: rows,
      success: true,
      meta: { changes: count ?? rows.length },
    };
  }

  async first<T extends Row = Row>(): Promise<T | null> {
    const result = await this.all<T>();
    return result.results[0] ?? null;
  }

  async run<T extends Row = Row>(): Promise<KhoraQueryResult<T>> {
    return this.all<T>();
  }
}

type GlobalWithPostgres = typeof globalThis & {
  __khoraPostgres?: ReturnType<typeof postgres>;
};

function getPostgresClient() {
  const globalStore = globalThis as GlobalWithPostgres;
  if (!globalStore.__khoraPostgres) {
    globalStore.__khoraPostgres = postgres(databaseUrl(), {
      max: 4,
      idle_timeout: 20,
      connect_timeout: 15,
      prepare: false,
      ssl: "require",
    });
  }
  return globalStore.__khoraPostgres;
}

export const khoraDb = {
  prepare(source: string) {
    return new KhoraPreparedStatement(source);
  },

  async batch(statements: KhoraPreparedStatement[]) {
    const client = getPostgresClient();
    return client.begin(async (transaction) => {
      const results: KhoraQueryResult[] = [];
      for (const statement of statements) {
        results.push(await statement.withConnection(transaction).all());
      }
      return results;
    });
  },
};

export type KhoraDatabase = typeof khoraDb;
