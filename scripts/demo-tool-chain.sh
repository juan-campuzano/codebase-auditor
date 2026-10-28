#!/usr/bin/env bash
# Deterministic multi-repo audit against a running local agent (no model key).
# Usage:
#   npx @grok/agent-sdk serve --dir . --mode single --dev --port 3000
#   bash scripts/demo-tool-chain.sh
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:3000}"

echo "Creating session on ${BASE_URL}..."
CREATE=$(curl -sS -X POST "${BASE_URL}/v1/session" \
  -H 'content-type: application/json' \
  -d '{"message":"Stand by for deterministic tool calls.","title":"demo-tool-chain"}')
SID=$(python3 -c "import json,sys; print(json.loads(sys.argv[1])['sessionId'])" "$CREATE")
echo "sessionId=${SID}"

# Wait until the opening turn settles (may fail without a Cursor API key).
for _ in $(seq 1 20); do
  TYPES=$(curl -sS "${BASE_URL}/v1/session/${SID}/events?format=json" \
    | python3 -c "import json,sys; d=json.load(sys.stdin); ev=d.get('events') or []; print(' '.join(e.get('type','') for e in ev))")
  case " ${TYPES} " in
    *" session.waiting "*|*" turn.completed "*|*" turn.failed "*) break ;;
  esac
  sleep 0.5
done

call() {
  local tool="$1"
  local input="$2"
  curl -sS -X POST "${BASE_URL}/v1/tools/${tool}" \
    -H 'content-type: application/json' \
    -d "$(python3 - <<PY
import json
print(json.dumps({"sessionId": "${SID}", "input": json.loads(r'''${input}''')}))
PY
)"
}

echo "Preparing three fixture repos..."
call prepare_repos '{"repos":[
  {"id":"python-service","sourcePath":"fixtures/sample-repos/python-service"},
  {"id":"dart-app","sourcePath":"fixtures/sample-repos/dart-app"},
  {"id":"java-service","sourcePath":"fixtures/sample-repos/java-service"}
]}' | python3 -c "import json,sys; d=json.load(sys.stdin); assert d.get('ok') and not d.get('isError'), d; print('prepared', d['result']['count'], 'repos')"

echo "Listing audit targets..."
call list_audit_targets '{"rulesPath":"rules/sample-rules.json","repoIds":["python-service","dart-app","java-service"]}' \
  | python3 -c "import json,sys; d=json.load(sys.stdin); assert d.get('ok') and not d.get('isError'), d;
[print(r['repoId'], r['targetCount'], [t['file'] for t in r['targets']]) for r in d['result']['repos']]"

echo "Recording sample findings + finalizing..."
call record_finding '{"auditId":"poc-multi","ruleId":"py-no-eval","stack":"python","severity":"high","repoId":"python-service","file":"app/main.py","line":18,"title":"eval on request payload","detail":"dynamic_handler uses eval(payload)"}' >/dev/null
call record_finding '{"auditId":"poc-multi","ruleId":"dart-http-timeout","stack":"dart","severity":"medium","repoId":"dart-app","file":"lib/main.dart","line":9,"title":"Missing HTTP timeout","detail":"HttpClient request has no timeout"}' >/dev/null
call record_finding '{"auditId":"poc-multi","ruleId":"java-no-string-sql","stack":"java","severity":"high","repoId":"java-service","file":"src/main/java/com/example/UserDao.java","line":17,"title":"SQL concatenation","detail":"builds SQL with string concatenation"}' >/dev/null

call finalize_audit_report '{"auditId":"poc-multi","rulesPath":"rules/sample-rules.json","repoIds":["python-service","dart-app","java-service"],"stacks":["python","dart","java"]}' \
  | python3 -c "import json,sys; d=json.load(sys.stdin); assert d.get('ok') and not d.get('isError'), d; print(json.dumps(d['result']['summary'], indent=2)); print('report', d['result']['reportMarkdown'])"

echo "Done."
