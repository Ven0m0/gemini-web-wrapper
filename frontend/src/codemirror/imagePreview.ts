import { Extension, RangeSetBuilder } from '@codemirror/state'
import { Decoration, EditorView, ViewPlugin, ViewUpdate, WidgetType } from '@codemirror/view'

type ImgRef = { alt: string; src: string }

// Simple sanitizer: allow http(s), data URLs, or relative paths; block javascript: URIs
function isSafeSrc(src: string): boolean {
  const s = src.trim()
  if (s.startsWith('javascript:')) return false
  if (s.startsWith('http://') || s.startsWith('https://') || s.startsWith('data:')) return true
  // relative or root-relative
  return s.startsWith('/') || !s.includes('://')
}

class ImagesWidget extends WidgetType {
  constructor(private images: ImgRef[]) { super() }
  eq(other: ImagesWidget) {
    if (this.images.length !== other.images.length) return false
    for (let i = 0; i < this.images.length; i++) {
      const a = this.images[i], b = other.images[i]
      if (a.src !== b.src || a.alt !== b.alt) return false
    }
    return true
  }
  toDOM() {
    const wrap = document.createElement('div')
    wrap.className = 'cm-image-preview'
    for (const imgref of this.images) {
      const img = document.createElement('img')
      img.loading = 'lazy'
      img.decoding = 'async'
      img.alt = imgref.alt || ''
      img.src = imgref.src
      img.referrerPolicy = 'no-referrer'
      img.addEventListener('error', () => {
        img.style.display = 'none'
      })
      wrap.appendChild(img)
    }
    return wrap
  }
  ignoreEvent() { return false }
}

function collectLineImages(text: string, maxPerLine = 3): ImgRef[] {
  const results: ImgRef[] = []
  // Markdown image: ![alt](url)
  const mdImg = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g
  let m: RegExpExecArray | null
  while ((m = mdImg.exec(text)) && results.length < maxPerLine) {
    const alt = (m[1] || '').trim()
    const src = (m[2] || '').trim()
    if (isSafeSrc(src)) results.push({ alt, src })
  }
  // Basic HTML <img src="..."> support
  const htmlImg = /<img\s+[^>]*src=["']([^"']+)["'][^>]*>/gi
  while ((m = htmlImg.exec(text)) && results.length < maxPerLine) {
    const src = (m[1] || '').trim()
    if (isSafeSrc(src)) results.push({ alt: '', src })
  }
  return results
}

export function imagePreview(): Extension {
  const decoField = EditorView.decorations.compute([EditorView.viewport], (state, view) => {
    const builder = new RangeSetBuilder<Decoration>()
    for (const { from, to } of view.visibleRanges) {
      let pos = from
      while (pos <= to) {
        const line = state.doc.lineAt(pos)
        const imgs = collectLineImages(line.text)
        if (imgs.length) {
          const widget = Decoration.widget({ widget: new ImagesWidget(imgs), block: true })
          builder.add(line.to, line.to, widget)
        }
        pos = line.to + 1
      }
    }
    return builder.finish()
  })

  return [
    ViewPlugin.fromClass(class {
      constructor(readonly view: EditorView) {}
      update(update: ViewUpdate) {
        if (update.docChanged || update.viewportChanged) {
          // Trigger recompute by reading decoField
          void update.view.state.field(decoField)
        }
      }
    }),
    decoField
  ]
}

