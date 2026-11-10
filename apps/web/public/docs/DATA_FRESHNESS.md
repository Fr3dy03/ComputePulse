# Data freshness

ComputePulse separates **when a value was observed** from **when it was collected** and **whether it is still fresh**. A recent HTTP 200 does not make an old source field new.

## 1. Freshness states

| State | Rule | UI treatment |
| --- | --- | --- |
| `fresh` | age ≤ `max(2 × expected_interval, expected_interval + 60)` and ≤ stale threshold | normal value |
| `delayed` | age > the fresh bound but ≤ stale threshold | "delayed" note |
| `stale` | age > `staleAfterSeconds` | `STALE` badge; value is not current |
| `unavailable` | no successful collection or no value | `UNAVAILABLE` / `NO DATA` |
| `pending` | monitor exists, no check completed | `PENDING` |

The implementation is `describeFreshness()` in `apps/api/src/lib/time.ts`.

```text
age = max(0, now - last_success_at)

if age is null                           -> unavailable
if age > stale_after_seconds             -> stale
if age > max(2 * expected_interval,
             expected_interval + 60)     -> delayed
otherwise                                -> fresh
```

`age` and thresholds are in seconds. `now` is the server clock at request time. All timestamps are stored and displayed in UTC.

## 2. Source policies

| Source | Expected interval | Stale after | Rationale |
| --- | --- | --- | --- |
| Akash Console provider list | 300 s | 900 s | A 5-minute list cadence tolerates one missed run; 15 minutes without a success is stale |
| Flux node list + head | 600 s | 1,800 s | The list is large and changes slowly; 30 minutes without success is stale |
| BOT mainnet RPC | 60 s | 300 s | Chain head should advance continuously |
| Bohr testnet RPC | 60 s | 300 s | Same, on testnet |
| Endpoint monitors | configured interval (default 300 s) | derived from the monitor | A monitor's stale state is based on its last check and interval |

These are defaults in the seed and can be changed through settings or the seed source. They are not universal truth claims.

## 3. Source state vs freshness

Two related signals are stored:

- `data_source_status.state`: operational state of the collector (`active`, `degraded`, `failing`, `stale`).
- Freshness descriptor: computed from the last success timestamp for display.

The source can be `active` after one failure while still fresh. After repeated failures it becomes `degraded` or `failing`. After the stale threshold it becomes `stale`.

The UI shows both:

- the source run state and consecutive failures
- the freshness badge and age

A `degraded` source can still have fresh data if the last success was recent. A `stale` source always means the current values must not be presented as current.

## 4. Observation time vs collection time

Every provider row preserves:

- `status_observed_at`: when the source says the status was observed or last checked
- `last_seen_at`: when ComputePulse last saw the record
- `source_url`: where it came from
- `sourceObservedAt` in the normalized adapter result

For Akash, `sourceObservedAt` uses `lastCheckDate` when present. This can be older than the collection time. The app therefore shows both the record's source observation time and the source's collection freshness. A fresh collection of a source field that is already 20 minutes old is still a 20-minute-old observation.

For Flux, the node-list request time is the observation time for registration data. Confirmation lag depends on the head height at collection time.

For BOT/Bohr, the latest block timestamp is the observation time for block age; the RPC latency is observed at request time.

## 5. Stale detection

Staleness is evaluated:

1. On every scheduler tick (`refreshStaleness()`), updating `data_source_status.state`.
2. At API read time through `describeFreshness()`, so a stale source is shown even if the scheduler is not running.

If a collection fails:

- the `collection_runs` row is marked `failed`
- `data_source_status.consecutive_failures` increments
- `last_error` is stored
- the previous successful observations remain
- no zero or placeholder observation is written

The UI must not turn "no current data" into "healthy" or "zero providers". Missing data is displayed as missing.

## 6. Missing observations and charts

- A missing time bucket is a gap, not a zero.
- A provider with no capacity value shows `UNAVAILABLE`, not `0 cores`.
- Flux provider health is `UNAVAILABLE` even when the node list is fresh.
- A monitor with no checks shows `PENDING` and `null` availability.
- Charts show the last observed time and coverage; the provenance drawer names the source and method.
- The API returns `null` for missing values and does not synthesize history.

## 7. Endpoint monitor freshness

A monitor check is a single observed HTTP request at `checked_at`.

- `last_status = pending` before the first check.
- A check is successful only when the status code matches `expected_status` and, if configured, the body contains the expected marker.
- `availability_24h = successful_24h / checks_24h`, or `null` when `checks_24h = 0`.
- A monitor with an interval of 300 s and a last check 20 minutes ago is delayed/stale relative to its configured cadence.
- Recovery after failures adds a note to the open incident. It does not auto-close the incident.

## 8. Retention

Default retention:

| Data | Retention |
| --- | --- |
| Observations | 30 days |
| Monitor checks | 14 days |
| Alert deliveries | 90 days |

Retention is applied at most once per hour by the scheduler. The values are stored in `settings` and can be changed:

- `retention.observations_days`
- `retention.monitor_checks_days`

Retention deletes old rows. It does not rewrite or impute history. Reports and charts covering a deleted period will show gaps.

Production with TimescaleDB should use native retention/compression policies instead of the application delete loop. See `ARCHITECTURE.md`.

## 9. Clock and timezone assumptions

- All persisted timestamps are timezone-aware and rendered in UTC.
- Freshness is based on the API server clock.
- The system does not enforce NTP. A badly skewed server clock will produce misleading ages.
- Source timestamps are parsed as ISO-8601 where available. Invalid timestamps become `null`; they are not replaced with the collection time.
- `started_at` on an incident is the detection/open time unless the source supplied an authoritative onset.
- The reference environment is a local Windows workspace; production should run with synchronized clocks.

## 10. Operational checks

- `/api/v1/collection/status` shows each source's last attempt, last success, error, failures, expected interval and stale threshold.
- `/api/v1/overview` includes source freshness for every network.
- `/metrics` exposes `computepulse_collection_success_timestamp_seconds` and source latency for alerting.
- The app's network and provider pages show freshness next to the data they describe.
- A source failure is visible as a failed collection run, not hidden behind cached UI.
