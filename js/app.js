// config.js must load before this file — it sets window.API_BASE
(() => {
  'use strict';
  const API_BASE = 'https://xf5vzpgym7.execute-api.ap-south-1.amazonaws.com';
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

  /* ---- visibility ---- */
  function show(name) {
    Object.keys(stages).forEach((key) => {
      stages[key].style.display = key === name ? '' : 'none';
    });
    window.scrollTo(0, 0);
  }

  /* ---- draft ---- */
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

  /* ---- progress bar ---- */
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

  /* ---- render question ---- */
  function renderQuestion() {
    const q     = questions[index];
    const field = $('q-field');

    $('q-count').textContent  = `${index + 1} of ${questions.length}`;
    $('q-prompt').textContent = q.prompt;

    const hintEl = $('q-hint');
    if (q.hint) {
      hintEl.textContent    = q.hint;
      hintEl.style.display  = '';
    } else {
      hintEl.style.display  = 'none';
    }

    const warnEl = $('q-warn');
    warnEl.style.display  = 'none';
    warnEl.textContent    = '';

    $('back').disabled    = index === 0;
    $('next').textContent = index === questions.length - 1 ? 'Review' : 'Next';

    field.innerHTML = '';

    /* TEXT */
    if (q.type === 'text') {
      const box       = document.createElement('textarea');
      box.id          = 'q-textarea';
      box.rows        = q.short ? 2 : 4;
      box.placeholder = q.placeholder || '';
      box.value       = answers[q.id] || '';
      box.setAttribute('aria-label', q.prompt);
      box.style.cssText = [
        'width:100%', 'background:transparent', 'border:0',
        'border-bottom:1px solid rgba(233,228,217,.18)',
        'color:#e9e4d9', 'font:inherit', 'line-height:1.75',
        'padding:.35rem 0 .7rem', 'resize:none',
        'transition:border-color 200ms ease', 'outline:none'
      ].join(';');

      const words       = document.createElement('p');
      words.className   = 'words';

      const sync = () => {
        box.style.height = 'auto';
        box.style.height = Math.max(box.scrollHeight, 48) + 'px';
        const n = wordCount(box.value);
        words.textContent = n === 0 ? '' : `${n} word${n === 1 ? '' : 's'}`;
        answers[q.id] = box.value;
        saveDraft();
      };

      box.addEventListener('input', sync);
      box.addEventListener('focus', () => { box.style.borderBottomColor = '#f0b45f'; });
      box.addEventListener('blur',  () => { box.style.borderBottomColor = 'rgba(233,228,217,.18)'; });

      field.append(box, words);
      sync();
      setTimeout(() => box.focus(), 60);
    }

    /* CHOICE */
    if (q.type === 'choice') {
      const wrap    = document.createElement('div');
      wrap.className = 'choices';
      q.options.forEach((opt) => {
        const label   = document.createElement('label');
        label.className = 'choice';
        const radio   = document.createElement('input');
        radio.type    = 'radio';
        radio.name    = q.id;
        radio.value   = opt;
        radio.checked = answers[q.id] === opt;
        radio.addEventListener('change', () => { answers[q.id] = opt; saveDraft(); });
        const span    = document.createElement('span');
        span.textContent = opt;
        label.append(radio, span);
        wrap.appendChild(label);
      });
      field.appendChild(wrap);
    }

    /* SCALE */
    if (q.type === 'scale') {
      const wrap    = document.createElement('div');
      wrap.className = 'scale';

      const valEl   = document.createElement('p');
      valEl.className = 'scale-value';

      const range   = document.createElement('input');
      range.type    = 'range';
      range.min     = '1';
      range.max     = '10';
      range.step    = '1';
      range.value   = String(answers[q.id] ?? q.defaultValue ?? 5);
      range.setAttribute('aria-label', q.prompt);

      const ends    = document.createElement('div');
      ends.className = 'scale-ends';
      const lo      = document.createElement('span'); lo.textContent = q.low  || '1';
      const hi      = document.createElement('span'); hi.textContent = q.high || '10';
      ends.append(lo, hi);

      const sync = () => {
        valEl.textContent = range.value;
        answers[q.id]     = Number(range.value);
        saveDraft();
      };
      range.addEventListener('input', sync);
      wrap.append(valEl, range, ends);
      field.appendChild(wrap);
      sync();
    }

    paintTrack();
  }

  /* ---- validate ---- */
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

  /* ---- navigation ---- */
  function goNext() {
    if (!validate()) return;
    if (index === questions.length - 1) {
      renderReview();
      show('review');
      return;
    }
    index += 1;
    saveDraft();
    renderQuestion();
  }

  function goBack() {
    if (index === 0) return;
    index -= 1;
    saveDraft();
    renderQuestion();
  }

  /* ---- review ---- */
  function renderReview() {
    const list = $('review-list');
    list.innerHTML = '';
    questions.forEach((q) => {
      const row = document.createElement('div');
      const dt  = document.createElement('dt');
      dt.textContent = q.prompt;
      const dd  = document.createElement('dd');
      const v   = answers[q.id];
      dd.textContent = (v === undefined || v === '') ? '' : String(v);
      row.append(dt, dd);
      list.appendChild(row);
    });
  }

  /* ---- submit ---- */
  async function send() {
    const btn   = $('send');
    const error = $('send-error');
    btn.disabled        = true;
    btn.textContent     = 'Sending…';
    error.style.display = 'none';

    try {
      const res  = await fetch(`${API_BASE}/answers`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answers,
          durationSeconds: Math.round((Date.now() - startedAt) / 1000)
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Server refused. Try again.');
      clearDraft();
      show('done');
    } catch (err) {
      error.textContent   = err.message + ' — Nothing was lost, press send again.';
      error.style.display = '';
      btn.disabled        = false;
      btn.textContent     = 'Send it to him';
    }
  }

  /* ---- wire buttons ---- */
  $('begin').addEventListener('click', () => {
    startedAt = Date.now();
    show('q');
    renderQuestion();
  });
  $('next').addEventListener('click', goNext);
  $('back').addEventListener('click', goBack);
  $('edit').addEventListener('click', () => { index = 0; show('q'); renderQuestion(); });
  $('send').addEventListener('click', send);

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter'
        && stages.q.style.display !== 'none') {
      e.preventDefault();
      goNext();
    }
  });

  window.addEventListener('beforeunload', (e) => {
    const busy = stages.q.style.display !== 'none'
              || stages.review.style.display !== 'none';
    if (busy && Object.keys(answers).length) {
      e.preventDefault();
      e.returnValue = '';
    }
  });

  /* ---- bootstrap ---- */
  fetch(`${API_BASE}/questions`)
    .then((r) => r.json())
    .then((data) => {
      questions = data.questions;
      buildTrack();
      const draft = loadDraft();
      if (draft) {
        answers = draft.answers;
        index   = Math.min(draft.index || 0, questions.length - 1);
        const n = $('draft-note');
        n.textContent    = 'You left an unfinished answer here. It has been kept.';
        n.style.display  = '';
      }
    })
    .catch(() => {
      $('begin').disabled = true;
      const n = $('draft-note');
      n.textContent   = 'Could not load questions. Check your API URL in js/config.js and refresh.';
      n.style.display = '';
    });
})();
