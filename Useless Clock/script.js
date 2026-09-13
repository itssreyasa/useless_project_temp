'use strict';

/* ==========================================================================
   THE USELESS CLOCK — script.js
   Sections:
   1. Utilities & reduced-motion check
   2. Particle background
   3. Cinematic intro sequence
   4. Scroll reveal (IntersectionObserver)
   5. Navigation between menu / clock view / alarm view
   6. Tick marks generation
   7. Wrong-time engine (the heart of the joke)
   8. Clock rendering loop (requestAnimationFrame)
   9. Crown + arrow interaction (clock view)
   10. Reset Time button
   11. Alarm view: crown-driven time picker
   12. Useless alarm scheduling + Web Audio alarm tone
   13. Modals
   ========================================================================== */

(function () {

  /* ---------------- 1. Utilities ---------------- */

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function pad(n) {
    return String(n).padStart(2, '0');
  }

  function formatTime(date) {
    let h = date.getHours();
    const m = date.getMinutes();
    const s = date.getSeconds();
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    if (h === 0) h = 12;
    return `${pad(h)}:${pad(m)}:${pad(s)} ${ampm}`;
  }

  function formatTimeShort(date) {
    let h = date.getHours();
    const m = date.getMinutes();
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    if (h === 0) h = 12;
    return `${h}:${pad(m)} ${ampm}`;
  }

  /** Current actual Indian Standard Time (IST = UTC+5:30), independent of the visitor's own timezone. */
  function getActualISTDate() {
    const now = new Date();
    const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
    const istMs = utcMs + 5.5 * 60 * 60000;
    return new Date(istMs);
  }

  /* ---------------- 2. Particle background ---------------- */

  function initParticles() {
    const canvas = $('#particle-canvas');
    if (!canvas || prefersReducedMotion) return;
    const ctx = canvas.getContext('2d');
    let w, h, particles;

    function resize() {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
    }

    function makeParticles() {
      const count = Math.min(60, Math.floor((w * h) / 28000));
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 1.6 + 0.4,
        vy: -(Math.random() * 0.18 + 0.04),
        vx: (Math.random() - 0.5) * 0.06,
        a: Math.random() * 0.5 + 0.15
      }));
    }

    function tick() {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = '#A78BFA';
      particles.forEach(p => {
        p.y += p.vy;
        p.x += p.vx;
        if (p.y < -10) { p.y = h + 10; p.x = Math.random() * w; }
        ctx.globalAlpha = p.a;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;
      requestAnimationFrame(tick);
    }

    resize();
    makeParticles();
    tick();
    window.addEventListener('resize', () => { resize(); makeParticles(); });
  }

  /* ---------------- 3. Cinematic intro ---------------- */

  function initIntro() {
    const intro = $('#intro');
    const lines = $$('.intro-line', intro);
    const skipBtn = $('#skip-intro');

    function hideIntro() {
      intro.classList.add('intro-hidden');
      document.body.classList.remove('lock-scroll');
    }

    if (prefersReducedMotion) {
      lines.forEach(l => l.classList.add('show'));
      setTimeout(hideIntro, 900);
      skipBtn.addEventListener('click', hideIntro);
      return;
    }

    document.body.classList.add('lock-scroll');

    const timeline = [
      { line: lines[0], showAt: 300 },
      { line: lines[1], showAt: 1500 },
      { line: lines[2], showAt: 3000 }
    ];

    timeline.forEach(({ line, showAt }) => {
      setTimeout(() => line.classList.add('show'), showAt);
    });

    // Auto-dismiss into the scrollable page after the sequence completes,
    // but let the user keep reading — just unlock scroll so they can proceed.
    setTimeout(() => {
      document.body.classList.remove('lock-scroll');
    }, 4600);

    skipBtn.addEventListener('click', hideIntro);

    // Once the user scrolls past the intro, fade it out.
    window.addEventListener('scroll', () => {
      if (window.scrollY > window.innerHeight * 0.4) hideIntro();
    }, { passive: true });
  }

  /* ---------------- 4. Scroll reveal ---------------- */

  function initScrollReveal() {
    const targets = $$('.reveal-text');
    if (!('IntersectionObserver' in window) || prefersReducedMotion) {
      targets.forEach(t => t.classList.add('in-view'));
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
        }
      });
    }, { threshold: 0.25 });
    targets.forEach(t => observer.observe(t));
  }

  /* ---------------- 5. Navigation ---------------- */

  function initNavigation() {
    const clockView = $('#view-clock');
    const alarmView = $('#view-alarm');

    function openView(view) {
      document.body.classList.add('lock-scroll');
      view.hidden = false;
      requestAnimationFrame(() => view.classList.add('active'));
    }

    function closeView(view) {
      view.classList.remove('active');
      document.body.classList.remove('lock-scroll');
      setTimeout(() => { view.hidden = true; }, 620);
    }

    $('#btn-see-time').addEventListener('click', () => openView(clockView));
    $('#btn-set-alarm').addEventListener('click', () => openView(alarmView));

    $$('[data-back]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const view = e.currentTarget.closest('.app-view');
        closeView(view);
      });
    });
  }

  /* ---------------- 6. Tick marks ---------------- */

  function buildTicks(container) {
    if (!container || container.children.length) return;
    const frag = document.createDocumentFragment();
    for (let i = 0; i < 60; i++) {
      const tick = document.createElement('div');
      const isMajor = i % 5 === 0;
      tick.className = 'tick' + (isMajor ? ' major' : '');
      tick.style.transform = `translate(-50%, 0) rotate(${i * 6}deg)`;
      frag.appendChild(tick);
    }
    container.appendChild(frag);
  }

  /* ---------------- 7. Wrong-time engine ---------------- */

  /**
   * The core joke: the clock always runs a simulated time that is offset
   * from real IST by a randomly generated, deliberately significant amount.
   * We track only the offset (in milliseconds); the simulated time is always
   * derived as (actual IST "now") + offset, so it keeps advancing naturally.
   */
  const WrongTimeEngine = (function () {
    let offsetMs = 0;

    // When the user is mid-adjustment (hour/minute crown+arrows), the
    // second/millisecond field is "frozen" to whatever it was the instant
    // adjustment began. Without this, each nudge re-derives "now" from the
    // real, still-advancing wall clock and re-stamps that live second value
    // onto the target time — which silently drags the (visually paused)
    // second hand forward a little on every press. Freezing it here means
    // every nudge during the same adjustment session reuses the exact same
    // second/ms, so the second hand truly does not move as a side effect.
    let frozenSeconds = null;
    let frozenMs = 0;

    function freezeSecondsField() {
      if (frozenSeconds === null) {
        const current = getSimulatedDate();
        frozenSeconds = current.getSeconds();
        frozenMs = current.getMilliseconds();
      }
    }

    function unfreezeSecondsField() {
      frozenSeconds = null;
      frozenMs = 0;
    }

    function randomSignificantOffsetMs() {
      // 1 to 5 hours, random direction. Guarantees the offset is never
      // trivially close to zero, so the displayed time is never "accidentally"
      // correct.
      const hours = randInt(1, 5);
      const minutesJitter = randInt(0, 59);
      const magnitude = hours * 60 * 60000 + minutesJitter * 60000;
      const sign = Math.random() < 0.5 ? -1 : 1;
      return sign * magnitude;
    }

    function reroll() {
      offsetMs = randomSignificantOffsetMs();
      return offsetMs;
    }

    function getOffsetMs() {
      return offsetMs;
    }

    function setOffsetMs(ms) {
      offsetMs = ms;
    }

    function nudgeMinutes(deltaMinutes) {
      offsetMs += deltaMinutes * 60000;
    }

    function getSimulatedDate() {
      const actualIst = getActualISTDate();
      return new Date(actualIst.getTime() + offsetMs);
    }

    /**
     * Adjusts ONLY the minute field of the current simulated time, wrapping
     * within the same hour (0-59) so the hour hand never moves as a side
     * effect. Recomputes offsetMs from the resulting target time so the
     * clock keeps ticking normally from the new position afterward.
     */
    function nudgeMinuteOnly(deltaMinutes) {
      const current = getSimulatedDate();
      const target = new Date(current);
      const newMinute = ((current.getMinutes() + deltaMinutes) % 60 + 60) % 60;
      target.setMinutes(newMinute);
      target.setSeconds(frozenSeconds !== null ? frozenSeconds : current.getSeconds());
      target.setMilliseconds(frozenSeconds !== null ? frozenMs : current.getMilliseconds());
      const actualIst = getActualISTDate();
      offsetMs = target.getTime() - actualIst.getTime();
    }

    /**
     * Adjusts ONLY the hour field of the current simulated time, wrapping
     * within 0-23, leaving minutes/seconds untouched.
     */
    function nudgeHourOnly(deltaHours) {
      const current = getSimulatedDate();
      const target = new Date(current);
      const newHour = ((current.getHours() + deltaHours) % 24 + 24) % 24;
      target.setHours(newHour);
      target.setMinutes(current.getMinutes());
      target.setSeconds(frozenSeconds !== null ? frozenSeconds : current.getSeconds());
      target.setMilliseconds(frozenSeconds !== null ? frozenMs : current.getMilliseconds());
      const actualIst = getActualISTDate();
      offsetMs = target.getTime() - actualIst.getTime();
    }

    // Initialize immediately on load.
    reroll();

    return {
      reroll, getOffsetMs, setOffsetMs, nudgeMinutes, nudgeMinuteOnly, nudgeHourOnly,
      getSimulatedDate, freezeSecondsField, unfreezeSecondsField
    };
  })();

  /* ---------------- 8. Clock rendering loop ---------------- */

  const ClockRenderer = (function () {
    const hourHand = () => $('#hour-hand');
    const minuteHand = () => $('#minute-hand');
    const secondHand = () => $('#second-hand');
    const readout = () => $('#digital-readout');
    const driftStat = () => $('#stat-drift');

    let raf = null;

    // Draws a single frame from whatever WrongTimeEngine currently reports.
    // Used both by the running rAF loop and by one-off "freeze here" redraws.
    function draw() {
      const t = WrongTimeEngine.getSimulatedDate();
      const h = t.getHours() % 12;
      const m = t.getMinutes();
      const s = t.getSeconds();
      const ms = t.getMilliseconds();

      const secDeg = (s + ms / 1000) * 6;
      const minDeg = (m + s / 60) * 6;
      const hourDeg = (h + m / 60) * 30;

      const hh = hourHand(), mh = minuteHand(), sh = secondHand();
      if (hh) hh.style.transform = `translateX(-50%) rotate(${hourDeg}deg)`;
      if (mh) mh.style.transform = `translateX(-50%) rotate(${minDeg}deg)`;
      if (sh) sh.style.transform = `translateX(-50%) rotate(${secDeg}deg)`;

      const rd = readout();
      if (rd) rd.textContent = formatTime(t);

      const ds = driftStat();
      if (ds) {
        const offsetH = WrongTimeEngine.getOffsetMs() / 3600000;
        const sign = offsetH >= 0 ? '+' : '-';
        ds.textContent = `${sign}${Math.abs(offsetH).toFixed(1)}h`;
      }
    }

    function render() {
      draw();
      raf = requestAnimationFrame(render);
    }

    function start() {
      if (raf) cancelAnimationFrame(raf);
      render();
    }

    function stop() {
      if (raf) cancelAnimationFrame(raf);
      raf = null;
    }

    function isRunning() {
      return raf !== null;
    }

    return { start, stop, isRunning, renderOnce: draw };
  })();

  /* ---------------- 9. Crown + arrows (clock view) ---------------- */

  /**
   * The clock-view crown cycles through three adjustment modes on each
   * click: normal -> minutes -> hours -> normal. Whichever hand is "active"
   * is the only one the arrows affect; the other hand holds its position.
   */
  function initClockCrown() {
    const crown = $('#crown-clock');
    const arrows = $('#crown-arrows-clock');
    const badge = $('#mode-badge-clock');
    const resetBtn = $('#reset-time-btn');
    const MODES = ['normal', 'minutes', 'hours'];
    let modeIndex = 0;

    function applyMode() {
      const mode = MODES[modeIndex];
      const active = mode !== 'normal';

      crown.setAttribute('aria-pressed', String(active));
      arrows.hidden = !active;
      // The Reset Time button only makes sense once the user has actually
      // opened the crown to adjust something — keep it hidden until then.
      resetBtn.hidden = !active;

      if (mode === 'minutes') {
        badge.hidden = false;
        badge.textContent = 'MINUTE MODE';
        badge.classList.remove('mode-hours');
      } else if (mode === 'hours') {
        badge.hidden = false;
        badge.textContent = 'HOUR MODE';
        badge.classList.add('mode-hours');
      } else {
        badge.hidden = true;
      }

      $$('.arrow-btn', arrows).forEach(btn => {
        const dir = btn.dataset.dir;
        const label = mode === 'hours'
          ? (dir === 'up' ? 'Adjust hour anti-clockwise' : 'Adjust hour clockwise')
          : (dir === 'up' ? 'Adjust minutes anti-clockwise' : 'Adjust minutes clockwise');
        btn.setAttribute('aria-label', label);
      });
    }

    crown.addEventListener('click', () => {
      modeIndex = (modeIndex + 1) % MODES.length;
      applyMode();
    });

    $$('.arrow-btn', arrows).forEach(btn => {
      btn.addEventListener('click', () => {
        crown.classList.remove('adjusting');
        void crown.offsetWidth; // restart animation
        crown.classList.add('adjusting');

        const dir = btn.dataset.dir;
        const mode = MODES[modeIndex];
        // Per spec: ↑ moves the active hand anti-clockwise (time back),
        // ↓ moves it clockwise (time forward) — applied to whichever
        // field (minute or hour) is currently active, leaving the other
        // field untouched.
        const delta = dir === 'up' ? -1 : 1;

        // Freeze the second hand's position at the moment adjustment
        // begins (only matters the first press, while the clock is still
        // running) so repeated presses can't drag it forward via the
        // real, still-ticking wall clock.
        if (ClockRenderer.isRunning()) {
          WrongTimeEngine.freezeSecondsField();
        }

        if (mode === 'hours') {
          WrongTimeEngine.nudgeHourOnly(delta);
        } else {
          WrongTimeEngine.nudgeMinuteOnly(delta);
        }

        // The user just manually set the time: stop the live tick (cancels
        // the rAF loop so nothing keeps overwriting the hands/readout) and
        // draw exactly one frame so the clock visibly holds the new value.
        ClockRenderer.stop();
        ClockRenderer.renderOnce();

        // A short, subtle confirmation click — reuses the alarm system's
        // existing Web Audio setup rather than spinning up a second one.
        AlarmSystem.playTick();
      });
    });

    applyMode();

    // Fully closes the adjustment UI: hides the arrows, the mode badge,
    // and the Reset Time button, and returns the crown to its resting
    // ("normal") state — used after Reset Time is pressed so the up/down
    // arrows disappear again rather than staying open.
    function closeAdjustment() {
      modeIndex = 0;
      applyMode();
    }

    return { closeAdjustment };
  }

  /* ---------------- 10. Reset Time button ---------------- */

  function initResetButton(clockCrown) {
    const btn = $('#reset-time-btn');
    const msg = $('#reset-msg');
    const face = $('#clock-face');

    btn.addEventListener('click', () => {
      // The user may have painstakingly adjusted the clock. We do not
      // preserve their selection — a fresh, significant wrong offset is
      // generated instead, and the hands animate to reflect it.
      WrongTimeEngine.unfreezeSecondsField();
      WrongTimeEngine.reroll();

      // If a manual adjustment had stopped the live tick, resetting brings
      // the clock back to its normal, continuously-ticking state.
      if (!ClockRenderer.isRunning()) {
        ClockRenderer.start();
      }

      // Close the adjustment UI back up: arrows, mode badge, and this
      // Reset button itself all disappear again until the crown is
      // clicked once more.
      clockCrown.closeAdjustment();

      if (!prefersReducedMotion) {
        face.animate(
          [{ filter: 'brightness(1)' }, { filter: 'brightness(1.6)' }, { filter: 'brightness(1)' }],
          { duration: 500, easing: 'ease-out' }
        );
      }

      msg.textContent = 'Time successfully corrected.';
      msg.classList.add('show');
      setTimeout(() => msg.classList.remove('show'), 2600);
    });
  }

  /* ---------------- 11. Alarm view: crown-driven time picker ---------------- */

  const AlarmPicker = (function () {
    // The user's *intended* alarm selection, purely for display while picking.
    let intendedDate = new Date();
    intendedDate.setHours(7, 0, 0, 0);

    // Continuous (unbounded) rotation accumulators, tracked separately from
    // the wrapping hour/minute values on intendedDate. If each render
    // instead recomputed the hand angle fresh from getHours()/getMinutes(),
    // it would snap back into a 0-359deg range on every wraparound (11 -> 12,
    // or 59 -> 0). Since the alarm hands animate via a CSS transition, that
    // snap makes the hand spin almost a full circle the "wrong" way instead
    // of taking one small step forward. Accumulating instead means the
    // value just keeps climbing (or falling) past 360deg/0deg, so the CSS
    // transition always turns the same direction the arrow was pressed.
    let hourDegAccum = (intendedDate.getHours() % 12 + intendedDate.getMinutes() / 60) * 30;
    let minDegAccum = intendedDate.getMinutes() * 6;

    function render() {
      const hh = $('#alarm-hour-hand');
      const mh = $('#alarm-minute-hand');
      if (hh) hh.style.transform = `translateX(-50%) rotate(${hourDegAccum}deg)`;
      if (mh) mh.style.transform = `translateX(-50%) rotate(${minDegAccum}deg)`;

      const readout = $('#alarm-readout');
      if (readout) readout.textContent = formatTimeShort(intendedDate);
    }

    function nudgeMinutes(delta) {
      intendedDate = new Date(intendedDate.getTime() + delta * 60000);
      // 1 minute = 6deg of minute-hand movement, and 0.5deg of matching
      // "drift" on the hour hand (60 minutes = 30deg) — added continuously
      // so neither hand ever has to jump back across the 0/360 boundary.
      minDegAccum += delta * 6;
      hourDegAccum += delta * 0.5;
      render();
    }

    /**
     * Adjusts ONLY the hour field, wrapping 0-23, leaving minutes
     * untouched — mirrors WrongTimeEngine.nudgeHourOnly (used by the
     * Clock view) so the hour hand moves a full, immediate increment per
     * press while still respecting whatever minute offset is already
     * dialed in, keeping the same hour/minute relationship the main
     * clock uses.
     */
    function nudgeHourOnly(delta) {
      const newHour = ((intendedDate.getHours() + delta) % 24 + 24) % 24;
      const next = new Date(intendedDate);
      next.setHours(newHour);
      intendedDate = next;
      // Only the hour field changes, so only the hour hand's continuous
      // accumulator moves — a full 30deg per hour, minute hand untouched.
      hourDegAccum += delta * 30;
      render();
    }

    function getIntendedDate() {
      return intendedDate;
    }

    return { render, nudgeMinutes, nudgeHourOnly, getIntendedDate };
  })();

  function initAlarmCrown() {
    const crown = $('#crown-alarm');
    const arrows = $('#crown-arrows-alarm');
    const badge = $('#mode-badge-alarm');
    const setAlarmBtn = $('#set-alarm-btn');
    // Same closed -> minutes -> hours cycle as the Clock view's crown, so
    // the hour hand can be moved directly instead of only drifting by
    // fractions of a degree through repeated minute nudges.
    const MODES = ['closed', 'minutes', 'hours'];
    let modeIndex = 0;

    function applyMode() {
      const mode = MODES[modeIndex];
      const active = mode !== 'closed';

      crown.setAttribute('aria-pressed', String(active));
      arrows.hidden = !active;
      // Set Alarm only appears once the user has opened the crown and
      // actually has a time dialed in to confirm.
      setAlarmBtn.hidden = !active;

      if (mode === 'minutes') {
        badge.hidden = false;
        badge.textContent = 'MINUTE MODE';
        badge.classList.remove('mode-hours');
      } else if (mode === 'hours') {
        badge.hidden = false;
        badge.textContent = 'HOUR MODE';
        badge.classList.add('mode-hours');
      } else {
        badge.hidden = true;
      }

      $$('.arrow-btn', arrows).forEach(btn => {
        const dir = btn.dataset.dir;
        const label = mode === 'hours'
          ? (dir === 'up' ? 'Adjust alarm hour anti-clockwise' : 'Adjust alarm hour clockwise')
          : (dir === 'up' ? 'Adjust alarm minutes anti-clockwise' : 'Adjust alarm minutes clockwise');
        btn.setAttribute('aria-label', label);
      });
    }

    crown.addEventListener('click', () => {
      modeIndex = (modeIndex + 1) % MODES.length;
      applyMode();
    });

    $$('.arrow-btn', arrows).forEach(btn => {
      btn.addEventListener('click', () => {
        crown.classList.remove('adjusting');
        void crown.offsetWidth;
        crown.classList.add('adjusting');

        const dir = btn.dataset.dir;
        const delta = dir === 'up' ? -1 : 1;
        const mode = MODES[modeIndex];
        if (mode === 'hours') {
          AlarmPicker.nudgeHourOnly(delta);
        } else {
          AlarmPicker.nudgeMinutes(delta);
        }

        // Same short confirmation click used by the Clock view's crown,
        // played once per change so the user gets audible feedback that
        // the alarm time was actually adjusted.
        AlarmSystem.playTick();
      });
    });

    applyMode();
    AlarmPicker.render();

    // Fully closes the adjustment UI: hides the arrows, the mode badge,
    // and the Set Alarm button, and returns the crown to its resting
    // ("closed") state — used after Set Alarm is pressed so the up/down
    // arrows disappear again rather than staying open.
    function closeAdjustment() {
      modeIndex = 0;
      applyMode();
    }

    return { closeAdjustment };
  }

  /* ---------------- 12. Useless alarm scheduling + Web Audio ---------------- */

  const AlarmSystem = (function () {
    let audioCtx = null;
    let toneInterval = null;
    let scheduledDate = null; // the *actual* (wrong) time the alarm will fire
    let checkInterval = null;

    function ensureAudioContext() {
      if (!audioCtx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        audioCtx = new AC();
      }
      if (audioCtx.state === 'suspended') audioCtx.resume();
      return audioCtx;
    }

    function playChime() {
      const ctx = ensureAudioContext();
      const now = ctx.currentTime;
      const freqs = [880, 1108.73]; // A5 + C#6, a clean two-tone chime

      freqs.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, now + i * 0.18);
        gain.gain.linearRampToValueAtTime(0.18, now + i * 0.18 + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.18 + 0.9);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now + i * 0.18);
        osc.stop(now + i * 0.18 + 1);
      });
    }

    /**
     * A short, subtle click used to confirm a manual time adjustment
     * (as opposed to the longer two-tone playChime used for the alarm
     * ringing). Reuses the same lazily-created AudioContext.
     */
    function playTick() {
      const ctx = ensureAudioContext();
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 1000;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.06, now + 0.004);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.1);
    }

    function startRinging() {
      playChime();
      toneInterval = setInterval(playChime, 1800);
    }

    function stopRinging() {
      if (toneInterval) clearInterval(toneInterval);
      toneInterval = null;
    }

    /**
     * Schedules the alarm relative to the *intended* time the user picked,
     * but deliberately offset by 30–120 minutes, direction randomized.
     */
    function scheduleFrom(intendedDate) {
      ensureAudioContext(); // must happen inside a user gesture

      const offsetMinutes = randInt(30, 120);
      const sign = Math.random() < 0.5 ? -1 : 1;
      let actualOffsetMinutes = sign * offsetMinutes;
      // Guard against an (extremely unlikely) zero offset.
      if (actualOffsetMinutes === 0) actualOffsetMinutes = 30;

      const wrongDate = new Date(intendedDate.getTime() + actualOffsetMinutes * 60000);

      // Anchor the fire time to actual elapsed time from "now" rather than
      // wall-clock date math, so it reliably fires while the tab stays open.
      const nowIst = getActualISTDate();
      let deltaMs = wrongDate.getTime() - nowIst.getTime();
      // Normalize into the next 24h window so a "past" wrong time still
      // schedules sensibly for "tomorrow".
      const DAY = 24 * 60 * 60000;
      deltaMs = ((deltaMs % DAY) + DAY) % DAY;
      if (deltaMs < 5000) deltaMs += DAY; // avoid an instant/degenerate fire

      scheduledDate = wrongDate;

      if (checkInterval) clearInterval(checkInterval);
      const fireAt = Date.now() + deltaMs;
      checkInterval = setInterval(() => {
        if (Date.now() >= fireAt) {
          clearInterval(checkInterval);
          checkInterval = null;
          onFire();
        }
      }, 1000);

      return wrongDate;
    }

    function onFire() {
      const modal = $('#ringing-modal');
      $('#ringing-time').textContent = formatTimeShort(scheduledDate);
      modal.hidden = false;
      requestAnimationFrame(() => modal.classList.add('show'));
      startRinging();
    }

    function dismiss() {
      stopRinging();
      const modal = $('#ringing-modal');
      modal.classList.remove('show');
      setTimeout(() => { modal.hidden = true; }, 350);
    }

    function getScheduledDate() {
      return scheduledDate;
    }

    return { scheduleFrom, dismiss, getScheduledDate, playTick };
  })();

  function initAlarmFlow(alarmCrown) {
    const setBtn = $('#set-alarm-btn');
    const modal = $('#alarm-modal');
    const modalTime = $('#modal-time');
    const closeBtn = $('#modal-close');
    const stateChip = $('#stat-alarm-state');
    const timeChip = $('#stat-alarm-time');

    setBtn.addEventListener('click', () => {
      const intended = AlarmPicker.getIntendedDate();
      const wrongDate = AlarmSystem.scheduleFrom(intended);

      modalTime.textContent = formatTimeShort(wrongDate);
      modal.hidden = false;
      requestAnimationFrame(() => modal.classList.add('show'));

      stateChip.textContent = 'Armed';
      timeChip.textContent = formatTimeShort(wrongDate);

      // Close the adjustment UI back up: arrows, mode badge, and the Set
      // Alarm button itself all disappear again until the crown is
      // clicked once more.
      alarmCrown.closeAdjustment();
    });

    closeBtn.addEventListener('click', () => {
      modal.classList.remove('show');
      setTimeout(() => { modal.hidden = true; }, 350);
    });

    $('#stop-alarm-btn').addEventListener('click', () => {
      AlarmSystem.dismiss();
      stateChip.textContent = 'Inactive';
    });
  }

  /* ---------------- Boot ---------------- */

  document.addEventListener('DOMContentLoaded', () => {
    buildTicks($('#ticks'));
    buildTicks($('#ticks-alarm'));

    initParticles();
    initIntro();
    initScrollReveal();
    initNavigation();

    const clockCrown = initClockCrown();
    initResetButton(clockCrown);

    const alarmCrown = initAlarmCrown();
    initAlarmFlow(alarmCrown);

    ClockRenderer.start();
  });

})();
