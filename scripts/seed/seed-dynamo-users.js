/**
 * Demo / judge accounts are no longer seeded by this script.
 *
 * The app creates them itself when the server starts
 * (src/backend/bootstrap/seed-accounts.ts), for DynamoDB and for the
 * data-directory store alike, together with the guardian link and the
 * legal-guardian consent record. Passwords come only from the environment:
 *
 *   JUDGE_PASSWORD                               → judge-child@beddy.test / judge-guardian@beddy.test
 *   DEMO_CHILD_PASSWORD / DEMO_GUARDIAN_PASSWORD → demo-child@beddy.test / demo-guardian@beddy.test
 *   (or DEMO_PASSWORD for both demo accounts)
 *
 * Accounts whose passwords used to live in the repository are retired.
 * To restore specific accounts, use scripts/seed/restore-dynamo-users.js.
 */
console.log(
  [
    "계정은 앱이 시작할 때 만들어집니다 (src/backend/bootstrap/seed-accounts.ts).",
    "환경 변수 JUDGE_PASSWORD, DEMO_CHILD_PASSWORD, DEMO_GUARDIAN_PASSWORD(또는 DEMO_PASSWORD)를 넣고 서버를 시작하세요.",
    "비밀번호 규칙: 8~20자, 영문·숫자·특수문자 포함.",
    "특정 계정을 복구하려면: npm run restore:users",
  ].join("\n")
);
