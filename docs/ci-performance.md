# CI performance

This change keeps all player, regression, author-preview, unit, story, build and
editor checks. It changes their scheduling, not the game, assertions, retries,
worker counts, browser configuration, story revision or saves.

## Baseline evidence

Read public Actions summaries and `check-step` start/completion timestamps on
November 10, 2026. Values below are seconds; `<1` means timestamp granularity,
not that the command was omitted. Authentication is required for full logs, but
these job timestamps are public.

| Step | [PR #78](https://github.com/ShaneEnochs/pokemon/actions/runs/42878198534/job/130047076954) | [Latest main](https://github.com/ShaneEnochs/pokemon/actions/runs/42878592046/job/130048449048) | [Earlier main](https://github.com/ShaneEnochs/pokemon/actions/runs/42644903336/job/129255438137) |
| --- | ---: | ---: | ---: |
| npm ci | 2 | 2 | 2 |
| Unit tests | 5 | 6 | 6 |
| Story validation | <1 | <1 | 1 |
| Root build | <1 | 1 | <1 |
| Chromium + system dependencies | 19 | 24 | 20 |
| Browser + regression tests | 47 | 54 | 55 |
| Author-preview tests | 10 | 12 | 11 |
| Pages build/check | 1 | 1 | 1 |

PR #78 finished in 94 seconds; `test-and-build` took 89 seconds and the separate
extension job 11 seconds. The latest main run finished in 146 seconds, with a
108-second test job and 28-second deployment job. Deployment action time varied
from [8 seconds](https://github.com/ShaneEnochs/pokemon/actions/runs/42878592046/job/130049551339)
to [241 seconds](https://github.com/ShaneEnochs/pokemon/actions/runs/42644903336/job/129256481698),
while deployment builds took only one second. Check scheduling cannot eliminate
that service wait. Deployment permissions, main-only condition, prerequisites,
workflow cancellation policy, Pages concurrency group and serialized deployment
remain unchanged.

## Scheduling and safety

- `plan` checks a strict documentation allowlist. Full history is fetched for
  reliable base/head comparison (the current local Git database is about 3.6 MiB).
  Missing commits, malformed SHAs or classification errors fail the required gate.
- `core` runs unit tests, story validation and `build:pages`, which includes
  TypeScript checking. Each browser job independently builds the default root
  output; builds never race with tests on the same checkout.
- Two independent browser runners use `--shard=1/2` and `--shard=2/2`, each with
  the existing two workers and both Playwright projects. Their exact partition
  was checked: **44 + 43 = 87**, no overlap or omissions (18 public, 69 regression).
- All 19 author tests run on a separate runner with their existing single worker.
  No CPU or server-port contention occurs between these jobs. The extension
  workflow remains independent and unchanged.
- Matrix fail-fast is disabled so a failed shard does not cancel diagnostic work
  on the other. Failure artifacts retain seven-day retention and have unique
  names per shard/author job, avoiding upload conflicts. Existing reporters,
  traces, screenshots and result directories are preserved.
- `test-and-build` keeps its existing required-check name and is now an always-run
  gate. It requires every full-check job to succeed. Skips/cancellations/errors
  cannot become a passing full check. Only a successful documentation-only plan
  permits the three heavy jobs to be skipped. The separate
  `editor-tools / extension` check remains present even for documentation PRs.

The lightweight PR path allows only README.md, FUTURE_IDEAS.md,
docs/STORY_BIBLE.md, docs/STORY_OUTLINE.md, docs/CHARACTERS.md and this report.
It still runs classifier tests and the existing extension workflow. **It is not
a blanket `*.md` filter:** SCRIPTING.md is read by executable grammar tests;
SCRIPTING.md, AUTHORING.md, ENGINE.md, new/unknown files, code, story scripts,
metadata, CSS, tests, assets, lockfiles, workflows and other configuration all
require full validation. Both sides of a move are classified without rename
heuristics. Every main push always runs full validation and the existing Pages
pipeline, including documentation pushes. There is no workflow-level path filter
that could leave a required check pending.

## Docker investigation

The installed Playwright version is pinned to **1.64.1**. Its candidate official
image is `mcr.microsoft.com/playwright:v1.64.1-noble`. The managed Docker daemon
was available, but manifest inspection failed after **5.76 seconds** because the
registry redirected to `westus.data.mcr.microsoft.com`, which this environment's
proxy denied. This is a failed access measurement, **not** an image startup time.
No browser/container artifact from that failed request was used.

Docker is **not adopted**: no cold image-pull, job-container initialization or
successful startup measurement is available. The workflow retains the known
Playwright-managed Chromium/system dependency installation, including TLS and
integrity verification. Caching a browser alone would not remove system-dependency
setup, so no speculative browser cache is added either.

Before adopting the image, benchmark fresh GitHub-hosted runners at the same
commit: time `docker pull` of the exact matching tag and `docker run --rm IMAGE
node --version`, then compare a job-container run against the current install
path. Include `Set up job` / `Initialize containers`, checkout/npm setup, full
sharded/author tests, and post-job cleanup in the total. A warm pull alone is
insufficient. Use at least three runs per variant and keep the Playwright package
and image versions matched. Do not change the default until cold startup plus
execution reliably beats the 19–24-second installation path and all tests pass.

## Local comparison and limits

| Local command | Seconds | Result |
| --- | ---: | --- |
| install | 2.65 | passed |
| unit | 5.70 | passed |
| stories | 0.67 | passed |
| root_build | 1.42 | passed |
| browser_all | 109.94 | passed |
| author | 21.58 | passed |
| pages | 1.71 | passed |
| restore_root | 1.88 | passed |
| browser_shard_1 | 71.86 | passed |
| browser_shard_2 | 59.20 | passed |

All 87 tests passed in the unsharded baseline, all 44/43 passed in the individual
shards, all 19 author tests passed, and all 1,267 unit tests passed. No test was
excluded or retried. The longest measured shard was **71.86 seconds versus
109.94 seconds** for the full browser command, a **34.6% shorter test step**.
The sum of shard times was 131.06 seconds: aggregate test work increases because
both runners repeat server/regression-build startup.

A scheduling model using these measured command durations gives 143.67 seconds
for the original serial job and 75.93 seconds for the optimized longest lane,
including each lane's own npm install and root build where required. That is a
**47.1% modeled reduction before plan/gate/runner/browser-install overhead**, not
an observed hosted end-to-end improvement. The core lane models at 10.73 seconds,
author at 24.23 seconds, and the other browser lane at 63.27 seconds.


Local measurements use the existing installed `/usr/bin/chromium`, a warm npm
cache, CI mode and the unchanged worker counts. Full tests and each shard run
sequentially on the same managed machine to avoid contention/port conflicts;
CI runs the shards on separate runners. These measurements exclude GitHub queues,
runner setup, Chromium installation, the plan/gate jobs and network variability.
They demonstrate test partition/runtime behavior, not a measured GitHub PR latency.

Using PR #78's installation and setup costs, roughly **60–75 seconds** for a full
PR is a scheduling estimate, compared with 94 seconds observed before. Additional
plan/gate runner startup and the slowest shard determine whether that estimate
holds. More runners increase aggregate runner minutes and duplicate npm/browser
installation even if latency falls; this intentionally stops at two shards.

The GitHub API is denied in this environment, so an optimized hosted run could not
be dispatched and hosted speedup remains unverified. After opening the PR, record
its run URL and compare the public step timestamps against the table above.
Measure the critical path from event to required checks complete, not the
now-short gate duration alone. Repeat on three comparable commits/runs, including
a safe docs-only PR, and inspect queue times and every artifact/check before
claiming the hosted improvement. Reduce sharding if runner startup/queues erase
the savings. Do not relax tests or deployment gates to reach a target time.

Validation also includes the CI classifier's Git integration tests (docs, source
moves, main pushes and missing revisions), fail-closed gate scenarios, workflow
linting with the checksum-verified official actionlint 1.7.7 binary, and all
existing application suites/build checks. No dependency was added to the project.
