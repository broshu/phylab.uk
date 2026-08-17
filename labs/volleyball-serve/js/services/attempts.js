/**
 * Attempt log and scoring.
 * ------------------------------------------------------------------
 * In-memory plus localStorage for now. To report to a server later,
 * replace save() — record/summary/toCSV are the stable interface.
 */
const STORAGE_KEY = 'phylab-volleyball-serve';

export function createAttemptLog({ problemId, persist = true } = {}) {
  /** @type {{v:number, verdict:string, passed:boolean, at:number}[]} */
  let records = [];

  function load() {
    if (!persist || typeof localStorage === 'undefined') return;
    try {
      const raw = localStorage.getItem(`${STORAGE_KEY}:${problemId}`);
      if (raw) records = JSON.parse(raw);
    } catch {
      records = [];
    }
  }

  function save() {
    if (!persist || typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(
        `${STORAGE_KEY}:${problemId}`,
        JSON.stringify(records.slice(-200)),
      );
    } catch {
      /* ignore quota errors */
    }
  }

  load();

  return {
    record(result) {
      records.push({
        v: Number(result.v.toFixed(2)),
        verdict: result.verdict,
        passed: result.passed,
        at: Date.now(),
      });
      save();
      return this.summary();
    },
    summary() {
      const total = records.length;
      const firstSuccess = records.findIndex((r) => r.passed);
      return {
        total,
        successes: records.filter((r) => r.passed).length,
        firstSuccessAt: firstSuccess < 0 ? null : firstSuccess + 1,
        solved: firstSuccess >= 0,
        history: records.slice(),
      };
    },
    reset() {
      records = [];
      save();
    },
    /** CSV export, for collecting a class set. */
    toCSV() {
      const head = 'index,speed_m_s,verdict,passed,timestamp\n';
      return (
        head +
        records
          .map(
            (r, i) =>
              `${i + 1},${r.v},${r.verdict},${r.passed},${new Date(r.at).toISOString()}`,
          )
          .join('\n')
      );
    },
  };
}
