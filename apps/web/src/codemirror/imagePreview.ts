import type { Extension } from '@codemirror/state';
import { RangeSetBuilder, StateField } from '@codemirror/state';
import { Decoration, EditorView, ViewPlugin, ViewUpdate, WidgetType } from '@codemirror/view';

type ImgRef = { alt: string; src: string };

// Simple sanitizer: allow http(s), safe data:image URLs, or relative paths; block javascript:/vbscript:/data: URIs
export function isSafeSrc(src: string): boolean {
  const trimmed = src.trim();
  const lower = trimmed.toLowerCase();

  // Block known dangerous schemes
  if (['javascript:', 'vbscript:'].some((scheme) => lower.startsWith(scheme))) return false;

  // For data: URLs, only allow specific safe image MIME types (no SVG)
  if (lower.startsWith('data:')) {
    const safeImageMimes = [
      'image/png',
      'image/jpeg',
      'image/jpg',
      'image/gif',
      'image/webp',
      'image/avif',
      'image/apng',
    ];
    return safeImageMimes.some(
      (mime) => lower.startsWith(`data:${mime};`) || lower.startsWith(`data:${mime},`)
    );
  }

  // Allow standard http(s) URLs
  if (['http://', 'https://'].some((scheme) => lower.startsWith(scheme))) return true;

  // Allow relative paths or same-origin paths
  return trimmed.startsWith('/') || !trimmed.includes('://');
}

class ImagesWidget extends WidgetType {
  constructor(private images: ImgRef[]) {
    super();
  }
  override eq(other: ImagesWidget) {
    if (this.images.length !== other.images.length) return false;
    for (let i = 0; i < this.images.length; i++) {
      const a = this.images[i],
        b = other.images[i];
      if (a.src !== b.src || a.alt !== b.alt) return false;
    }
    return true;
  }
  override toDOM() {
    const wrap = document.createElement('div');
    wrap.className = 'cm-image-preview';
    for (const imgref of this.images) {
      const img = document.createElement('img');
      img.loading = 'lazy';
      img.decoding = 'async';
      img.alt = imgref.alt || '';
      img.src = imgref.src;
      img.referrerPolicy = 'no-referrer';
      img.addEventListener('error', () => {
        img.style.display = 'none';
      });
      wrap.appendChild(img);
    }
    return wrap;
  }
  override ignoreEvent() {
    return false;
  }
}

function collectLineImages(text: string, maxPerLine = 3): ImgRef[] {
  const results: ImgRef[] = [];
  // Markdown image: ![alt](url)
  const mdImg = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
  let m: RegExpExecArray | null;
  while ((m = mdImg.exec(text)) && results.length < maxPerLine) {
    const alt = (m[1] || '').trim();
    const src = (m[2] || '').trim();
    if (isSafeSrc(src)) results.push({ alt, src });
  }
  // Basic HTML <img src="..."> support
  const htmlImg = /<img\s+[^>]*src=["']([^"']+)["'][^>]*>/gi;
  while ((m = htmlImg.exec(text)) && results.length < maxPerLine) {
    const src = (m[1] || '').trim();
    if (isSafeSrc(src)) results.push({ alt: '', src });
  }
  return results;
}

export function imagePreview(): Extension {
  const decoField = StateField.define({
    create() {
      return Decoration.none;
    },
    update(_value, tr) {
      if (!tr.docChanged) return _value;
      const builder = new RangeSetBuilder<Decoration>();
      for (let i = 1; i <= tr.newDoc.lines; i++) {
        const line = tr.newDoc.line(i);
        const imgs = collectLineImages(line.text);
        if (imgs.length) {
          const widget = Decoration.widget({ widget: new ImagesWidget(imgs), block: true });
          builder.add(line.to, line.to, widget);
        }
      }
      return builder.finish();
    },
    provide: (f) => EditorView.decorations.from(f),
  });

  return [
    ViewPlugin.fromClass(
      class {
        constructor(readonly view: EditorView) {}
        update(update: ViewUpdate) {
          if (update.docChanged || update.viewportChanged) {
            // Trigger recompute by reading decoField
            void update.view.state.field(decoField);
          }
        }
      }
    ),
    decoField,
  ];
}
