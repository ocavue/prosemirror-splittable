import ist from 'ist'
import { splitBlock } from 'prosemirror-commands'
import { Node, Schema } from 'prosemirror-model'
import {
  EditorState,
  NodeSelection,
  Selection,
  TextSelection,
  type Command,
} from 'prosemirror-state'
import { eq } from 'prosemirror-test-builder'
import { describe, it } from 'vitest'

import { splitSplittableBlock } from '../src'

type Tags = {
  [tag: string]: number
}

type TaggedNode = Node & { tag?: Tags }

function t(node: Node): Tags {
  return (node as TaggedNode).tag ?? {}
}

function selFor(doc: Node) {
  const a = t(doc).a
  if (a != null) {
    const $a = doc.resolve(a)
    if ($a.parent.inlineContent)
      return new TextSelection(
        $a,
        t(doc).b != null ? doc.resolve(t(doc).b) : undefined,
      )
    else return new NodeSelection($a)
  }
  return Selection.atStart(doc)
}

function mkState(doc: Node) {
  return EditorState.create({ doc, selection: selFor(doc) })
}

function apply(doc: Node, command: Command, result: Node | null) {
  let state = mkState(doc)
  command(state, (tr) => (state = state.apply(tr)))
  ist(state.doc, result || doc, eq)
  if (result && t(result).a != null) ist(state.selection, selFor(result), eq)
}

describe('splitSplittableBlock', () => {
  const s = new Schema({
    nodes: {
      text: {},
      paragraph: {
        content: 'text*',
        group: 'block',
        toDOM() {
          return ['p', 0]
        },
        attrs: { textAlign: { default: 'left', splittable: true } },
      },
      heading: {
        content: 'text*',
        group: 'block',
        toDOM() {
          return ['h1', 0]
        },
        attrs: { textAlign: { default: 'left', splittable: true } },
      },
      doc: { content: 'block*' },
    },
  })

  it('inherits attribute when creating default block', () => {
    const doc = s.node('doc', null, [
      s.node('heading', { textAlign: 'center' }, [s.text('hello')]),
    ])
    ;(doc as TaggedNode).tag = { a: 6 }

    apply(
      doc,
      splitSplittableBlock,
      s.node('doc', null, [
        s.node('heading', { textAlign: 'center' }, [s.text('hello')]),
        s.node('paragraph', { textAlign: 'center' }, []),
      ]),
    )
    apply(
      doc,
      splitBlock,
      s.node('doc', null, [
        s.node('heading', { textAlign: 'center' }, [s.text('hello')]),
        s.node('paragraph', null, []),
      ]),
    )
  })

  it('inherits attribute when splitting a node from the middle', () => {
    const doc = s.node('doc', null, [
      s.node('heading', { textAlign: 'center' }, [s.text('hello')]),
    ])
    ;(doc as TaggedNode).tag = { a: 5 }

    apply(
      doc,
      splitSplittableBlock,
      s.node('doc', null, [
        s.node('heading', { textAlign: 'center' }, [s.text('hell')]),
        s.node('heading', { textAlign: 'center' }, [s.text('o')]),
      ]),
    )
    apply(
      doc,
      splitBlock,
      s.node('doc', null, [
        s.node('heading', { textAlign: 'center' }, [s.text('hell')]),
        s.node('heading', { textAlign: 'center' }, [s.text('o')]),
      ]),
    )
  })
})
