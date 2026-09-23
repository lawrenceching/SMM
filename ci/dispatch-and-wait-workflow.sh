#!/usr/bin/env bash
# Dispatch a workflow_dispatch workflow in this repo and wait until it finishes.
#
# Usage (from repo root, with GH_TOKEN / GITHUB_TOKEN set):
#   bash ci/dispatch-and-wait-workflow.sh <workflow-file> <ref> <expected-sha> [gh workflow run args...]
#
# Extra args are forwarded to `gh workflow run` (e.g. -f platforms=win-x64).
# Writes the child run URL to GITHUB_STEP_SUMMARY when available.
set -euo pipefail

WORKFLOW_FILE="${1:?workflow file required (e.g. e2e-cli.yml)}"
REF="${2:?git ref required (branch or tag name)}"
EXPECTED_SHA="${3:?expected head sha required}"
shift 3

if [ -z "${GH_TOKEN:-${GITHUB_TOKEN:-}}" ]; then
  echo "::error::GH_TOKEN or GITHUB_TOKEN is required"
  exit 1
fi
export GH_TOKEN="${GH_TOKEN:-$GITHUB_TOKEN}"

echo "Dispatching ${WORKFLOW_FILE} on ref ${REF} (prefer headSha ${EXPECTED_SHA})${*:+ (extra: $*)}"

# Allow small clock skew when matching createdAt.
export BEFORE_EPOCH=$(($(date -u +%s) - 30))
export EXPECTED_SHA

gh workflow run "${WORKFLOW_FILE}" --ref "${REF}" "$@"

# jq: normalize GitHub timestamps → epoch (jq 1.6+).
pick_by_sha='
  def epoch: (sub("\\.[0-9]+Z$"; "Z") | strptime("%Y-%m-%dT%H:%M:%SZ") | mktime);
  [.[]
    | select((.createdAt | epoch) >= (env.BEFORE_EPOCH | tonumber))
    | select(.headSha == env.EXPECTED_SHA)
  ]
  | if length == 0 then empty else "\(.[0].databaseId)\t\(.[0].url)" end
'

pick_newest='
  def epoch: (sub("\\.[0-9]+Z$"; "Z") | strptime("%Y-%m-%dT%H:%M:%SZ") | mktime);
  [.[]
    | select((.createdAt | epoch) >= (env.BEFORE_EPOCH | tonumber))
  ]
  | sort_by(.createdAt)
  | reverse
  | if length == 0 then empty else "\(.[0].databaseId)\t\(.[0].url)" end
'

RUN_ID=""
RUN_URL=""
for _ in $(seq 1 90); do
  matched="$(
    gh run list \
      --workflow="${WORKFLOW_FILE}" \
      --event=workflow_dispatch \
      --limit=20 \
      --json databaseId,headSha,createdAt,url,status \
      --jq "${pick_by_sha}"
  )" || true

  if [ -z "${matched}" ]; then
    matched="$(
      gh run list \
        --workflow="${WORKFLOW_FILE}" \
        --event=workflow_dispatch \
        --limit=20 \
        --json databaseId,headSha,createdAt,url,status \
        --jq "${pick_newest}"
    )" || true
  fi

  if [ -n "${matched}" ]; then
    RUN_ID="${matched%%$'\t'*}"
    RUN_URL="${matched#*$'\t'}"
    break
  fi
  sleep 2
done

if [ -z "${RUN_ID}" ]; then
  echo "::error::Timed out waiting for ${WORKFLOW_FILE} run to appear after dispatch"
  exit 1
fi

echo "Found run ${RUN_ID}: ${RUN_URL}"
if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
  {
    echo "## Dispatched: ${WORKFLOW_FILE}"
    echo ""
    echo "- **Run:** ${RUN_URL}"
    echo "- **Ref:** \`${REF}\`"
    echo "- **Expected SHA:** \`${EXPECTED_SHA}\`"
  } >> "${GITHUB_STEP_SUMMARY}"
fi

gh run watch "${RUN_ID}" --exit-status
echo "Workflow ${WORKFLOW_FILE} run ${RUN_ID} finished successfully."
