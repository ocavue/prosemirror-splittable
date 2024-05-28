# prosemirror-splittable

[![NPM version](https://img.shields.io/npm/v/prosemirror-splittable?color=a1b858&label=)](https://www.npmjs.com/package/prosemirror-splittable)

Extends [ProseMirror]'s [AttributeSpec] to allow for `splittable` property. `splittable` is a boolean that, when `true`, enables the inheritance of the attribute when splitting a node using the `splitSplittableBlock` command.

## Example

In the schema defined below, the `textAlign` attribute is defined as `splittable` for both `paragraph` and `heading` nodes.

```ts
import { Schema } from 'prosemirror-model'

const schema = new Schema({
  nodes: {
    text: {},
    paragraph: {
      content: 'text*',
      group: 'block',
      attrs: {
        textAlign: { default: 'left', splittable: true },
      },
      toDOM(node) {
        return ['p', { style: `text-align: ${node.attrs.textAlign};` }, 0]
      },
    },
    heading: {
      content: 'text*',
      group: 'block',
      attrs: {
        textAlign: { default: 'left', splittable: true },
      },
      toDOM(node) {
        return ['h1', { style: `text-align: ${node.attrs.textAlign};` }, 0]
      },
    },
    doc: { content: 'block*' },
  },
})
```

Later, we can use the `keymap` plugin to bind the `Enter` key to the `splitSplittableBlock` command.

```ts
import { splitSplittableBlock } from 'prosemirror-splittable'
import { keymap } from 'prosemirror-keymap'
import {
  baseKeymap,
  chainCommands,
  createParagraphNear,
  liftEmptyBlock,
  newlineInCode,
} from 'prosemirror-commands'

const customBaseKeymap = {
  ...baseKeymap,
  Enter: chainCommands(
    newlineInCode,
    createParagraphNear,
    liftEmptyBlock,
    splitSplittableBlock,
  ),
}

const plugin = keymap(customBaseKeymap)
```

## License

MIT

<!-- Links -->

[ProseMirror]: https://prosemirror.net/
[AttributeSpec]: https://prosemirror.net/docs/ref/#model.AttributeSpec
