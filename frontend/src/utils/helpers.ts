export function sanitizeHTML(text: string = ''): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export function sanitizeAvatarUrl(url: string | undefined): string {
  if (!url) {
    return '';
  }

  try {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      const parsed = new URL(url);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        return parsed.href;
      }
    } else if (url.startsWith('/')) {
      const cleanPath = url.split('?')[0];
      return cleanPath;
    }

    return '';
  } 
  catch (e) {
    return '';
  }
}

export function showValidationError(errorDiv: HTMLElement | null, message: string): void {
  if (errorDiv) {
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    errorDiv.style.color = '#ff4d4f';
  }
}

export function clearValidationError(errorDiv: HTMLElement | null): void {
  if (errorDiv) {
    errorDiv.textContent = '';
    errorDiv.style.display = 'none';
  }
}

export function initAvatarFallbacks(container: HTMLElement | Document = document): void {
  const avatarImages = container.querySelectorAll<HTMLImageElement>('img.avatar-with-fallback');
  avatarImages.forEach((img) => {
    if (img.dataset.fallbackInit) return;
    img.dataset.fallbackInit = 'true';

    img.addEventListener('error', () => {
      img.style.display = 'none';
      const fallback = img.nextElementSibling as HTMLElement;
      if (fallback?.classList.contains('avatar-fallback')) {
        fallback.style.display = 'flex';
      }
    });
  });
}
