export async function writeClipboard(text: string): Promise<boolean> {
  if (!(window as any).isSecureContext || !navigator.clipboard?.writeText) {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      if (!ok) window.prompt('Copiar al portapapeles:', text);
      return ok;
    } catch {
      window.prompt('Copiar al portapapeles:', text);
      return false;
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    window.prompt('Copiar al portapapeles:', text);
    return false;
  }
}
