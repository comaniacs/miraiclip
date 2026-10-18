/** Line icons (24×24, currentColor) — the Capture extension's set, so both recorders match. */
const svg = (body: string, fill = false) =>
  `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" ${fill ? 'fill="currentColor"' : 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"'}>${body}</svg>`;

export const icons = {
  camera: svg('<rect x="2.5" y="6.5" width="13" height="11" rx="2.5"/><path d="M15.5 10.5l5-3v9l-5-3z"/>'),
  mic: svg('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>'),
  micOff: svg('<path d="M15 10V6a3 3 0 0 0-5.7-1.3M9 9v2a3 3 0 0 0 4.6 2.5M5.5 11a6.5 6.5 0 0 0 10.4 5.2M18.5 11c0 .7-.1 1.4-.3 2M12 17.5V21M3 3l18 18"/>'),
  pause: svg('<rect x="6.5" y="5" width="3.5" height="14" rx="1"/><rect x="14" y="5" width="3.5" height="14" rx="1"/>', true),
  play: svg('<path d="M8 5.5v13a1 1 0 0 0 1.5.9l10-6.5a1 1 0 0 0 0-1.7l-10-6.6A1 1 0 0 0 8 5.5z"/>', true),
  flag: svg('<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>'),
  trash: svg('<path d="M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13M10 11v5.5M14 11v5.5"/>'),
  stop: svg('<rect x="6" y="6" width="12" height="12" rx="2.5"/>', true),
};
