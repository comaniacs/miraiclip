/** Line icons for the recorder (24×24, drawn with currentColor). */
const svg = (body: string, fill = false) =>
  `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" ${fill ? 'fill="currentColor"' : 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"'}>${body}</svg>`;

export const icons = {
  screenCam: svg('<rect x="2.5" y="4" width="15" height="11" rx="2"/><path d="M7 19h6M10 15v4"/><circle cx="18" cy="16.5" r="3.5" fill="currentColor" stroke="none" opacity=".9"/>'),
  screen: svg('<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>'),
  camera: svg('<rect x="2.5" y="6.5" width="13" height="11" rx="2.5"/><path d="M15.5 10.5l5-3v9l-5-3z"/>'),
  monitor: svg('<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>'),
  window: svg('<rect x="3" y="4.5" width="18" height="15" rx="2"/><path d="M3 9h18"/><circle cx="6" cy="6.8" r=".6" fill="currentColor"/><circle cx="8.2" cy="6.8" r=".6" fill="currentColor"/>'),
  tab: svg('<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M5 7V5.5A1.5 1.5 0 0 1 6.5 4h5A1.5 1.5 0 0 1 13 5.5V7"/>'),
  mic: svg('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>'),
  micOff: svg('<path d="M15 10V6a3 3 0 0 0-5.7-1.3M9 9v2a3 3 0 0 0 4.6 2.5M5.5 11a6.5 6.5 0 0 0 10.4 5.2M18.5 11c0 .7-.1 1.4-.3 2M12 17.5V21M3 3l18 18"/>'),
  close: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
  pause: svg('<rect x="6.5" y="5" width="3.5" height="14" rx="1"/><rect x="14" y="5" width="3.5" height="14" rx="1"/>', true),
  play: svg('<path d="M8 5.5v13a1 1 0 0 0 1.5.9l10-6.5a1 1 0 0 0 0-1.7l-10-6.6A1 1 0 0 0 8 5.5z"/>', true),
  flag: svg('<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>'),
  restart: svg('<path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1M3.5 4v4.5H8"/>'),
  trash: svg('<path d="M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13M10 11v5.5M14 11v5.5"/>'),
  popout: svg('<rect x="3" y="5" width="18" height="14" rx="2"/><rect x="12" y="11" width="7" height="6" rx="1" fill="currentColor" stroke="none"/>'),
  library: svg('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M10 9.5v5l4-2.5z" fill="currentColor"/>'),
  draw: svg('<path d="M4 20l1.2-4.6L15.6 5a2.1 2.1 0 0 1 3 3L8.2 18.4z"/><path d="M13.5 7l3.5 3.5"/>'),
  pen: svg('<path d="M4 20l1.2-4.6L15.6 5a2.1 2.1 0 0 1 3 3L8.2 18.4z"/><path d="M13.5 7l3.5 3.5"/>'),
  highlighter: svg('<path d="M9 15l-4 4h5l2-2M9 15l7.5-9.5a2 2 0 0 1 3 2.6L11 17zM9 15l2 2"/><path d="M14 21h7"/>'),
  arrow: svg('<path d="M5 19L19 5M10 5h9v9"/>'),
  box: svg('<rect x="4" y="5" width="16" height="14" rx="3"/>'),
  fade: svg('<circle cx="12" cy="12" r="8.5" stroke-dasharray="3 2.6"/><path d="M12 7.5V12l3 2"/>'),
  undo: svg('<path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>'),
  eraser: svg('<path d="M8.5 20H20M4.6 15.6l9.9-9.9a2 2 0 0 1 2.8 0l2.5 2.5a2 2 0 0 1 0 2.8L12 18.8a4 4 0 0 1-2.8 1.2H8.4l-3.8-3.8a1 1 0 0 1 0-1.6z"/><path d="M9 11l5 5"/>'),
  chevron: svg('<path d="M9 6l6 6-6 6"/>'),
};
