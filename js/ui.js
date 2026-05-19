/* ═══════════════════════════════════════════
   UI Module — Animations, theme, helpers
   ═══════════════════════════════════════════ */

const UI = (() => {

  // ── Create sound wave animation element ──
  function createSoundWave() {
    const wave = document.createElement('span');
    wave.className = 'sound-wave';
    for (let i = 0; i < 4; i++) {
      const bar = document.createElement('span');
      bar.className = 'sound-wave__bar';
      wave.appendChild(bar);
    }
    return wave;
  }

  // ── Render a word card (detail view) ──
  function renderWordCard(entry, isFavorited = false) {
    const card = document.createElement('div');
    card.className = 'word-card';
    card.id = `card-${entry.word}`;

    // Build examples HTML - support both single and multiple examples
    const examples = entry.examples || [entry.example];
    const examplesHtml = examples.filter(Boolean).map(ex => 
      `<div class="word-section__example">"${escapeHtml(ex)}"</div>`
    ).join('');
    const allExamplesText = examples.filter(Boolean).join('. ');

    card.innerHTML = `
      <div class="word-card__header">
        <div>
          <div class="word-card__word">${escapeHtml(entry.word)}</div>
          <div class="word-card__meta">
            <span class="word-card__phonetic">${escapeHtml(entry.phonetic || '')}</span>
            <span class="word-card__pos">${escapeHtml(entry.pos)}</span>
            <span class="word-card__grade">Grade ${entry.grade}</span>
          </div>
        </div>
        <div class="word-card__actions">
          <button class="speak-btn speak-btn--large" data-action="speak-word" data-text="${escapeAttr(entry.word)}" data-lang="en" title="Listen to word">
            🔊 Listen
          </button>
          <button class="fav-btn ${isFavorited ? 'active' : ''}" data-action="toggle-fav" data-word="${escapeAttr(entry.word)}" title="Favorite">
            ${isFavorited ? '⭐' : '☆'}
          </button>
        </div>
      </div>

      <div class="word-section">
        <div class="word-section__label">📝 Definition</div>
        <div class="word-section__content">${escapeHtml(entry.definition)}</div>
        <button class="speak-btn" data-action="speak" data-text="${escapeAttr(entry.definition)}" data-lang="en" style="margin-top: 8px;">
          🔊 Listen Definition
        </button>
      </div>

      <div class="word-section">
        <div class="word-section__label">💬 Example${examples.length > 1 ? 's' : ''}</div>
        ${examplesHtml}
        <button class="speak-btn" data-action="speak" data-text="${escapeAttr(allExamplesText)}" data-lang="en" style="margin-top: 8px;">
          🔊 Listen Example${examples.length > 1 ? 's' : ''}
        </button>
      </div>

      <div class="word-section__divider"></div>

      <div class="word-section">
        <div class="word-section__label word-section__label--zh">🀄 Chinese</div>
        <div class="word-section__content word-section__content--zh">
          <strong>${escapeHtml(entry.chinese_meaning)}</strong>
        </div>
        <div class="word-section__content word-section__content--zh" style="margin-top: 6px;">
          ${escapeHtml(entry.chinese_context)}
        </div>
        <button class="speak-btn" data-action="speak" data-text="${escapeAttr(entry.chinese_meaning + '。' + entry.chinese_context)}" data-lang="zh" style="margin-top: 8px;">
          🔊 Listen Chinese
        </button>
      </div>

      ${entry.tips ? `
      <div class="word-section__tip">
        💡 ${escapeHtml(entry.tips)}
      </div>` : ''}

      <div class="word-card__footer">
        <div class="speed-control">
          <span class="speed-control__label">Speed:</span>
          <button class="speed-btn" data-speed="0.7">Slow</button>
          <button class="speed-btn active" data-speed="1">Normal</button>
          <button class="speed-btn" data-speed="1.3">Fast</button>
        </div>
        <button class="speak-btn speak-btn--play-all" data-action="play-all" data-word="${escapeAttr(entry.word)}">
          🔊 Play All
        </button>
      </div>
    `;

    // Set correct speed button active state
    const currentSpeed = SpeechEngine.getSpeed();
    card.querySelectorAll('.speed-btn').forEach(btn => {
      btn.classList.toggle('active', parseFloat(btn.dataset.speed) === currentSpeed);
    });

    return card;
  }

  // ── Render a word tile (browse grid) ──
  function renderWordTile(entry, isFavorited = false) {
    const tile = document.createElement('div');
    tile.className = 'word-tile';
    tile.dataset.word = entry.word;

    tile.innerHTML = `
      <span class="word-tile__star ${isFavorited ? 'visible' : ''}">⭐</span>
      <div class="word-tile__word">${escapeHtml(entry.word)}</div>
      <div class="word-tile__pos">${escapeHtml(entry.pos)}</div>
      <div class="word-tile__chinese">${escapeHtml(entry.chinese_meaning)}</div>
    `;

    return tile;
  }

  // ── Render empty state ──
  function renderEmptyState(type = 'search') {
    const div = document.createElement('div');
    div.className = 'empty-state';

    if (type === 'search') {
      div.innerHTML = `
        <div class="empty-state__icon">🔍</div>
        <div class="empty-state__title">Type a word to look up</div>
        <div class="empty-state__desc">Search for any English word to see its meaning and hear it spoken!</div>
      `;
    } else if (type === 'not-found') {
      div.innerHTML = `
        <div class="empty-state__icon">🤔</div>
        <div class="empty-state__title">Word not found</div>
        <div class="empty-state__desc">This word is not in the dictionary yet. Try another word!</div>
      `;
    } else if (type === 'no-favorites') {
      div.innerHTML = `
        <div class="empty-state__icon">⭐</div>
        <div class="empty-state__title">No favorites yet</div>
        <div class="empty-state__desc">Tap the ☆ button on any word to save it here!</div>
      `;
    } else if (type === 'welcome') {
      div.innerHTML = `
        <div class="empty-state__icon">📚</div>
        <div class="empty-state__title">Welcome, Yvonne! 🌟</div>
        <div class="empty-state__desc">Type a word to look it up, or switch to "Browse" to see all words!</div>
      `;
    }

    return div;
  }

  // ── Update speak button state ──
  function setSpeakButtonActive(btn, active) {
    if (!btn) return;
    btn.classList.toggle('speaking', active);

    // Remove old wave if exists
    const oldWave = btn.querySelector('.sound-wave');
    if (oldWave) oldWave.remove();

    if (active) {
      btn.appendChild(createSoundWave());
    }
  }

  // ── Helper: escape HTML ──
  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ── Helper: escape attribute ──
  function escapeAttr(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
              .replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // ── Smooth scroll to element ──
  function scrollTo(el) {
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return {
    renderWordCard,
    renderWordTile,
    renderEmptyState,
    setSpeakButtonActive,
    scrollTo,
    escapeHtml,
    escapeAttr
  };
})();
