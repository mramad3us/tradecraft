#!/usr/bin/env bash
# TRADECRAFT: keep the Mac awake while Claude works, and only then.
#
#   tools/awake.sh renew          renew the lease; start the keeper if none runs (the hooks call this)
#   tools/awake.sh run <cmd...>   run a long job, the lease kept fresh for as long as it runs
#   tools/awake.sh status         what holds the Mac awake, and for how long
#   tools/awake.sh off            stop now, and stay off until `on`
#   tools/awake.sh on             allow it again (and renew)
#
# A lease, not a timer. The hooks in .claude/settings.json renew it on every
# prompt and every tool call; one keeper process holds the Mac awake while the
# lease is younger than LEASE_MIN, then exits and lets it sleep. So the Mac
# stays up through a night of work and sleeps an hour after the work stops,
# with nothing for anyone to remember. (In longhaul an hour-long caffeinate was
# renewed by hand, and the chain lapsed.) A job that runs for over an hour with
# no tool calls (a long simulation in the background) goes through `run`.
#
# On battery, caffeinate alone was not enough: longhaul's Mac went to 'Idle
# Sleep' while `caffeinate -dims` held its assertions, once macOS had declared
# the user idle (pmset log, 2026-10-25 09:33). So on battery the keeper also
# declares user activity every PULSE_S (`caffeinate -u`; it doesn't reset the
# HID idle time, so a real return still shows). The screen stays on as it is:
# the user wants it lit (2026-10-26). Only with AWAKE_DIM=1, and with nobody at
# the keyboard for as long as the system's own display sleep, it turns the
# backlight off (tools/bright.swift, built on first use) and puts it back the
# moment someone touches a key or the trackpad; not while something else wants
# the display on (a video playing holds its own assertion), and not when it's
# dark already (there'd be nothing to put back: once it "restored" 0).
#
# A closed lid on battery sleeps whatever this does.
set -u
DIR="$(cd "$(dirname "$0")/.." && pwd)"
ST="$DIR/.run/awake"
LEASE="$ST/lease"; PIDF="$ST/keeper.pid"; OFF="$ST/off"; LOG="$ST/log"; BRIGHT="$ST/bright"
LEASE_MIN=${AWAKE_LEASE_MIN:-60}
PULSE_S=${AWAKE_PULSE_S:-40}
DIM=${AWAKE_DIM:-0}
level=""; dimmed=0        # the keeper's backlight, global so the exit trap still sees it

keeper_pid() { [ -f "$PIDF" ] || return 1; local p; p=$(cat "$PIDF"); ps -p "$p" -o command= 2>/dev/null | grep -q 'awake.sh _keeper' && echo "$p"; }
lease_age() { echo $(( $(date +%s) - $(stat -f %m "$LEASE" 2>/dev/null || echo 0) )); }
on_battery() { [ -n "${AWAKE_FORCE_BATTERY:-}" ] || pmset -g batt | grep -q "'Battery Power'"; }
hid_idle() { ioreg -c IOHIDSystem | awk '/HIDIdleTime/ {print int($NF/1000000000); exit}'; }
others_want_display() { pmset -g assertions | grep 'PreventUserIdleDisplaySleep named' | grep -vq '(caffeinate)'; }   # a video playing, say
dim_after() { [ -n "${AWAKE_DIM_AFTER_S:-}" ] && { echo "$AWAKE_DIM_AFTER_S"; return; }; local m; m=$(pmset -g | awk '/ displaysleep/ {print $2; exit}'); [ "${m:-0}" -gt 0 ] 2>/dev/null || m=10; echo $((m * 60)); }
log() { echo "$(date '+%F %T') $*" >> "$LOG"; }

renew() {
  [ -e "$OFF" ] && return 0
  mkdir -p "$ST"
  touch "$LEASE"
  keeper_pid >/dev/null && return 0
  ( nohup "$0" _keeper >>"$LOG" 2>&1 </dev/null & )
  return 0
}

keeper() {
  mkdir -p "$ST"
  # One keeper: the pid file is made with noclobber; a stale one is taken over.
  if ! ( set -o noclobber; echo $$ > "$PIDF" ) 2>/dev/null; then
    keeper_pid >/dev/null && exit 0
    echo $$ > "$PIDF"
  fi
  caffeinate -dims -w $$ &                       # held exactly as long as this keeper lives
  local idle
  trap 'exit 0' INT TERM
  trap 'restore; rm -f "$PIDF"; log "keeper $$ stops"' EXIT
  echo "$LEASE_MIN" > "$ST/lease_min"
  log "keeper $$ starts (lease $LEASE_MIN min)"
  if [ "$DIM" = 1 ] && [ ! -x "$BRIGHT" ] && command -v swiftc >/dev/null; then
    swiftc -O "$DIR/tools/bright.swift" -o "$BRIGHT" 2>>"$LOG" || log "no backlight control (bright.swift did not build)"
  fi
  while [ ! -e "$OFF" ] && [ "$(lease_age)" -lt $((LEASE_MIN * 60)) ]; do
    on_battery && caffeinate -u -t 5
    idle=$(hid_idle)
    if [ "$DIM" = 1 ] && [ $dimmed = 0 ] && [ "${idle:-0}" -ge "$(dim_after)" ] && [ -x "$BRIGHT" ] && ! others_want_display; then
      level=$("$BRIGHT")
      if awk -v l="${level:-0}" 'BEGIN { exit !(l > 0.02) }'; then "$BRIGHT" 0 >/dev/null; dimmed=1; log "nobody about for ${idle}s: backlight off (was $level)"; fi
    elif [ $dimmed = 1 ] && [ "${idle:-0}" -lt 30 ]; then
      restore; dimmed=0
    fi
    sleep $PULSE_S & wait $!                     # (in the background, so `off` is heard at once)
  done
  exit 0
}

restore() {
  if [ $dimmed = 1 ] && [ -n "$level" ]; then "$BRIGHT" "$level" >/dev/null; log "backlight back to $level"; fi
}

status() {
  local p; p=$(keeper_pid)
  if [ -e "$OFF" ]; then echo "off (tools/awake.sh on to allow again)"
  elif [ -n "$p" ]; then
    local left=$(( $(cat "$ST/lease_min" 2>/dev/null || echo "$LEASE_MIN") * 60 - $(lease_age) ))
    echo "keeper $p holds the Mac awake; the lease runs out in $((left / 60)) min unless renewed"
  else echo "no keeper running (the next prompt or tool call starts one)"; fi
  if on_battery; then echo "power: battery (activity pulses on)"; else echo "power: AC"; fi
  [ -n "$p" ] && pmset -g assertions | grep -E "pid $(pgrep -P "$p" caffeinate | head -1)\(caffeinate\)" | awk '{print "  " $5}' | sort -u | tr '\n' ' ' && echo
  local others; others=$(pgrep -x caffeinate | grep -vc "^$(pgrep -P "${p:-0}" caffeinate | head -1)$")
  [ "$others" -gt 0 ] && echo "($others other caffeinate process(es) not ours: pgrep -fl caffeinate)"
  return 0
}

main() {
  case "${1:-}" in
    renew) renew ;;
    _keeper) keeper ;;
    run) shift; [ $# -gt 0 ] || { echo "usage: tools/awake.sh run <cmd...>"; exit 1; }
         renew; "$@" & local job=$!
         while kill -0 $job 2>/dev/null; do sleep 30; renew; done
         wait $job ;;
    status) status ;;
    off) mkdir -p "$ST"; touch "$OFF"; local p; p=$(keeper_pid) && kill "$p"; echo "keep-awake off" ;;
    on) rm -f "$OFF"; renew; echo "keep-awake on" ;;
    *) sed -n '4,8p' "$0" | sed 's/^# *//'; exit 1 ;;
  esac
}

# All on one line, read whole before it runs: bash reads a script as it goes, so a keeper running
# for hours would otherwise trip over an edit to this file (a release, a pull) when it finishes.
main "$@"; exit $?
