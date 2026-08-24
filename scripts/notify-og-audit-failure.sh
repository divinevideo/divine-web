#!/usr/bin/env bash
# ABOUTME: Posts an OG/Twitter Card parity audit failure to #divine-alerts
# ABOUTME: Alert-only by design — a live-edge monitor must not fail the build.
#
# The audit probes a live CDN edge, so it cannot tell "we shipped bad OG tags"
# apart from "a connection got dropped" on its own. It runs after production is
# already live, so failing the build rolls nothing back — it just paints main
# red and teaches people to ignore it. This routes the result to the channel
# that already carries deploy failures and the uptime heartbeat, and says which
# of the two classes it is so the reader knows whether to act.
#
# Usage (from .github/workflows/og-audit.yml):
#   AUDIT_LOG=/tmp/og-audit-production.log \
#   AUDIT_TARGET='production (divine.video)' \
#   RUN_URL=... SLACK_WEBHOOK=... bash scripts/notify-og-audit-failure.sh
#
# Environment variables:
#   AUDIT_LOG     - Path to the captured audit output (required)
#   AUDIT_TARGET  - Human-readable name of what was audited (required)
#   RUN_URL       - Link to the Actions run (optional)
#   SLACK_WEBHOOK - Incoming Webhook URL; unset means no-op (optional)
#
# Always exits 0: a notifier must never mask, or become, the thing it reports.

set -uo pipefail

AUDIT_LOG="${AUDIT_LOG:-}"
AUDIT_TARGET="${AUDIT_TARGET:-an unnamed target}"
RUN_URL="${RUN_URL:-}"
SLACK_WEBHOOK="${SLACK_WEBHOOK:-}"

# How many failing checks to name before summarising the rest. A total outage
# would otherwise post 64 lines into the channel.
MAX_LISTED=10

if [[ -z "$SLACK_WEBHOOK" ]]; then
  echo "SLACK_DIVINE_ALERTS_WEBHOOK not set; skipping OG audit alert."
  exit 0
fi

post() {
  # $1 = message text. Built via jq --arg so no audit output can break the JSON.
  local payload
  payload="$(jq -n --arg t "$1" '{text: $t}')"

  if curl -sS -X POST -H 'Content-type: application/json' \
       --max-time 15 --data "$payload" "$SLACK_WEBHOOK" >/dev/null; then
    echo "Posted OG audit alert to #divine-alerts."
  else
    echo "WARNING: failed to POST to Slack webhook (the audit failure still stands)."
  fi
}

run_line=""
if [[ -n "$RUN_URL" ]]; then
  run_line="$(printf '\n<%s|View the audit run>' "$RUN_URL")"
fi

# The audit never got to run (e.g. we could not resolve which deployment to
# audit). Say so out loud: a monitor that quietly stops monitoring is worse
# than one that fails, which is the trap this whole workflow is avoiding.
if [[ -n "${AUDIT_UNAVAILABLE_REASON:-}" ]]; then
  post "$(printf '🟠 *OG parity audit could not run* — %s\n%s%s' \
    "$AUDIT_TARGET" "$AUDIT_UNAVAILABLE_REASON" "$run_line")"
  exit 0
fi

if [[ ! -r "$AUDIT_LOG" ]]; then
  echo "WARNING: audit log '${AUDIT_LOG}' is missing or unreadable; nothing to report."
  exit 0
fi

# The audit exits 2 without running any checks when the target is unreachable,
# so there is no failure list to report — just curl's reason.
if grep -q '^ERROR: cannot reach' "$AUDIT_LOG"; then
  reason="$(grep -A5 '^ERROR: cannot reach' "$AUDIT_LOG" | sed -n '2,3p' | sed 's/^[[:space:]]*//' | head -1)"
  post "$(printf '🔴 *OG parity audit failed* — %s\nThe target could not be reached, so no checks ran.%s%s' \
    "$AUDIT_TARGET" "${reason:+$(printf '\n%s' "$reason")}" "$run_line")"
  exit 0
fi

# Read into counters rather than an array: macOS still ships bash 3.2, which has
# no mapfile and treats an empty array under `set -u` as an unbound variable.
failure_count=0
network_failures=0
truncated=0
listed=""

while IFS= read -r failure; do
  [[ -z "$failure" ]] && continue
  failure_count=$((failure_count + 1))

  # A dropped connection is not an OG regression. Only call it one when at least
  # one failure is about the tags the edge actually served.
  case "$failure" in
    *"network error"*) network_failures=$((network_failures + 1)) ;;
  esac

  if [[ ${failure_count} -le ${MAX_LISTED} ]]; then
    listed+="$(printf '\n• %s' "$failure")"
  else
    truncated=$((truncated + 1))
  fi
done < <(sed -n '/^Failures:/,/^$/p' "$AUDIT_LOG" | sed -n 's/^  X //p')

if [[ ${failure_count} -eq 0 ]]; then
  echo "WARNING: no failure list found in '${AUDIT_LOG}'; not alerting on an unparseable log."
  exit 0
fi

if [[ ${truncated} -gt 0 ]]; then
  listed+="$(printf '\n• …and %s more (see the run log)' "$truncated")"
fi

headline="$(grep -m1 '^FAILED: ' "$AUDIT_LOG" | sed 's/^FAILED: //')"
headline="${headline:-${failure_count} checks did not pass}"

if [[ ${network_failures} -eq ${failure_count} ]]; then
  severity='🟡'
  verdict="$(printf 'Every failure was network-level — the edge dropped the connection rather than serving the wrong tags. Most likely a transient blip; worth a look if it repeats.')"
else
  severity='🔴'
  verdict="$(printf 'Link previews may be broken on the routes below.')"
fi

post "$(printf '%s *OG parity audit failed* — %s\n%s\n%s%s%s' \
  "$severity" "$AUDIT_TARGET" "$headline" "$verdict" "$listed" "$run_line")"
