(() => {
  'use strict';
  const API_BASE = 'https://zcv9k3zonf.execute-api.ap-south-1.amazonaws.com/Def';
  const DRAFT_KEY = 'notes-for-you:draft';
  const $ = (id) => document.getElementById(id);

  const stages = {
    open:   $('stage-open'),
    q:      $('stage-q'),
    review: $('stage-review'),
    done:   $('stage-done')
  };

  let questions = [];
  let answers   = {};
  let index     = 0;
  let startedAt = Date.now();

  function show(name) {
    Object.keys(stages).forEach((key) => {
      stages[key].style.display = key === name ? '' : 'none';
    });
    window.scrollTo(0, 0);
  }

  function saveDraft() {
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ answers, index })); } catch {}
  }
  function clearDraft() {
    try { localStorage.removeItem(DRAFT_KEY); } catch {}
  }
  function loadDraft() {
    try {
      const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
      return d && d.answers ? d : null;
    } catch { return null; }
  }

  function wordCount(t) {
    return t.trim() ? t.trim().split(/\s+/).length : 0;
  }

  function buildTrack() {
    const track = $('track');
    track.innerHTML = '';
    questions.forEach(() => track.appendChild(document.createElement('span')));
  }

  function paintTrack() {
    const marks = $('track').children;
    for (let i = 0; i < marks.length; i++) {
      marks[i].className = i < index ? 'done' : i === index ? 'here' : '';
    }
  }

  function renderQuestion() {
    const q     = questions[index];
    const field = $('q-field');

    $('q-count').textContent  = `${index + 1} of ${questions.length}`;
    $('q-prompt').textContent = q.prompt;

    const hintEl = $('q-hint');
    if (q.hint) { hintEl.textContent = q.hint; hintEl.style.display = ''; }
    else { hintEl.style.display = 'none'; }

    const warnEl = $('q-warn');
    warnEl.style.display = 'none';
    warnEl.textContent   = '';

    $('back').disabled    = index === 0;
    $('next').textContent = index === questions.length - 1 ? 'Review' : 'Next';
    field.innerHTML = '';

    if (q.type === 'text') {
      const box = document.createElement('textarea');
      box.id          = 'q-textarea';
      box.rows        = q.short ? 2 : 4;
      box.placeholder = q.placeholder || '';
      box.value       = answers[q.id] || '';
      box.setAttribute('aria-label', q.prompt);
      box.style.cssText = 'width:100%;background:transparent;border:0;border-bottom:1px solid rgba(255,143,163,.18);color:#f5e6e8;font:inherit;line-height:1.75;padding:.35rem 0 .7rem;resize:none;outline:none;';
      const words = document.createElement('p');
      words.className = 'words';
      const sync = () => {
        box.style.height = 'auto';
        box.style.height = Math.max(box.scrollHeight, 48) + 'px';
        const n = wordCount(box.value);
        words.textContent = n === 0 ? '' : `${n} word${n === 1 ? '' : 's'}`;
        answers[q.id] = box.value;
        saveDraft();
      };
      box.addEventListener('input', sync);
      box.addEventListener('focus', () => { box.style.borderBottomColor = '#ff8fa3'; });
      box.addEventListener('blur',  () => { box.style.borderBottomColor = 'rgba(255,143,163,.18)'; });
      field.append(box, words);
      sync();
      setTimeout(() => box.focus(), 60);
    }

    if (q.type === 'choice') {
      const wrap = document.createElement('div');
      wrap.className = 'choices';
      q.options.forEach((opt) => {
        const label = document.createElement('label');
        label.className = 'choice';
        const radio = document.createElement('input');
        radio.type    = 'radio';
        radio.name    = q.id;
        radio.value   = opt;
        radio.checked = answers[q.id] === opt;
        radio.addEventListener('change', () => { answers[q.id] = opt; saveDraft(); });
        const span = document.createElement('span');
        span.textContent = opt;
        label.append(radio, span);
        wrap.appendChild(label);
      });
      field.appendChild(wrap);
    }

    if (q.type === 'scale') {
      const wrap  = document.createElement('div');
      wrap.className = 'scale';
      const valEl = document.createElement('p');
      valEl.className = 'scale-value';
      const range = document.createElement('input');
      range.type  = 'range'; range.min = '1'; range.max = '10'; range.step = '1';
      range.value = String(answers[q.id] ?? q.defaultValue ?? 5);
      range.setAttribute('aria-label', q.prompt);
      const ends = document.createElement('div');
      ends.className = 'scale-ends';
      const lo = document.createElement('span'); lo.textContent = q.low  || '1';
      const hi = document.createElement('span'); hi.textContent = q.high || '10';
      ends.append(lo, hi);
      const sync = () => { valEl.textContent = range.value; answers[q.id] = Number(range.value); saveDraft(); };
      range.addEventListener('input', sync);
      wrap.append(valEl, range, ends);
      field.appendChild(wrap);
      sync();
    }

    paintTrack();
  }

  function validate() {
    const q = questions[index];
    if (q.type === 'text' && q.minWords) {
      const n = wordCount(answers[q.id] || '');
      if (n < q.minWords) {
        const w = $('q-warn');
        w.textContent   = `This one matters. Give it at least ${q.minWords} words.`;
        w.style.display = '';
        const box = document.getElementById('q-textarea');
        if (box) box.focus();
        return false;
      }
    }
    return true;
  }

  function goNext() {
    if (!validate()) return;
    if (index === questions.length - 1) { renderReview(); show('review'); return; }
    index += 1; saveDraft(); renderQuestion();
  }

  function goBack() {
    if (index === 0) return;
    index -= 1; saveDraft(); renderQuestion();
  }

  function renderReview() {
    const list = $('review-list');
    list.innerHTML = '';
    questions.forEach((q) => {
      const row = document.createElement('div');
      const dt  = document.createElement('dt'); dt.textContent = q.prompt;
      const dd  = document.createElement('dd');
      const v   = answers[q.id];
      dd.textContent = (v === undefined || v === '') ? '' : String(v);
      row.append(dt, dd); list.appendChild(row);
    });
  }

  async function send() {
    const btn   = $('send');
    const error = $('send-error');
    btn.disabled = true; btn.textContent = 'Sending…'; error.style.display = 'none';
    try {
      const res = await fetch(`${API_BASE}/answers`, {
        method: 'POST', mode: 'cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers, durationSeconds: Math.round((Date.now() - startedAt) / 1000) })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Server refused. Try again.');
      clearDraft(); show('done');
    } catch (err) {
      error.textContent   = err.message + ' — Nothing was lost, press send again.';
      error.style.display = '';
      btn.disabled = false; btn.textContent = 'Send it to him';
    }
  }

  $('begin').addEventListener('click', () => { startedAt = Date.now(); show('q'); renderQuestion(); });
  $('next').addEventListener('click', goNext);
  $('back').addEventListener('click', goBack);
  $('edit').addEventListener('click', () => { index = 0; show('q'); renderQuestion(); });
  $('send').addEventListener('click', send);

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && stages.q.style.display !== 'none') {
      e.preventDefault(); goNext();
    }
  });

  /* ---- hardcoded questions — works without Lambda ---- */
  questions = [
    { id: 'love',            type: 'text',   prompt: 'What do you love about me?',                           hint: 'The small stuff counts. Especially the small stuff.', placeholder: 'The way you...', minWords: 3 },
    { id: 'hate',            type: 'text',   prompt: 'What do you hate about me?',                           hint: 'Be honest. I promise not to sulk. (Much.)',           placeholder: 'Honestly, when you...', minWords: 3 },
    { id: 'firstThought',    type: 'text',   prompt: 'What did you actually think of me the first time we met?', hint: 'The unedited version, please.',                  placeholder: 'I thought...' },
    { id: 'annoyance',       type: 'scale',  prompt: 'On a normal day, how much do I annoy you?',            low: 'Not at all', high: 'Constantly', defaultValue: 4 },
    { id: 'changeOne',       type: 'text',   prompt: 'If you could change one thing about me, what would it be?', hint: 'One thing only.',                              placeholder: 'I would change...' },
    { id: 'favouriteMemory', type: 'text',   prompt: 'Which memory of us do you replay the most?',           placeholder: 'That day when...' },
    { id: 'loveLanguage',    type: 'choice', prompt: 'What makes you feel most loved by me?',                options: ['When you tell me', 'When you show up and do things', 'Time where nothing else is competing', 'Being close, physically', 'Small surprises out of nowhere'] },
    { id: 'wish',            type: 'text',   prompt: 'What do you want from me that you have never asked for?', hint: 'This is the one I most want answered.',           placeholder: 'I wish you would...' },
    { id: 'from',            type: 'text',   prompt: 'Sign off however you like.',                           hint: 'A name, a nickname, an insult. Your call.',          placeholder: 'Yours, ...', short: true }
  ];

  buildTrack();
  const draft = loadDraft();
  if (draft) {
    answers = draft.answers;
    index   = Math.min(draft.index || 0, questions.length - 1);
    const n = $('draft-note');
    n.textContent  = 'You left an unfinished answer here. It has been kept.';
    n.style.display = '';
  }
})();
