/* ═══════════════════════════════════════════
   Stories Module
   ═══════════════════════════════════════════ */

const StoriesModule = (() => {
  let currentStory = null;
  let isReading = false;
  let currentReadingIndex = -1;

  function renderGrid(container) {
    container.innerHTML = '';
    const grid = document.createElement('div');
    grid.className = 'stories-grid';

    STORIES.forEach(story => {
      const card = document.createElement('div');
      card.className = 'story-card';
      const coverImg = story.images && story.images.length > 0 ? story.images[0] : (story.image || '');
      card.innerHTML = `
        <img class="story-card__img" src="${UI.escapeAttr(coverImg)}" alt="${UI.escapeAttr(story.title)}">
        <div class="story-card__content">
          <div class="story-card__level">${UI.escapeHtml(story.level)}</div>
          <div class="story-card__title">${UI.escapeHtml(story.title)}</div>
          <div class="story-card__tags">
            ${story.vocabulary.slice(0, 3).map(w => `<span class="story-tag">${UI.escapeHtml(w)}</span>`).join('')}
            ${story.vocabulary.length > 3 ? `<span class="story-tag">+${story.vocabulary.length - 3}</span>` : ''}
          </div>
        </div>
      `;
      card.addEventListener('click', () => openStory(story, container));
      grid.appendChild(card);
    });

    container.appendChild(grid);
  }

  function openStory(story, container) {
    currentStory = story;
    isReading = false;
    currentReadingIndex = -1;
    SpeechEngine.stop();

    container.innerHTML = '';

    const reader = document.createElement('div');
    reader.className = 'story-reader';

    // Header
    const header = document.createElement('div');
    header.className = 'story-reader__header';
    header.innerHTML = `
      <button class="story-btn-back" id="story-btn-back">⬅ Back to Stories</button>
      <div class="speed-control">
        <span class="speed-control__label">Speed:</span>
        <button class="speed-btn" data-speed="0.7">Slow</button>
        <button class="speed-btn active" data-speed="1">Normal</button>
      </div>
    `;

    // Content
    const content = document.createElement('div');
    content.className = 'story-reader__content';
    
    // Highlight vocabulary words function
    const highlightVocab = (text) => {
      let highlighted = text;
      // Sort by length descending to avoid partial matches
      const sortedVocab = [...story.vocabulary].sort((a,b) => b.length - a.length);
      const placeholders = [];
      
      sortedVocab.forEach(word => {
        const regex = new RegExp(`\\b(${word}s?|${word}ed|${word}ing)\\b`, 'gi');
        highlighted = highlighted.replace(regex, (match) => {
          placeholders.push(`<span class="story-vocab-word" data-word="${word}">${match}</span>`);
          return `__VOCAB_${placeholders.length - 1}__`;
        });
      });
      
      placeholders.forEach((html, index) => {
        const regex = new RegExp(`__VOCAB_${index}__`, 'g');
        highlighted = highlighted.replace(regex, html);
      });
      
      return highlighted;
    };

    // Build content with multiple images interleaved
    const coverImg = story.images && story.images.length > 0 ? story.images[0] : (story.image || '');
    
    let paragraphsHtml = '';
    story.content.forEach((p, i) => {
      paragraphsHtml += `<p class="story-paragraph" id="story-p-${i}">${highlightVocab(p)}</p>`;
      // Interleave additional images every 2-3 paragraphs if available
      if (story.images && story.images.length > 1) {
        // e.g. put the 2nd image after 2nd paragraph, 3rd after 4th
        const imgIndex = Math.floor((i + 1) / 2);
        if ((i + 1) % 2 === 0 && imgIndex < story.images.length) {
          paragraphsHtml += `<img class="story-reader__img-inline" src="${UI.escapeAttr(story.images[imgIndex])}" alt="Illustration" style="width:100%; border-radius:12px; margin: 20px 0; box-shadow: var(--shadow-sm);">`;
        }
      }
    });

    content.innerHTML = `
      <img class="story-reader__img" src="${UI.escapeAttr(coverImg)}" alt="${UI.escapeAttr(story.title)}">
      <h2 class="story-reader__title">${UI.escapeHtml(story.title)}</h2>
      <div class="story-reader__controls">
        <button class="speak-btn speak-btn--large" id="story-btn-read">🔊 Read Story</button>
      </div>
      <div class="story-reader__text" id="story-text-container">
        ${paragraphsHtml}
      </div>
    `;

    reader.appendChild(header);
    reader.appendChild(content);
    container.appendChild(reader);

    // Bind back button
    reader.querySelector('#story-btn-back').addEventListener('click', () => {
      SpeechEngine.stop();
      renderGrid(container);
    });

    // Speed controls
    const currentSpeed = SpeechEngine.getSpeed();
    reader.querySelectorAll('.speed-btn').forEach(btn => {
      btn.classList.toggle('active', parseFloat(btn.dataset.speed) === currentSpeed);
      btn.addEventListener('click', () => {
        const speed = parseFloat(btn.dataset.speed);
        SpeechEngine.setSpeed(speed);
        reader.querySelectorAll('.speed-btn').forEach(b => b.classList.toggle('active', parseFloat(b.dataset.speed) === speed));
      });
    });

    // Read button
    const readBtn = reader.querySelector('#story-btn-read');
    readBtn.addEventListener('click', () => {
      if (isReading) {
        // Stop
        isReading = false;
        SpeechEngine.stop();
        readBtn.innerHTML = '🔊 Read Story';
        readBtn.classList.remove('speaking');
        clearHighlights();
      } else {
        // Start
        isReading = true;
        readBtn.innerHTML = '⏸ Stop Reading';
        readBtn.classList.add('speaking');
        currentReadingIndex = 0;
        readNextParagraph();
      }
    });

    // Word clicks
    reader.querySelectorAll('.story-vocab-word').forEach(el => {
      el.addEventListener('click', () => {
        const word = el.dataset.word;
        const entry = VOCABULARY.find(w => w.word.toLowerCase() === word.toLowerCase());
        if (entry && window.App) {
          // Trigger modal from App
          window.App.openWordModal(entry);
        }
      });
    });
  }

  function clearHighlights() {
    document.querySelectorAll('.story-paragraph').forEach(p => p.classList.remove('active-reading'));
  }

  function readNextParagraph() {
    if (!isReading || !currentStory || currentReadingIndex >= currentStory.content.length) {
      isReading = false;
      const readBtn = document.querySelector('#story-btn-read');
      if (readBtn) {
        readBtn.innerHTML = '🔊 Read Story';
        readBtn.classList.remove('speaking');
      }
      clearHighlights();
      return;
    }

    clearHighlights();
    const pEl = document.getElementById(`story-p-${currentReadingIndex}`);
    if (pEl) {
      pEl.classList.add('active-reading');
      UI.scrollTo(pEl);
    }

    const textToRead = currentStory.content[currentReadingIndex];
    SpeechEngine.speak(textToRead, 'en', {
      onEnd: () => {
        if (isReading) {
          currentReadingIndex++;
          readNextParagraph();
        }
      }
    });
  }

  return {
    renderGrid
  };
})();
