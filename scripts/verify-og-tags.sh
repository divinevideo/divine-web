#!/usr/bin/env bash
# ABOUTME: Live verification of OG/Twitter Card parity across divine.video URLs
# ABOUTME: Curls each representative URL with multiple User-Agents and asserts
# ABOUTME: expected tags. Exits non-zero on any failure so it can run in CI.
#
# Usage:
#   scripts/verify-og-tags.sh
#   BASE_URL=https://staging.divine.video scripts/verify-og-tags.sh
#   UA_ONLY=slackbot scripts/verify-og-tags.sh
#
# Environment variables:
#   BASE_URL  - Base URL to test (default: https://divine.video)
#   UA_ONLY   - Restrict to a single User-Agent label (default: all)
#   QUIET     - Suppress per-route success output (default: unset)

set -uo pipefail

BASE_URL="${BASE_URL:-https://divine.video}"
UA_ONLY="${UA_ONLY:-}"

REAL_VIDEO_ID="3ca833a0027dd6240b2956dec98643032ff43ee75c0f0cde9d2096186b4b2605"
REAL_NPUB="npub1smznz0v5cfh3f9e5vp5j9h6tzn4dlp3eqnxx6p2wujr40ftnz5qqhzf22n"
SYNTHETIC_NPUB="npub1sg6plzptd64u62a878hep2kev88swjh3tw00gjsfl8f237lmu63s0c24qfh"

USER_AGENTS=(
  "slackbot|Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)"
  "facebook|facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)"
  "twitter|Twitterbot/1.0"
  "linkedin|LinkedInBot/1.0 (compatible; Mozilla/5.0)"
  "discord|Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)"
  "chrome|Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"
)

ROUTES=(
  "/video/${REAL_VIDEO_ID}|real video page|twitter_card_player_present && og_video_present && twitter_player_present"
  "/embed/${REAL_VIDEO_ID}|embed iframe page|frame_ancestors_header && video_tag_present && noindex_header"
  "/profile/${REAL_NPUB}|real npub (Thomas Sanders)|og_title_not_brand && og_url_matches_path"
  # Synthetic npub is structurally invalid (fails bech32 padding check at
  # compute-js/src/bech32.js:87-90). The worker correctly falls through to the
  # SPA shell with brand-default OG. Serving rich OG would mislead crawlers
  # about a nonexistent profile. See issue #450.
  "/profile/${SYNTHETIC_NPUB}|synthetic npub (does not exist)|og_title_is_brand"
  "/category/dance|category with video count|og_title_not_brand && og_url_matches_path"
  "/category|category index|og_title_not_brand && og_url_matches_path"
  "/family|family resource hub|og_title_not_brand && og_url_matches_path"
  "/age-review|age review page|og_title_not_brand && og_url_matches_path"
  "/kids|kids policy page|og_title_not_brand && og_url_matches_path"
  "/t/funny|hashtag page|og_title_not_brand && og_url_matches_path"
  "/search?q=cats|search results|og_title_not_brand && og_url_matches_path"
  "/discovery|discovery (trending)|og_title_not_brand && og_url_matches_path"
  "/discovery/hot|discovery (trending)|og_title_not_brand && og_url_matches_path"
  "/discovery/classics|discovery (classics)|og_title_not_brand && og_url_matches_path"
  "/@jalcine|at-username apex|og_title_not_brand"
  "/|apex home|og_title_not_brand"
)

# Crawler UAs known to trigger Fastly's isSocialMediaCrawler() switch.
# These are the UAs for which per-route OG handlers SHOULD fire.
# Browsers (chrome) and bots not on the Fastly list (linkedin) are expected
# to fall through to the SPA shell and are NOT asserted on.
CRAWLER_UA_LABELS=(
  "slackbot"
  "facebook"
  "twitter"
  "discord"
)

total_checks=0
passed_checks=0
failed_checks=0
declare -a failures=()

print_header() {
  echo "=========================================================================="
  echo "OG/Twitter Card Live Parity Audit"
  echo "Target: ${BASE_URL}"
  echo "Date:   $(date -u +'%Y-%m-%dT%H:%M:%SZ')"
  echo "=========================================================================="
  echo
}

extract_meta() {
  local body="$1"
  local key="$2"
  local attr="${3:-property}"
  LC_ALL=C printf '%s' "$body" | grep -aoE "<meta ${attr}=\"${key}\" content=\"[^\"]*\"" | head -1 | sed -E "s/<meta ${attr}=\"${key}\" content=\"([^\"]*)\"/\1/"
}

extract_final_response_headers() {
  local header_file="$1"
  local response_headers=""
  local header_line

  while IFS= read -r header_line || [[ -n "$header_line" ]]; do
    header_line="${header_line%$'\r'}"
    if [[ "$header_line" == HTTP/* ]]; then
      response_headers="$header_line"
    elif [[ -n "$response_headers" ]]; then
      response_headers+=$'\n'"$header_line"
    fi
  done < "$header_file"

  printf '%s' "$response_headers"
}

run_check() {
  local path="$1"
  local description="$2"
  local assertions="$3"
  local ua_label="$4"
  local ua_value="$5"

  local url="${BASE_URL}${path}"
  local tmp_headers
  local tmp_body
  local tmp_error
  tmp_headers=$(mktemp)
  tmp_body=$(mktemp)
  tmp_error=$(mktemp)
  local cleanup_needed=true
  trap '[[ "${cleanup_needed:-false}" == "true" ]] && rm -f "$tmp_headers" "$tmp_body" "$tmp_error"' RETURN
  cleanup_needed=true

  # This audit makes ~64 live requests to a CDN edge per run, so a single dropped
  # connection used to fail the whole deploy gate. Retry transport errors before
  # calling it a parity failure. --retry-max-time keeps a genuinely unreachable
  # origin from stacking 30s timeouts on every route.
  local curl_result
  local curl_exit=0
  curl_result=$(curl -sS -L --max-time 30 --compressed \
    --retry 2 --retry-delay 1 --retry-connrefused --retry-all-errors --retry-max-time 30 \
    -A "$ua_value" \
    -D "$tmp_headers" \
    -o "$tmp_body" \
    -w '%{http_code}|%{num_redirects}' \
    "$url" 2>"$tmp_error") || curl_exit=$?

  if [[ ${curl_exit} -ne 0 ]]; then
    # curl's own diagnostics, not an HTTP status: report them as such so the log
    # distinguishes "the edge served the wrong tags" from "the request never landed".
    local curl_error
    curl_error=$(tr -d '\r' < "$tmp_error" | grep -v '^[[:space:]]*$' | tail -1)
    echo "  X ${ua_label} -> ${path} (network error after retries: curl exit ${curl_exit}${curl_error:+ - ${curl_error}})"
    failed_checks=$((failed_checks + 1))
    failures+=("${ua_label} ${path}: network error (curl exit ${curl_exit})")
    return 1
  fi

  local http_code="${curl_result%%|*}"
  local redirect_count="${curl_result##*|}"
  local response_count
  response_count=$(grep -c '^HTTP/' "$tmp_headers")

  if [[ -s "$tmp_error" ]]; then
    local recovered_from
    recovered_from=$(tr -d '\r' < "$tmp_error" | grep -v '^[[:space:]]*$' | head -1)
    echo "  ~ ${ua_label} -> ${path} (recovered after a transient network error${recovered_from:+ - ${recovered_from}})"
  elif [[ ${response_count} -gt $((redirect_count + 1)) ]]; then
    echo "  ~ ${ua_label} -> ${path} (recovered after a transient HTTP error)"
  fi

  local body
  body=$(cat "$tmp_body")
  local headers
  headers=$(extract_final_response_headers "$tmp_headers")

  if [[ "$http_code" != "200" ]]; then
    echo "  X ${ua_label} -> ${path} (HTTP ${http_code})"
    failed_checks=$((failed_checks + 1))
    failures+=("${ua_label} ${path}: HTTP ${http_code}")
    return 1
  fi

  local all_passed=true
  local assertion
  while IFS= read -r assertion; do
    [[ -z "$assertion" ]] && continue

    case "$assertion" in
      twitter_card_player_present)
        if grep -q '<meta name="twitter:card" content="player"' "$tmp_body"; then
          :
        else
          all_passed=false
          echo "    FAIL: expected twitter:card=player, got:"
          grep -o '<meta name="twitter:card"[^>]*>' "$tmp_body" | head -3 | sed 's/^/      /'
        fi
        ;;
      og_video_present)
        if grep -q '<meta property="og:video"' "$tmp_body"; then
          :
        else
          all_passed=false
          echo "    FAIL: expected og:video tag"
        fi
        ;;
      twitter_player_present)
        if grep -q '<meta name="twitter:player"' "$tmp_body"; then
          :
        else
          all_passed=false
          echo "    FAIL: expected twitter:player tag"
        fi
        ;;
      frame_ancestors_header)
        if grep -qi '^content-security-policy:.*frame-ancestors' <<< "$headers"; then
          :
        else
          all_passed=false
          echo "    FAIL: missing Content-Security-Policy: frame-ancestors header"
        fi
        ;;
      noindex_header)
        if grep -qi '^x-robots-tag:.*noindex' <<< "$headers"; then
          :
        else
          all_passed=false
          echo "    FAIL: missing X-Robots-Tag: noindex header"
        fi
        ;;
      video_tag_present)
        if grep -q '<video ' "$tmp_body"; then
          :
        else
          all_passed=false
          echo "    FAIL: expected <video> element in embed page"
        fi
        ;;
      og_title_not_brand)
        local og_title
        og_title=$(extract_meta "$body" "og:title")
        if [[ "$og_title" == "Divine Web - Short-form Looping Videos on Nostr" ]]; then
          all_passed=false
          echo "    FAIL: og:title is generic brand fallback (no per-route handler fired)"
          echo "          got: ${og_title}"
        fi
        ;;
      og_title_is_brand)
        # Inverse of og_title_not_brand. Passes when the response falls through to
        # the SPA shell with the brand-default title. Use this for negative tests
        # where the worker correctly does NOT produce per-route OG (e.g. structurally
        # invalid npubs, where decodeNpubToHex returns null).
        local og_title
        og_title=$(extract_meta "$body" "og:title")
        if [[ "$og_title" != "Divine Web - Short-form Looping Videos on Nostr" ]]; then
          all_passed=false
          echo "    FAIL: og:title is NOT the brand-default SPA shell fallback"
          echo "          got: ${og_title}"
          echo "          want: Divine Web - Short-form Looping Videos on Nostr"
        fi
        ;;
      og_url_matches_path)
        local og_url
        local alternate_og_url=""
        og_url=$(extract_meta "$body" "og:url")
        case "$path" in
          /discovery/hot|/discovery/classics)
            # TODO(#667): Remove after Fastly emits metadata for the current discovery slugs.
            alternate_og_url="https://divine.video/discovery"
            ;;
          /family)
            # The prerendered marketing page intentionally canonicalizes previews to production.
            alternate_og_url="https://divine.video/family"
            ;;
        esac
        if [[ -z "$og_url" ]]; then
          all_passed=false
          echo "    FAIL: missing og:url tag"
        elif [[ "$og_url" == *"inherently-ethical-gelding.edgecompute.app"* ]]; then
          all_passed=false
          echo "    FAIL: og:url leaks Fastly origin host (should be ${BASE_URL})"
          echo "          got: ${og_url}"
        elif [[ "$og_url" != "${BASE_URL}${path}" \
          && "$og_url" != "${BASE_URL}${path}/" \
          && "$og_url" != "${BASE_URL}/" \
          && "$og_url" != "$alternate_og_url" \
          && "$og_url" != "${alternate_og_url}/" ]]; then
          all_passed=false
          echo "    FAIL: og:url does not match expected path"
          echo "          expected: ${BASE_URL}${path}"
          echo "          got:      ${og_url}"
        fi
        ;;
      *)
        echo "    WARN: unknown assertion '${assertion}', skipping"
        ;;
    esac
  done <<< "${assertions// && /$'\n'}"

  if $all_passed; then
    if [[ "${QUIET:-}" != "1" ]]; then
      echo "  OK ${ua_label} -> ${path}"
    fi
    passed_checks=$((passed_checks + 1))
    cleanup_needed=false
    rm -f "$tmp_headers" "$tmp_body" "$tmp_error"
    return 0
  else
    failed_checks=$((failed_checks + 1))
    failures+=("${ua_label} ${path} (${description})")
    cleanup_needed=false
    rm -f "$tmp_headers" "$tmp_body" "$tmp_error"
    return 1
  fi
}

get_user_agent() {
  local wanted_label="$1"
  local user_agent_entry

  for user_agent_entry in "${USER_AGENTS[@]}"; do
    local label="${user_agent_entry%%|*}"
    local value="${user_agent_entry#*|}"

    if [[ "$label" == "$wanted_label" ]]; then
      printf '%s' "$value"
      return 0
    fi
  done

  return 1
}

print_summary() {
  echo
  echo "=========================================================================="
  echo "Summary"
  echo "=========================================================================="
  echo "Total checks:  ${total_checks}"
  echo "Passed:        ${passed_checks}"
  echo "Failed:        ${failed_checks}"
  echo

  if [[ ${failed_checks} -gt 0 ]]; then
    echo "Failures:"
    for failure in "${failures[@]}"; do
      echo "  X ${failure}"
    done
    echo
    echo "FAILED: ${failed_checks} of ${total_checks} checks did not pass"
    return 1
  fi

  echo "All checks passed."
  return 0
}

main() {
  print_header

  local preflight_error
  preflight_error=$(mktemp)
  if ! curl -sSI --max-time 10 \
    --retry 2 --retry-delay 1 --retry-connrefused --retry-all-errors --retry-max-time 30 \
    "${BASE_URL}/" >/dev/null 2>"$preflight_error"; then
    # Print curl's reason. Without it an unsupported flag or a TLS failure both
    # read as "the site is down", which sends people looking in the wrong place.
    echo "ERROR: cannot reach ${BASE_URL}"
    tr -d '\r' < "$preflight_error" | grep -v '^[[:space:]]*$' | sed 's/^/       /'
    rm -f "$preflight_error"
    exit 2
  fi
  rm -f "$preflight_error"

  for route_entry in "${ROUTES[@]}"; do
    local path="${route_entry%%|*}"
    local rest="${route_entry#*|}"
    local description="${rest%%|*}"
    local assertions="${rest#*|}"

    echo
    echo "-- ${description} --"
    echo "   path: ${path}"

    local ua_label
    for ua_label in "${CRAWLER_UA_LABELS[@]}"; do
      if [[ -n "$UA_ONLY" && "$UA_ONLY" != "$ua_label" ]]; then
        continue
      fi

      local ua_value
      if ! ua_value=$(get_user_agent "$ua_label"); then
        echo "ERROR: unknown User-Agent label '${ua_label}'"
        exit 2
      fi

      total_checks=$((total_checks + 1))
      run_check "$path" "$description" "$assertions" "$ua_label" "$ua_value"
    done
  done

  print_summary
}

main "$@"
