import { Pool, types, type PoolClient, type QueryResultRow } from "pg";

/**
 * Postgres(Supabase) 커넥션 풀
 *
 * 접속 대상은 Supabase 프로젝트의 `namu` 스키마다. (db/supabase/001_init_namu.sql)
 * 서버리스에서는 인스턴스가 계속 새로 뜨므로 반드시 트랜잭션 풀러(6543)를 쓴다.
 *   postgresql://postgres.<ref>:<password>@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres
 */

// int8(bigint) 는 기본적으로 문자열로 오지만, 이 앱의 순번·집계는 모두 안전 정수 범위다.
types.setTypeParser(types.builtins.INT8, (v) => Number(v));
// numeric 은 예상 대기시간·캐시백 비율에만 쓰이므로 number 로 다룬다.
types.setTypeParser(types.builtins.NUMERIC, (v) => Number(v));

export function isPostgresEnabled(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

function createPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL 환경변수가 설정되지 않았습니다. Supabase 연결 문자열을 지정하세요."
    );
  }

  // Supabase 는 TLS 필수. 풀러 인증서 체인이 Node 기본 신뢰 저장소에 없을 수 있어
  // 기본값은 검증을 완화하되, 사설 CA 를 등록했다면 환경변수로 강제할 수 있게 둔다.
  const rejectUnauthorized = process.env.PGSSL_REJECT_UNAUTHORIZED === "true";

  return new Pool({
    connectionString,
    ssl: { rejectUnauthorized },
    // 서버리스 인스턴스마다 풀이 생기므로 인스턴스당 커넥션은 적게 유지한다.
    max: Number(process.env.PGPOOL_MAX ?? 3),
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
    // 폭주 시 느린 쿼리가 인스턴스를 붙잡지 않도록 상한을 둔다.
    statement_timeout: 15_000,
    query_timeout: 15_000,
  });
}

// 개발 서버 HMR 로 모듈이 재평가돼도 풀이 중복 생성되지 않도록 보관한다.
const globalRef = globalThis as unknown as { __npPool?: Pool };

export function pool(): Pool {
  if (!globalRef.__npPool) {
    globalRef.__npPool = createPool();
    globalRef.__npPool.on("error", (err) => {
      // 유휴 커넥션이 끊겨도 프로세스가 죽지 않도록 흡수한다.
      console.error("[db] idle client error", err);
    });
  }
  return globalRef.__npPool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<T[]> {
  const result = await pool().query<T>(text, params as never[]);
  return result.rows;
}

export async function queryOne<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

/** 여러 문장을 한 트랜잭션으로 묶어야 할 때 사용한다. */
export async function transaction<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool().connect();
  try {
    await client.query("begin");
    const result = await fn(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * 001_init_namu.sql 이 정의한 도메인 오류 코드.
 * DB 함수가 RAISE 로 던지는 SQLSTATE 를 애플리케이션 오류로 옮긴다.
 */
export const PG_ERROR = {
  INTAKE_PAUSED: "NP001",
  INVALID_PARTNER: "NP002",
  INVALID_CATEGORY: "NP003",
  DUPLICATE_APPLICATION: "NP004",
  APPLICATION_NOT_FOUND: "NP005",
} as const;

export function pgErrorCode(error: unknown): string | null {
  if (error && typeof error === "object" && "code" in error) {
    return String((error as { code: unknown }).code);
  }
  return null;
}
