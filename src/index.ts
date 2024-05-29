/* eslint-disable prefer-const */
import type {
  Attrs,
  NodeType,
  Node,
  ContentMatch,
  ResolvedPos,
} from 'prosemirror-model'
import {
  AllSelection,
  TextSelection,
  NodeSelection,
  type Command,
} from 'prosemirror-state'
import { canSplit } from 'prosemirror-transform'

declare module 'prosemirror-model' {
  export interface AttributeSpec {
    /**
     * Indicates if the block can be split using the `splitBlockAs` command.
     *
     * When `splittable` is set to `true`, splitting the block with the
     * `splitSplittableBlock` command will pass this attribute to the newly
     * created block. This new block may be of a different type than the original.
     *
     * If multiple block types in the schema share the same `splittable` attribute,
     * ensure they are compatible in type and definition. This compatibility allows
     * the attribute value to be correctly inherited across different block types.
     */
    splittable?: boolean
  }
}

/**
 * Split the block at the current selection, but try to inherit splittable
 * attributes from the previous block.
 */
export const splitSplittableBlock: Command = splitBlockAs(
  (node, atEnd, $from) => {
    if (!atEnd) return null

    const defaultType =
      $from.depth == 0
        ? null
        : defaultBlockAt($from.node(-1).contentMatchAt($from.indexAfter(-1)))

    if (!defaultType) return null

    const attrs = inheritSplittableAttrs(node, defaultType)
    return attrs ? { type: defaultType, attrs } : null
  },
)

// Copied from unreleased https://github.com/prosemirror/prosemirror-commands/blob/7d0b6fe54bed7001f2e32a4eee3db946abaf4cf9/src/commands.ts#L357
// prettier-ignore
export function splitBlockAs(
  splitNode?: (node: Node, atEnd: boolean, $from: ResolvedPos) => {type: NodeType, attrs?: Attrs} | null
): Command {
  return (state, dispatch) => {
    let {$from, $to} = state.selection
    if (state.selection instanceof NodeSelection && state.selection.node.isBlock) {
      if (!$from.parentOffset || !canSplit(state.doc, $from.pos)) return false
      if (dispatch) dispatch(state.tr.split($from.pos).scrollIntoView())
      return true
    }

    if (!$from.parent.isBlock) return false

    if (dispatch) {
      let atEnd = $to.parentOffset == $to.parent.content.size
      let tr = state.tr
      if (state.selection instanceof TextSelection || state.selection instanceof AllSelection) tr.deleteSelection()
      let deflt = $from.depth == 0 ? null : defaultBlockAt($from.node(-1).contentMatchAt($from.indexAfter(-1)))
      let splitType = splitNode && splitNode($to.parent, atEnd, $from)
      let types = splitType ? [splitType] : atEnd && deflt ? [{type: deflt}] : undefined
      let can = canSplit(tr.doc, tr.mapping.map($from.pos), 1, types)
      if (!types && !can && canSplit(tr.doc, tr.mapping.map($from.pos), 1, deflt ? [{type: deflt}] : undefined)) {
        if (deflt) types = [{type: deflt}]
        can = true
      }
      if (can) {
        tr.split(tr.mapping.map($from.pos), 1, types)
        if (!atEnd && !$from.parentOffset && $from.parent.type != deflt) {
          let first = tr.mapping.map($from.before()), $first = tr.doc.resolve(first)
          if (deflt && $from.node(-1).canReplaceWith($first.index(), $first.index() + 1, deflt))
            tr.setNodeMarkup(tr.mapping.map($from.before()), deflt)
        }
      }
      dispatch(tr.scrollIntoView())
    }
    return true
  }
}

/**
 * Return an attribute object that inherited from the previous node.
 */
function inheritSplittableAttrs(prev: Node, type: NodeType): Attrs | null {
  const prevAttrs = findSplittableAttrs(prev.type, true)
  const nextAttrs = findSplittableAttrs(type, true)
  const attrs = prevAttrs.filter((attr) => nextAttrs.includes(attr))
  if (attrs.length === 0) {
    return null
  }
  return Object.fromEntries(attrs.map((attr) => [attr, prev.attrs[attr]]))
}

/**
 * Find all the splittable attributes in the given block type.
 */
function findSplittableAttrs(type: NodeType, splittable: boolean): string[] {
  const attrs: string[] = []
  for (const [attr, spec] of Object.entries(type.spec.attrs ?? {})) {
    if (spec.splittable === splittable) {
      attrs.push(attr)
    }
  }
  return attrs
}

// Copied from https://github.com/prosemirror/prosemirror-commands/blob/2da5f6621ab684b5b3b2a2982b8f91d293d4a582/src/commands.ts#L297
function defaultBlockAt(match: ContentMatch) {
  for (let i = 0; i < match.edgeCount; i++) {
    const { type } = match.edge(i)
    if (type.isTextblock && !type.hasRequiredAttrs()) return type
  }
  return null
}
