# Metric methodology

ComputePulse does not publish a single health score. It publishes evidence with a source, a method, an observation time, a measurement window and a freshness state. This document defines those terms and the formulas used in the application.

## 1. Evidence states

| State | Meaning | Example |
| --- | --- | --- |
| `OBSERVED` | Measured directly by ComputePulse | Akash list request latency; monitor response time; BOT RPC latency |
| `REPORTED` | Supplied by the upstream source, not independently verified | Akash `isOnline`; Akash uptime windows; Akash capacity stats |
| `ESTIMATED` | Derived by ComputePulse from source fields using a documented method | Flux confirmation lag; Flux node age |
| `UNAVAILABLE` | The source does not expose the signal; no value is inferred | Flux liveness; Flux capacity |
| `STALE` | A value exists but its age exceeds the freshness policy | A source last succeeded 40 minutes ago with a 30-minute stale threshold |
| `PENDING` | A monitor exists but has not completed its first check | Newly created endpoint monitor |

`STALE` is a freshness state, not a different collection method. A stale value keeps its original evidence class but must not be presented as current. `PENDING` is a workflow state and carries no value.

### Visual and textual rules

- Every metric surface shows an evidence badge and a freshness badge.
- A missing field is displayed as `—`, `UNAVAILABLE` or `NO DATA`, never as `0`.
- Charts show gaps where observations are absent.
- A tooltip or provenance drawer exposes source URL, collection method, observation time, measurement window and evidence state.

## 2. Required provenance for every metric

Each observation should be able to answer:

1. **Source**: which endpoint and source field produced it?
2. **Observation time**: when did the source or worker observe it?
3. **Measurement window**: what period does the value describe (instant, 1 day, 7 days, 30 days, 24 hours of checks)?
4. **Collection method**: list request, JSON-RPC call, HTTP monitor, derived formula?
5. **Evidence class**: observed, reported or estimated?
6. **Freshness**: fresh, delayed, stale, unavailable or pending?
7. **Actual vs estimated**: is the number directly returned or calculated?
8. **Limitation**: what must the reader not infer from it?

The API stores these fields in `observations` and `providers.latest_metrics`; the UI exposes them through provenance components.

## 3. Provider health

### Akash

```text
UNKNOWN   no boolean isOnline field
DOWN      isOnline === false
DEGRADED  isOnline === true AND isValidVersion === false
DEGRADED  isOnline === true AND uptime1d !== null AND uptime1d < 0.95
HEALTHY   isOnline === true AND the degraded conditions do not apply
```

- Evidence: `REPORTED` (`healthSignal = source_reported`).
- The rule uses the source's own fields. ComputePulse does not probe the provider.
- `uptime1d/7d/30d` are source-reported ratios and are clamped to `[0, 1]`.

### Flux

```text
UNKNOWN   all Flux providers in the public list
```

- Evidence: `UNAVAILABLE` (`healthSignal = unavailable`).
- No online flag exists. Registration, tier, confirmation lag and node age are shown, but they are not converted into health.
- `UNAVAILABLE` is a valid final answer. It is not a loading state.

### Provider health counts

`healthy`, `degraded`, `down`, `unknown` counts are **counts of source-specific states**, not a network health percentage. A network with many `unknown` Flux nodes is not "0% healthy"; it simply has no liveness evidence from that source.

## 4. Availability

### Akash availability windows

- `availability_1d = uptime1d`
- `availability_7d = uptime7d`
- `availability_30d = uptime30d`
- Method: `akash_console_reported_uptime`
- Evidence: `REPORTED`
- Window: the source's 1-day, 7-day and 30-day windows.
- Limitation: source-computed; not a ComputePulse probe and not an SLA.

### Endpoint monitor availability

```text
availability(window) = successful_checks(window) / total_checks(window)
```

- Window: the selected 1h, 24h, 7d, 30d or custom range.
- Evidence: `OBSERVED`.
- If `total_checks = 0`, availability is `null` and the UI shows `NO CHECKS` / `UNAVAILABLE`.
- A failed HTTP status, timeout or expected-body mismatch counts as a failed check.
- Availability describes the monitored endpoint only. It is not provider-wide availability.

### Flux availability

`null` / `UNAVAILABLE` for all windows. The source does not expose uptime.

## 5. Latency

### Source latency (`network.source_latency_ms`)

- What: wall-clock duration of the source collection HTTP request(s) as measured by the ComputePulse worker.
- Evidence: `OBSERVED`.
- It describes the source API response time. It is **not** per-provider network latency.
- For Flux, the value covers the node-list plus head collection.

### Endpoint monitor latency

- What: time to complete the monitor request and read the response.
- Evidence: `OBSERVED`.
- Window: latest check, plus 24-hour history.
- Includes DNS, connect, TLS, request and response read.
- Timeout is configured per monitor.

### BOT/Bohr RPC latency

- What: time for `eth_chainId`, `eth_blockNumber` and `eth_getBlockByNumber` to complete.
- Evidence: `OBSERVED`.
- It measures one RPC endpoint at one moment, not the whole validator set.

## 6. Capacity

### Akash

- Evidence: `REPORTED`.
- CPU: source millicores divided by 1,000.
- Memory and storage: bytes.
- GPU: count.
- Fields: total, available, active where supplied.
- Limitation: provider-reported index capacity. It is not verified schedulable capacity, and it does not prove a workload can be placed now.

### Flux

- Evidence: `UNAVAILABLE`.
- The public node-list response does not include CPU, memory, storage or GPU capacity.
- A separate per-node benchmark endpoint exists but is not mass-queried.

No capacity value is inferred from collateral, tier or node age.

## 7. Derived Flux metrics

```text
confirmation_lag_blocks = max(0, head_height - last_confirmed_height)
node_age_seconds        = max(0, collected_at - activesince)
```

- Evidence: `ESTIMATED`.
- `confirmation_lag_blocks` is a chain-confirmation recency signal. It is not liveness.
- `node_age_seconds` depends on the source's `activesince` value.
- If the head request fails, lag is `null`; the adapter does not guess a head.

## 8. BOT/Bohr chain metrics

```text
block_age_seconds = max(0, now - latest_block_timestamp)
```

- Evidence: `OBSERVED`.
- `chain.chain_id` is verified against the documented ID.
- Health thresholds: degraded above 120 seconds, down above 600 seconds.
- These thresholds describe the monitored RPC/chain head. They do not establish validator-set health or transaction finality quality.

## 9. Benchmarks and comparability

### Comparability groups

Metric definitions carry a `comparability_group` and a unit. A benchmark row is only compared inside the same group and unit. Examples:

- source response latency in milliseconds
- RPC latency in milliseconds
- availability ratios from source-reported uptime
- capacity in cores, bytes or GPU count

### Percentiles

The benchmark API reports p50, p90 and p99 using a nearest-rank selection over the available samples:

```text
index = floor((n - 1) * p)
value = sorted[index]
```

If there are no samples, the percentile is `null`. The sample count is always shown.

### No composite score

There is no provider score, rank or network health percentage. A single ranking would combine:

- reported uptime (Akash)
- unavailable liveness (Flux)
- reported capacity (Akash)
- unavailable capacity (Flux)
- observed RPC latency (BOT)

Those are not interchangeable units or evidence classes. Combining them would create false precision.

## 10. Incidents

Incidents are operational records, not metrics.

- Source-reported offline state is `REPORTED`.
- An endpoint monitor failure is `OBSERVED`.
- `started_at` is the detection/open time unless a source supplied an authoritative onset.
- `source_observed_at` is the source's timestamp where available.
- The incident source commitment is SHA-256 over the persisted incident identity and evidence fields. It is a local commitment, not a blockchain transaction.
- An incident can be `not_anchored`; that is an honest state, not an error.

## 11. Missing observations

- A missing observation is represented by absence or `null`, never zero.
- A time bucket with no samples is a gap.
- The UI reports coverage and the last observed time next to charts.
- A stale value is shown with a `STALE` badge and an age.
- A source failure produces a failed collection run and eventually a stale source, not a healthy-looking empty chart.
