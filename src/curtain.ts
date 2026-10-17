/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

let curtainEl: HTMLElement | null = null;

function getCurtain(): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  if (!curtainEl) {
    curtainEl = document.getElementById('screenCurtain');
    if (!curtainEl) {
      curtainEl = document.createElement('div');
      curtainEl.id = 'screenCurtain';
      curtainEl.className = 'curtainActive';
      document.body.prepend(curtainEl);
    }
  }
  return curtainEl;
}

/**
 * Fades the black curtain in (to black) or out (to reveal the map / screen).
 * @param toBlack if true, fade into black; if false, fade out from black to reveal content
 * @param durationMs transition duration in ms (default 850)
 */
export function fadeCurtain(toBlack: boolean, durationMs = 850): Promise<void> {
  const el = getCurtain();
  if (!el) return Promise.resolve();

  return new Promise((resolve) => {
    el.classList.remove('curtainHidden');
    el.style.transition = `opacity ${durationMs}ms cubic-bezier(0.22, 1, 0.36, 1)`;
    // Force DOM reflow so transition triggers reliably
    void el.offsetHeight;

    if (toBlack) {
      el.classList.add('curtainActive');
      window.setTimeout(() => resolve(), durationMs);
    } else {
      el.classList.remove('curtainActive');
      window.setTimeout(() => {
        if (!el.classList.contains('curtainActive')) {
          el.classList.add('curtainHidden');
        }
        resolve();
      }, durationMs);
    }
  });
}

/** Instantly makes the curtain dark without transition (e.g. before loading starts) */
export function setCurtainDark(): void {
  const el = getCurtain();
  if (!el) return;
  el.style.transition = 'none';
  el.classList.remove('curtainHidden');
  el.classList.add('curtainActive');
  void el.offsetHeight;
  el.style.transition = '';
}
