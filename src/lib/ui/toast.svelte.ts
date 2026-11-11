// One short message at the bottom of the screen (errors from the server, "Skopiowane").
export const toast = $state({ text: '', kind: 'info' as 'info' | 'error', id: 0 });

export function showToast(text: string, kind: 'info' | 'error' = 'info'): void {
  toast.text = text;
  toast.kind = kind;
  const id = ++toast.id;
  setTimeout(() => {
    if (toast.id === id) toast.text = '';
  }, 4000);
}
