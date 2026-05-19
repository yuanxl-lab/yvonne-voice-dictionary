/* ═══════════════════════════════════════════
   Search Engine — Fuzzy search & filtering
   ═══════════════════════════════════════════ */

const SearchEngine = (() => {
  let vocabulary = [];

  function init(vocabData) {
    vocabulary = vocabData;
  }

  // ── Main search function ──
  function search(query) {
    if (!query || !query.trim()) return [];

    const q = query.trim().toLowerCase();

    // Exact match first
    const exact = vocabulary.filter(w => w.word.toLowerCase() === q);
    if (exact.length) return exact;

    // Starts-with match
    const startsWith = vocabulary.filter(w =>
      w.word.toLowerCase().startsWith(q)
    );

    // Contains match
    const contains = vocabulary.filter(w =>
      !w.word.toLowerCase().startsWith(q) &&
      w.word.toLowerCase().includes(q)
    );

    // Chinese meaning match
    const chineseMatch = vocabulary.filter(w =>
      w.chinese_meaning && w.chinese_meaning.includes(query.trim())
    );

    // Definition match
    const defMatch = vocabulary.filter(w =>
      !w.word.toLowerCase().includes(q) &&
      w.definition.toLowerCase().includes(q)
    );

    // Fuzzy match (simple Levenshtein for short queries)
    let fuzzy = [];
    if (q.length >= 3 && startsWith.length === 0 && contains.length === 0) {
      fuzzy = vocabulary.filter(w => {
        const dist = _levenshtein(q, w.word.toLowerCase().slice(0, q.length + 2));
        return dist <= 2 && dist > 0;
      }).slice(0, 10);
    }

    // Deduplicate and combine
    const seen = new Set();
    const results = [];
    for (const list of [startsWith, contains, chineseMatch, defMatch, fuzzy]) {
      for (const item of list) {
        if (!seen.has(item.word)) {
          seen.add(item.word);
          results.push(item);
        }
      }
    }

    return results;
  }

  // ── Filter vocabulary ──
  function filter({ grade, category, favoritesOnly, favorites }) {
    return vocabulary.filter(w => {
      if (grade && w.grade !== grade) return false;
      if (category && category !== 'all' && w.category !== category) return false;
      if (favoritesOnly && favorites && !favorites.has(w.word)) return false;
      return true;
    });
  }

  // ── Get all categories ──
  function getCategories() {
    const cats = new Set(vocabulary.map(w => w.category));
    return Array.from(cats).sort();
  }

  // ── Get all grades ──
  function getGrades() {
    const grades = new Set(vocabulary.map(w => w.grade));
    return Array.from(grades).sort();
  }

  // ── Get vocabulary stats ──
  function getStats() {
    return {
      total: vocabulary.length,
      byGrade: _countBy(vocabulary, 'grade'),
      byCategory: _countBy(vocabulary, 'category')
    };
  }

  // ── Simple Levenshtein distance ──
  function _levenshtein(a, b) {
    const m = a.length, n = b.length;
    if (m === 0) return n;
    if (n === 0) return m;

    const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1,
          dp[i - 1][j - 1] + cost
        );
      }
    }
    return dp[m][n];
  }

  function _countBy(arr, key) {
    const counts = {};
    arr.forEach(item => {
      const val = item[key];
      counts[val] = (counts[val] || 0) + 1;
    });
    return counts;
  }

  return { init, search, filter, getCategories, getGrades, getStats };
})();
