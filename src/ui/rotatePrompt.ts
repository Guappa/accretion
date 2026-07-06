// Black Hole is played in landscape on every device (the play field is constrained to the shorter axis); nudge touch users in portrait to rotate.
export function createRotatePrompt(): void {
  const prompt = document.createElement('div');
  prompt.id = 'rotate-prompt';
  prompt.classList.add('hidden');
  prompt.innerHTML = `
    <div class="rotate-inner">
      <div class="rotate-icon">&#128241;</div>
      <p class="rotate-title">Rotate your device</p>
      <p class="rotate-sub">Black Hole is played in landscape.</p>
    </div>
  `;
  document.body.append(prompt);

  const coarsePointer = window.matchMedia('(pointer: coarse)');
  const portrait = window.matchMedia('(orientation: portrait)');
  const update = (): void => {
    // Only nag on actual touch devices held in portrait - never on desktop.
    prompt.classList.toggle('hidden', !(coarsePointer.matches && portrait.matches));
  };
  coarsePointer.addEventListener('change', update);
  portrait.addEventListener('change', update);
  update();
}
