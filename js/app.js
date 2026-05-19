/* ═══════════════════════════════════════════
   Main Application — Yvonne's Voice Dictionary
   ═══════════════════════════════════════════ */

const App = (() => {
  // State
  let mode = 'search'; // 'search' | 'browse'
  let favorites = new Set();
  let activeGrade = null;
  let activeCategory = 'all';
  let favoritesOnly = false;
  let searchTimeout = null;

  // DOM refs
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  // ── Initialize ──
  async function init() {
    if (localStorage.getItem('vd_unlocked') === 'true') {
      _startApp();
    } else {
      _setupPasscodeScreen();
    }
  }

  async function _startApp() {
    _loadFavorites();
    SpeechEngine.loadSavedSpeed();

    SearchEngine.init(VOCABULARY);

    await SpeechEngine.init();

    _bindEvents();
    _renderFilters();
    _showWelcome();

    // Focus search on load (desktop only)
    if (window.innerWidth > 768) {
      setTimeout(() => $('#search-input')?.focus(), 600);
    }
  }

  function _setupPasscodeScreen() {
    const screen = $('#passcode-screen');
    if (!screen) return;
    screen.style.display = 'flex';

    let enteredCode = '';
    const CORRECT_CODE = '791127';
    const dots = $$('.passcode-dot');
    const errorEl = $('#passcode-error');

    function updateDots() {
      dots.forEach((dot, idx) => {
        dot.classList.toggle('filled', idx < enteredCode.length);
        dot.classList.remove('error');
      });
    }

    function triggerError() {
      errorEl.classList.add('visible');
      dots.forEach(dot => {
        dot.classList.add('error');
      });
      // Shake animation
      const container = $('.passcode-container');
      container.style.animation = 'none';
      setTimeout(() => {
        container.style.animation = 'shake 0.4s ease';
      }, 10);

      setTimeout(() => {
        enteredCode = '';
        updateDots();
      }, 800);
    }

    function handleKeyPress(val) {
      errorEl.classList.remove('visible');

      if (val === 'delete') {
        if (enteredCode.length > 0) {
          enteredCode = enteredCode.slice(0, -1);
          updateDots();
        }
        return;
      }

      if (enteredCode.length < 6) {
        enteredCode += val;
        updateDots();

        if (enteredCode.length === 6) {
          if (enteredCode === CORRECT_CODE) {
            // Unlock!
            localStorage.setItem('vd_unlocked', 'true');
            screen.classList.add('unlocked');
            setTimeout(() => {
              screen.style.display = 'none';
              _startApp();
            }, 400);
          } else {
            // Error!
            setTimeout(triggerError, 100);
          }
        }
      }
    }

    // Keypad clicks
    $$('.passcode-key').forEach(key => {
      key.addEventListener('click', () => {
        const val = key.dataset.val;
        if (val) handleKeyPress(val);
      });
    });

    // Keyboard support for ease of desktop testing
    document.addEventListener('keydown', (e) => {
      if (screen.style.display === 'none') return;
      if (e.key >= '0' && e.key <= '9') {
        handleKeyPress(e.key);
      } else if (e.key === 'Backspace') {
        handleKeyPress('delete');
      }
    });
  }

  // ── Bind all events ──
  function _bindEvents() {
    // Nav tabs
    $$('.nav-tab').forEach(tab => {
      tab.addEventListener('click', () => _switchMode(tab.dataset.mode));
    });

    // Search input
    const searchInput = $('#search-input');
    if (searchInput) {
      searchInput.addEventListener('input', _onSearchInput);
      searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          searchInput.value = '';
          _onSearchInput();
          searchInput.blur();
        }
      });
    }

    // Clear button
    $('#search-clear')?.addEventListener('click', () => {
      searchInput.value = '';
      _onSearchInput();
      searchInput.focus();
    });

    // Delegate clicks on results area
    $('#results').addEventListener('click', _onResultsClick);

    // Modal overlay
    $('#modal-overlay')?.addEventListener('click', (e) => {
      if (e.target.id === 'modal-overlay') _closeModal();
    });
    $('#modal-close')?.addEventListener('click', _closeModal);

    // Keyboard shortcut: Escape to close modal
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') _closeModal();
    });
  }

  // ── Switch mode ──
  function _switchMode(newMode) {
    mode = newMode;
    $$('.nav-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.mode === mode);
    });

    const searchSection = $('.search-section');
    const filterBar = $('.filter-bar');

    if (mode === 'search') {
      searchSection.style.display = '';
      filterBar.classList.remove('visible');
      _showWelcome();
      setTimeout(() => $('#search-input')?.focus(), 100);
    } else {
      searchSection.style.display = 'none';
      filterBar.classList.add('visible');
      _renderBrowseGrid();
    }
  }

  // ── Search input handler ──
  function _onSearchInput() {
    clearTimeout(searchTimeout);
    const query = $('#search-input').value;

    // Show/hide clear button
    const clearBtn = $('#search-clear');
    if (clearBtn) {
      clearBtn.classList.toggle('visible', query.length > 0);
    }

    if (!query.trim()) {
      _showWelcome();
      return;
    }

    searchTimeout = setTimeout(() => {
      const results = SearchEngine.search(query);
      _renderSearchResults(results, query);
    }, 150);
  }

  // ── Render search results ──
  function _renderSearchResults(results, query) {
    const container = $('#results');
    container.innerHTML = '';

    if (!results.length) {
      container.appendChild(UI.renderEmptyState('not-found'));
      return;
    }

    // Word count
    const countDiv = document.createElement('div');
    countDiv.className = 'word-count';
    countDiv.innerHTML = `Found <span class="word-count__number">${results.length}</span> result${results.length !== 1 ? 's' : ''}`;
    container.appendChild(countDiv);

    // Render each result as a card
    results.forEach(entry => {
      const card = UI.renderWordCard(entry, favorites.has(entry.word));
      container.appendChild(card);
    });
  }

  // ── Render browse grid ──
  function _renderBrowseGrid() {
    const container = $('#results');
    container.innerHTML = '';

    const filtered = SearchEngine.filter({
      grade: activeGrade,
      category: activeCategory,
      favoritesOnly: favoritesOnly,
      favorites: favorites
    });

    // Word count
    const countDiv = document.createElement('div');
    countDiv.className = 'word-count';

    if (favoritesOnly && filtered.length === 0) {
      container.appendChild(UI.renderEmptyState('no-favorites'));
      return;
    }

    countDiv.innerHTML = `<span class="word-count__number">${filtered.length}</span> word${filtered.length !== 1 ? 's' : ''}`;
    container.appendChild(countDiv);

    // Grid
    const grid = document.createElement('div');
    grid.className = 'word-grid';

    filtered.forEach(entry => {
      const tile = UI.renderWordTile(entry, favorites.has(entry.word));
      tile.addEventListener('click', () => _openModal(entry));
      grid.appendChild(tile);
    });

    container.appendChild(grid);
  }

  // ── Render filter chips ──
  function _renderFilters() {
    const gradeContainer = $('#filter-grades');
    const catContainer = $('#filter-categories');
    if (!gradeContainer || !catContainer) return;

    // Grade filters
    const grades = SearchEngine.getGrades();
    gradeContainer.innerHTML = '<span class="filter-group__label">Grade:</span>';

    const allGradeChip = _createFilterChip('All', () => {
      activeGrade = null;
      _updateFilterUI();
      _renderBrowseGrid();
    });
    allGradeChip.classList.add('active');
    allGradeChip.dataset.gradeValue = 'all';
    gradeContainer.appendChild(allGradeChip);

    grades.forEach(g => {
      const chip = _createFilterChip(`Grade ${g}`, () => {
        activeGrade = g;
        _updateFilterUI();
        _renderBrowseGrid();
      });
      chip.dataset.gradeValue = g;
      gradeContainer.appendChild(chip);
    });

    // Favorites filter
    const favChip = _createFilterChip('⭐ Favorites', () => {
      favoritesOnly = !favoritesOnly;
      _updateFilterUI();
      _renderBrowseGrid();
    });
    favChip.classList.add('star');
    favChip.id = 'filter-fav';
    gradeContainer.appendChild(favChip);

    // Category filters
    const categories = SearchEngine.getCategories();
    catContainer.innerHTML = '<span class="filter-group__label">Category:</span>';

    const allCatChip = _createFilterChip('All', () => {
      activeCategory = 'all';
      _updateFilterUI();
      _renderBrowseGrid();
    });
    allCatChip.classList.add('active');
    allCatChip.dataset.catValue = 'all';
    catContainer.appendChild(allCatChip);

    const categoryLabels = {
      academic: '📖 Academic',
      science: '🔬 Science',
      social: '🌍 Social Studies',
      daily: '🏠 Daily Life',
      stories: '📚 Stories',
      feelings: '💭 Feelings',
      math: '🔢 Math',
      advanced: '🎓 Advanced'
    };

    categories.forEach(cat => {
      const label = categoryLabels[cat] || cat;
      const chip = _createFilterChip(label, () => {
        activeCategory = cat;
        _updateFilterUI();
        _renderBrowseGrid();
      });
      chip.dataset.catValue = cat;
      catContainer.appendChild(chip);
    });
  }

  function _createFilterChip(label, onClick) {
    const chip = document.createElement('button');
    chip.className = 'filter-chip';
    chip.textContent = label;
    chip.addEventListener('click', onClick);
    return chip;
  }

  function _updateFilterUI() {
    // Grade chips
    $$('#filter-grades .filter-chip:not(.star)').forEach(chip => {
      const val = chip.dataset.gradeValue;
      chip.classList.toggle('active',
        (val === 'all' && !activeGrade) ||
        (val && parseInt(val) === activeGrade)
      );
    });

    // Favorites chip
    const favChip = $('#filter-fav');
    if (favChip) favChip.classList.toggle('active', favoritesOnly);

    // Category chips
    $$('#filter-categories .filter-chip').forEach(chip => {
      const val = chip.dataset.catValue;
      chip.classList.toggle('active', val === activeCategory);
    });
  }

  // ── Open modal with word detail ──
  function _openModal(entry) {
    const overlay = $('#modal-overlay');
    const content = $('#modal-content');
    if (!overlay || !content) return;

    content.innerHTML = '';
    const card = UI.renderWordCard(entry, favorites.has(entry.word));
    content.appendChild(card);
    overlay.classList.add('visible');
    document.body.style.overflow = 'hidden';
  }

  function _closeModal() {
    const overlay = $('#modal-overlay');
    if (!overlay) return;
    overlay.classList.remove('visible');
    document.body.style.overflow = '';
    SpeechEngine.stop();
  }

  // ── Handle clicks in results/modal ──
  function _onResultsClick(e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;

    const action = btn.dataset.action;

    if (action === 'speak' || action === 'speak-word') {
      const text = btn.dataset.text;
      const lang = btn.dataset.lang;
      UI.setSpeakButtonActive(btn, true);
      SpeechEngine.speak(text, lang, {
        onEnd: () => UI.setSpeakButtonActive(btn, false)
      });
    }

    if (action === 'play-all') {
      const word = btn.dataset.word;
      const entry = VOCABULARY.find(w => w.word === word);
      if (!entry) return;

      UI.setSpeakButtonActive(btn, true);
      SpeechEngine.playAll(entry, {
        onAllEnd: () => UI.setSpeakButtonActive(btn, false)
      });
    }

    if (action === 'toggle-fav') {
      const word = btn.dataset.word;
      _toggleFavorite(word);
      btn.classList.toggle('active');
      btn.textContent = favorites.has(word) ? '⭐' : '☆';

      // Update tiles in browse grid
      const tile = document.querySelector(`.word-tile[data-word="${word}"]`);
      if (tile) {
        const star = tile.querySelector('.word-tile__star');
        if (star) star.classList.toggle('visible', favorites.has(word));
      }
    }

    // Speed buttons
    if (btn.dataset.speed) {
      const speed = parseFloat(btn.dataset.speed);
      SpeechEngine.setSpeed(speed);
      // Update all speed buttons on page
      $$('.speed-btn').forEach(sb => {
        sb.classList.toggle('active', parseFloat(sb.dataset.speed) === speed);
      });
    }
  }

  // ── Also handle modal clicks ──
  document.addEventListener('click', (e) => {
    const modal = document.getElementById('modal-overlay');
    if (!modal || !modal.classList.contains('visible')) return;

    const btn = e.target.closest('[data-action]');
    if (!btn) return;

    // Same logic
    _onResultsClick(e);
  });

  // ── Favorites management ──
  function _toggleFavorite(word) {
    if (favorites.has(word)) {
      favorites.delete(word);
    } else {
      favorites.add(word);
    }
    _saveFavorites();
  }

  function _saveFavorites() {
    try {
      localStorage.setItem('vd_favorites', JSON.stringify([...favorites]));
    } catch (e) {}
  }

  function _loadFavorites() {
    try {
      const saved = localStorage.getItem('vd_favorites');
      if (saved) favorites = new Set(JSON.parse(saved));
    } catch (e) {}
  }

  // ── Show welcome state ──
  function _showWelcome() {
    const container = $('#results');
    container.innerHTML = '';
    container.appendChild(UI.renderEmptyState('welcome'));
  }

  return { init };
})();

// ── Boot ──
document.addEventListener('DOMContentLoaded', () => App.init());
