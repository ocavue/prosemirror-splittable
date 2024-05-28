/* eslint-disable prefer-const */
import type { Attrs, NodeType, Node, ContentMatch } from 'prosemirror-model'
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
     * Whether the block can be split by the splitBlockAs command.
     *
     * If `splittable` is `true`, when the block is split by the
     * `splitSplittableBlock` command, the attribute will be inherited to the
     * new block, which might be a different type than the original block.
     *
     * In the schema, if multiple block types have the same splittable attribute
     * with the same name, you need to make sure all of them have the same type
     * and meaning, so that they can inherit the attribute value from a
     * different type of block.
     */
    splittable?: boolean
  }
}

/**
 * Split the block at the current selection, but try to inherit splittable
 * attributes from the previous block.
 */
export const splitSplittableBlock: Command = splitBlockAs(
  (node, atEnd, type) => {
    if (atEnd && type) {
      const attrs = inheritSplittableAttrs(node, type)
      if (attrs) {
        return { type, attrs }
      }
    }
    return null
  },
)

// Copied from https://github.com/prosemirror/prosemirror-commands/blob/2da5f6621ab684b5b3b2a2982b8f91d293d4a582/src/commands.ts#L357
// Add a `type` parameter to the `splitNode` function
function splitBlockAs(
  splitNode?: (
    node: Node,
    atEnd: boolean,
    type: NodeType | null,
  ) => { type: NodeType; attrs?: Attrs } | null,
): Command {
  // prettier-ignore
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
      let defaultType = $from.depth == 0 ? null : defaultBlockAt($from.node(-1).contentMatchAt($from.indexAfter(-1)))
      let splitType = splitNode && splitNode($to.parent, atEnd, defaultType)
      let types = splitType ? [splitType] : atEnd && defaultType ? [{type: defaultType}] : undefined
      let can = canSplit(tr.doc, tr.mapping.map($from.pos), 1, types)
      if (!types && !can && canSplit(tr.doc, tr.mapping.map($from.pos), 1, defaultType ? [{type: defaultType}] : undefined)) {
        if (defaultType) types = [{type: defaultType}]
        can = true
      }
      if (can) {
        tr.split(tr.mapping.map($from.pos), 1, types)
        if (!atEnd && !$from.parentOffset && $from.parent.type != defaultType) {
          let first = tr.mapping.map($from.before()), $first = tr.doc.resolve(first)
          if (defaultType && $from.node(-1).canReplaceWith($first.index(), $first.index() + 1, defaultType))
            tr.setNodeMarkup(tr.mapping.map($from.before()), defaultType)
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
