/**
 * Supabase 연결 진단 스크립트
 *
 *   npm run db:check
 *
 * .env.local 의 DATABASE_URL 로 실제 접속을 시도하고,
 * namu 스키마가 제대로 준비됐는지 항목별로 확인한다.
 * 실패하면 원인과 해결 방법을 함께 안내한다.
 */
import { Client } from "pg";

const ok = (m) => console.log(`  ✅ ${m}`);
const bad = (m) => console.log(`  ❌ ${m}`);
const info = (m) => console.log(`     ${m}`);

function fail(title, ...lines) {
  console.log(`\n❌ ${title}\n`);
  for (const line of lines) console.log(`   ${line}`);
  console.log("");
  process.exit(1);
}

console.log("\n━━━ Supabase 연결 진단 ━━━\n");

/* 1. 환경변수 확인 ------------------------------------------------------ */

const url = process.env.DATABASE_URL;

if (!url) {
  fail(
    "DATABASE_URL 이 설정되지 않았습니다.",
    ".env.local 파일에 DATABASE_URL 한 줄을 추가하세요.",
    "파일이 없으면 .env.example 을 복사해서 만드시면 됩니다."
  );
}

if (url.includes("여기에_비밀번호") || url.includes("[YOUR-PASSWORD]")) {
  fail(
    "비밀번호를 아직 바꾸지 않았습니다.",
    ".env.local 의 DATABASE_URL 에서 비밀번호 자리를 실제 값으로 바꾸세요.",
    "",
    "비밀번호를 모르면 Supabase 대시보드에서 재설정할 수 있습니다:",
    "Settings → Database → Database password → Reset database password"
  );
}

let parsed;
try {
  parsed = new URL(url);
} catch {
  fail(
    "DATABASE_URL 형식이 올바르지 않습니다.",
    "비밀번호에 @ : / ? # 같은 특수문자가 있으면 주소가 깨집니다.",
    "가장 쉬운 해결책은 특수문자 없는 비밀번호로 재설정하는 것입니다.",
    "(Settings → Database → Reset database password)"
  );
}

ok(`호스트 : ${parsed.hostname}`);
ok(`포트   : ${parsed.port}`);
ok(`사용자 : ${decodeURIComponent(parsed.username)}`);

if (parsed.port !== "6543") {
  console.log("");
  bad(`포트가 ${parsed.port} 입니다. 트랜잭션 풀러(6543)를 권장합니다.`);
  info("5432(세션 풀러/직접 연결)로도 동작은 하지만,");
  info("Vercel 같은 서버리스 환경에서는 커넥션이 금방 고갈됩니다.");
  info("로컬 개발만 할 거라면 이대로 진행해도 괜찮습니다.");
}

/* 2. 접속 -------------------------------------------------------------- */

console.log("\n━━━ 접속 시도 ━━━\n");

const client = new Client({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15_000,
});

try {
  await client.connect();
  ok("접속 성공");
} catch (error) {
  const message = String(error?.message ?? error);
  console.log("");

  // 풀러는 DNS 는 정상이어도 "이 프로젝트를 모른다"고 답할 수 있다.
  // 메시지에 ENOTFOUND 가 섞여 나오므로 DNS 오류보다 먼저 판정해야 한다.
  if (/tenant|Tenant or user not found/i.test(message)) {
    const host = parsed.hostname;
    const flipped = host.startsWith("aws-0")
      ? host.replace("aws-0", "aws-1")
      : host.replace("aws-1", "aws-0");
    fail(
      "풀러가 이 프로젝트를 찾지 못했습니다. 호스트 주소가 틀렸습니다.",
      `서버 응답: ${message}`,
      "",
      "주소는 살아 있지만 이 프로젝트를 담당하는 풀러가 아닙니다.",
      "aws-0 / aws-1 처럼 앞 번호가 프로젝트마다 다릅니다.",
      "",
      ".env.local 의 호스트를 아래로 바꿔서 다시 시도해 보세요:",
      `  ${flipped}`,
      "",
      "그래도 안 되면 대시보드 → Connect → Connection string 의 값을 그대로 쓰세요."
    );
  }

  if (/password authentication failed|SASL|SCRAM/i.test(message)) {
    fail(
      "비밀번호가 틀렸습니다.",
      `서버 응답: ${message}`,
      "",
      "여기서 재설정하세요 (주소창에 그대로 붙여넣기):",
      `https://supabase.com/dashboard/project/${
        decodeURIComponent(parsed.username).split(".")[1] ?? "<project-ref>"
      }/settings/database`,
      "",
      "→ Database password → Reset database password",
      "→ 새 비밀번호를 만든 뒤 .env.local 의 : 와 @ 사이 부분만 교체",
      "",
      "주의: Supabase 로그인 계정 비밀번호가 아니라",
      "      데이터베이스 전용 비밀번호입니다. 서로 다릅니다."
    );
  }
  if (/ENOTFOUND|EAI_AGAIN|getaddrinfo/i.test(message)) {
    fail(
      "호스트 주소를 찾을 수 없습니다.",
      `서버 응답: ${message}`,
      "",
      "Supabase 대시보드 → Connect → Connection string 에 표시된",
      "호스트 주소를 그대로 복사해 쓰세요. (aws-0 / aws-1 등이 다를 수 있습니다)"
    );
  }
  if (/ETIMEDOUT|timeout/i.test(message)) {
    fail(
      "접속이 시간 초과되었습니다.",
      `서버 응답: ${message}`,
      "",
      "회사 방화벽이 6543 포트를 막고 있을 수 있습니다.",
      "네트워크를 바꿔서(예: 모바일 핫스팟) 다시 시도해 보세요."
    );
  }
  fail("접속에 실패했습니다.", `서버 응답: ${message}`);
}

/* 3. 스키마 확인 -------------------------------------------------------- */

console.log("\n━━━ namu 스키마 확인 ━━━\n");

try {
  const { rows } = await client.query(`
    select
      (select count(*) from information_schema.tables
        where table_schema = 'namu' and table_type = 'BASE TABLE')          as tables,
      (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'namu')                                           as functions,
      (select count(*) from namu.partners where active)                     as partners,
      (select count(*) from namu.products where active)                     as products,
      (select count(*) from namu.settings)                                  as settings,
      (select count(*) from namu.applications)                              as applications
  `);

  const r = rows[0];
  const expectTables = 8;

  if (Number(r.tables) < expectTables) {
    fail(
      `테이블이 ${r.tables}개뿐입니다. (${expectTables}개 필요)`,
      "초기화 스크립트를 아직 실행하지 않은 것 같습니다.",
      "Supabase 대시보드 → SQL Editor 에서",
      "db/supabase/001_init_namu.sql 전체를 붙여넣고 실행하세요."
    );
  }

  ok(`테이블 ${r.tables}개 · 함수 ${r.functions}개`);
  ok(`협약단체 ${r.partners}개 · 보험상품 ${r.products}개`);
  ok(`운영 설정 ${r.settings}행 · 접수 ${r.applications}건`);

  if (Number(r.settings) !== 1) {
    bad("namu.settings 행이 1개가 아닙니다. 대기열이 정상 동작하지 않습니다.");
    info("SQL Editor 에서 실행: insert into namu.settings (id) values (true) on conflict do nothing;");
  }

  // 대기열 함수가 실제로 호출 가능한지까지 확인한다.
  await client.query("select * from namu.drain_queue()");
  ok("대기열 함수 호출 성공 (namu.drain_queue)");

  const stats = await client.query("select * from namu.public_stats()");
  ok(`집계 함수 호출 성공 — 누적 접수 ${stats.rows[0].application_count}건`);
} catch (error) {
  const message = String(error?.message ?? error);
  console.log("");
  if (/schema "namu" does not exist|does not exist/i.test(message)) {
    fail(
      "namu 스키마 또는 객체가 없습니다.",
      `서버 응답: ${message}`,
      "",
      "Supabase 대시보드 → SQL Editor 에서",
      "db/supabase/001_init_namu.sql 전체를 붙여넣고 실행하세요."
    );
  }
  if (/permission denied/i.test(message)) {
    fail(
      "권한이 없습니다.",
      `서버 응답: ${message}`,
      "",
      "연결 문자열의 사용자가 postgres 인지 확인하세요.",
      "(Connection string 을 대시보드에서 그대로 복사하면 됩니다)"
    );
  }
  fail("스키마 확인 중 오류가 발생했습니다.", `서버 응답: ${message}`);
} finally {
  await client.end().catch(() => undefined);
}

console.log("\n✅ 모든 확인을 통과했습니다. 이제 npm run dev 로 실행하세요.\n");
