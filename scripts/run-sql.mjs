/**
 * SQL 파일 실행기
 *
 *   npm run db:migrate -- db/supabase/002_market_products.sql
 *
 * Supabase SQL Editor 에 붙여넣는 대신 터미널에서 실행한다.
 * 파일 전체를 하나의 요청으로 보내므로 Postgres 가 암묵적 트랜잭션으로 처리한다
 * (중간에 실패하면 전부 롤백된다).
 */
import fs from "node:fs";
import path from "node:path";
import { Client } from "pg";

const file = process.argv[2];

if (!file) {
  console.log("\n사용법: npm run db:migrate -- <SQL 파일 경로>");
  console.log("예:     npm run db:migrate -- db/supabase/002_market_products.sql\n");
  process.exit(1);
}

const fullPath = path.resolve(process.cwd(), file);
if (!fs.existsSync(fullPath)) {
  console.log(`\n❌ 파일을 찾을 수 없습니다: ${fullPath}\n`);
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.log("\n❌ DATABASE_URL 이 설정되지 않았습니다. .env.local 을 확인하세요.\n");
  process.exit(1);
}

const sql = fs.readFileSync(fullPath, "utf8");
console.log(`\n━━━ 실행: ${path.basename(fullPath)} (${sql.length.toLocaleString()}자) ━━━\n`);

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15_000,
  statement_timeout: 120_000,
});

try {
  await client.connect();
  console.log("  ✅ 접속 성공");

  const results = await client.query(sql);
  console.log("  ✅ 실행 완료\n");

  // 마지막 SELECT (확인 쿼리) 결과를 표로 보여준다.
  const list = Array.isArray(results) ? results : [results];
  const lastSelect = [...list].reverse().find((r) => r?.rows?.length > 0);
  if (lastSelect) {
    console.table(lastSelect.rows);
  }
} catch (error) {
  const message = String(error?.message ?? error);
  console.log(`\n❌ 실행 실패 — 변경사항은 모두 롤백되었습니다.\n`);
  console.log(`   ${message}`);
  if (error?.detail) console.log(`   상세: ${error.detail}`);
  if (error?.hint) console.log(`   힌트: ${error.hint}`);
  if (error?.position) console.log(`   위치: 문자 ${error.position} 부근`);
  console.log("");
  process.exit(1);
} finally {
  await client.end().catch(() => undefined);
}

console.log("✅ 마이그레이션이 적용되었습니다.\n");
