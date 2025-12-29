import { EditorSelection } from '@codemirror/state'
import { EditorView } from '@codemirror/view'

function isImage(file: File) {
  return file.type.startsWith('image/')
}

function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error)
    reader.onload = () => resolve(String(reader.result))
    reader.readAsDataURL(file)
  })
}

async function insertImages(view: EditorView, files: File[], pos?: number, onResolve?: (files: File[], dataUrls: string[]) => Promise<string[] | void>) {
  const images = files.filter(isImage)
  if (!images.length) return false

  // Limit to a few images per action to avoid huge inserts
  const subset = images.slice(0, 3)

  const parts: string[] = []
  const dataUrls: string[] = []
  for (const file of subset) {
    try {
      const url = await readFileAsDataURL(file)
      const alt = file.name.replace(/\[(.*?)\]|\(|\)/g, '_')
      dataUrls.push(url)
      parts.push(`![${alt}](${url})`)
    } catch (e) {
      // skip errored files
    }
  }
  if (!parts.length) return false

  const text = (pos != null ? '' : '\n') + parts.join('\n') + '\n'
  let from: number, to: number
  if (pos == null) {
    const head = view.state.selection.main.head
    from = head
    to = head
  } else {
    from = pos
    to = pos
  }
  view.dispatch({
    changes: { from, to, insert: text },
    selection: EditorSelection.cursor(from + text.length)
  })

  // Attempt async resolution to final URLs (e.g., uploaded to repo)
  if (onResolve && dataUrls.length) {
    try {
      const finals = await onResolve(subset, dataUrls)
      if (finals && finals.length) {
        const searchFrom = from
        const searchTo = from + text.length
        const slice = view.state.doc.sliceString(searchFrom, searchTo)
        let replaced = slice
        dataUrls.forEach((d, i) => {
          const f = finals[i]
          if (f && f !== d) {
            replaced = replaced.replace(d, f)
          }
        })
        if (replaced !== slice) {
          view.dispatch({
            changes: { from: searchFrom, to: searchTo, insert: replaced }
          })
        }
      }
    } catch {
      // silently ignore upload failures; data URLs remain
    }
  }
  return true
}

export function imagePasteDrop(options?: { onResolveUrls?: (files: File[], dataUrls: string[]) => Promise<string[] | void> }) {
  return EditorView.domEventHandlers({
    paste: (event, view) => {
      if (!event.clipboardData) return false
      const files = Array.from(event.clipboardData.files || [])
      if (!files.some(isImage)) return false
      event.preventDefault()
      insertImages(view, files, undefined, options?.onResolveUrls)
      return true
    },
    drop: (event, view) => {
      if (!event.dataTransfer) return false
      const files = Array.from(event.dataTransfer.files || [])
      if (!files.some(isImage)) return false
      event.preventDefault()
      const pos = view.posAtCoords({ x: event.clientX, y: event.clientY }) ?? view.state.selection.main.head
      insertImages(view, files, pos, options?.onResolveUrls)
      return true
    }
  })
}
