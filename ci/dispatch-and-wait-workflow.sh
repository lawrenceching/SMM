#!/usr/bin/env bash
# Dispatch a workflow_dispatch workflow in this repo and wait until it finishes.
#
# Usage (from repo root, with GH_TOKEN / GITHUB_TOKEN set):
#   bash ci/dispatch-and-wait-workflow.sh <workflow-file> <ref> <expected-sha> [gh workflow run args...]
#
# Extra args are forwarded to `gh workflow run` (e.g. -f platforms=win-x64).
#
# When running inside GitHub Actions (or with DISPATCH_PARENT_RUN_ID set), passes
# -f parent_run_id=<id> and prefers reusing an existing workflow_dispatch run for the
# same head SHA whose display title contains «parent:<id>» (see child workflow
# run-name). That way "Re-run failed jobs" on the parent does not start a duplicate
# child when the previously dispatched child already succeeded (or is still running).
#
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

PARENT_RUN_ID="${DISPATCH_PARENT_RUN_ID:-${GITHUB_RUN_ID:-}}"
MARKER=""
if [ -n "${PARENT_RUN_ID}" ]; then
  MARKER="«parent:${PARENT_RUN_ID}»"
fi
export EXPECTED_SHA
export MARKER

# jq: normalize GitHub timestamps → epoch (jq 1.6+).
epoch_def='def epoch: (sub("\\.[0-9]+Z$"; "Z") | strptime("%Y-%m-%dT%H:%M:%SZ") | mktime);'

pick_correlated_success="${epoch_def}"'
  [.[]
    | select(.headSha == env.EXPECTED_SHA)
    | select(.event == "workflow_dispatch")
    | select(.conclusion == "success")
    | select(.displayTitle != null and (.displayTitle | index(env.MARKER) != null))
  ]
  | sort_by(.createdAt)
  | reverse
  | if length == 0 then empty else "\(.[0].databaseId)\t\(.[0].url)" end
'

pick_correlated_active="${epoch_def}"'
  [.[]
    | select(.headSha == env.EXPECTED_SHA)
    | select(.event == "workflow_dispatch")
    | select(.status == "in_progress" or .status == "queued" or .status == "waiting"
        or .status == "requested" or .status == "pending")
    | select(.displayTitle != null and (.displayTitle | index(env.MARKER) != null))
  ]
  | sort_by(.createdAt)
  | reverse
  | if length == 0 then empty else "\(.[0].databaseId)\t\(.[0].url)" end
'

list_workflow_runs() {
  gh run list \
    --workflow="${WORKFLOW_FILE}" \
    --event=workflow_dispatch \
    --limit=50 \
    --json databaseId,headSha,createdAt,url,status,conclusion,displayTitle,event
}

watch_run() {
  local run_id="$1"
  local run_url="$2"
  local note="$3"
  echo "${note} ${run_id}: ${run_url}"
  if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
    {
      echo "## ${note%:*}: ${WORKFLOW_FILE}"
      echo ""
      echo "- **Run:** ${run_url}"
      echo "- **Ref:** \`${REF}\`"
      echo "- **Expected SHA:** \`${EXPECTED_SHA}\`"
      if [ -n "${PARENT_RUN_ID}" ]; then
        echo "- **Parent run id:** \`${PARENT_RUN_ID}\`"
      fi
    } >> "${GITHUB_STEP_SUMMARY}"
  fi
  gh run watch "${run_id}" --exit-status
  echo "Workflow ${WORKFLOW_FILE} run ${run_id} finished successfully."
}

if [ -n "${MARKER}" ]; then
  echo "Looking for existing ${WORKFLOW_FILE} run with ${MARKER} on sha ${EXPECTED_SHA}..."
  existing_json="$(list_workflow_runs)" || existing_json="[]"

  reused="$(printf '%s' "${existing_json}" | jq -r "${pick_correlated_success}" 2>/dev/null)" || true
  if [ -n "${reused}" ]; then
    RUN_ID="${reused%%$'\t'*}"
    RUN_URL="${reused#*$'\t'}"
    echo "Reusing successful run ${RUN_ID}: ${RUN_URL}"
    if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
      {
        echo "## Reused successful: ${WORKFLOW_FILE}"
        echo ""
        echo "- **Run:** ${RUN_URL}"
        echo "- **Ref:** \`${REF}\`"
        echo "- **Expected SHA:** \`${EXPECTED_SHA}\`"
        echo "- **Parent run id:** \`${PARENT_RUN_ID}\`"
      } >> "${GITHUB_STEP_SUMMARY}"
    fi
    exit 0
  fi

  active="$(printf '%s' "${existing_json}" | jq -r "${pick_correlated_active}" 2>/dev/null)" || true
  if [ -n "${active}" ]; then
    RUN_ID="${active%%$'\t'*}"
    RUN_URL="${active#*$'\t'}"
    watch_run "${RUN_ID}" "${RUN_URL}" "Watching in-progress correlated run"
    exit 0
  fi
fi

echo "Dispatching ${WORKFLOW_FILE} on ref ${REF} (prefer headSha ${EXPECTED_SHA})${*:+ (extra: $*)}"
if [ -n "${PARENT_RUN_ID}" ]; then
  echo "Correlating with parent run id ${PARENT_RUN_ID}"
fi

# Allow small clock skew when matching createdAt.
export BEFORE_EPOCH=$(($(date -u +%s) - 30))

dispatch_args=()
if [ -n "${PARENT_RUN_ID}" ]; then
  dispatch_args+=(-f "parent_run_id=${PARENT_RUN_ID}")
fi
gh workflow run "${WORKFLOW_FILE}" --ref "${REF}" "${dispatch_args[@]}" "$@"

pick_by_marker_and_sha="${epoch_def}"'
  [.[]
    | select((.createdAt | epoch) >= (env.BEFORE_EPOCH | tonumber))
    | select(.headSha == env.EXPECTED_SHA)
    | select(.displayTitle != null and (.displayTitle | index(env.MARKER) != null))
  ]
  | if length == 0 then empty else "\(.[0].databaseId)\t\(.[0].url)" end
'

pick_by_sha="${epoch_def}"'
  [.[]
    | select((.createdAt | epoch) >= (env.BEFORE_EPOCH | tonumber))
    | select(.headSha == env.EXPECTED_SHA)
  ]
  | if length == 0 then empty else "\(.[0].databaseId)\t\(.[0].url)" end
'

pick_newest="${epoch_def}"'
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
  matched=""
  if [ -n "${MARKER}" ]; then
    matched="$(
      gh run list \
        --workflow="${WORKFLOW_FILE}" \
        --event=workflow_dispatch \
        --limit=20 \
        --json databaseId,headSha,createdAt,url,status,displayTitle \
        --jq "${pick_by_marker_and_sha}"
    )" || true
  fi

  if [ -z "${matched}" ]; then
    matched="$(
      gh run list \
        --workflow="${WORKFLOW_FILE}" \
        --event=workflow_dispatch \
        --limit=20 \
        --json databaseId,headSha,createdAt,url,status,displayTitle \
        --jq "${pick_by_sha}"
    )" || true
  fi

  if [ -z "${matched}" ]; then
    matched="$(
      gh run list \
        --workflow="${WORKFLOW_FILE}" \
        --event=workflow_dispatch \
        --limit=20 \
        --json databaseId,headSha,createdAt,url,status,displayTitle \
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

watch_run "${RUN_ID}" "${RUN_URL}" "Found run"
