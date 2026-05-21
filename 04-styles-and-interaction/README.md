# Chapter 4: Styles and Interaction

## What you'll build

The same microservices graph as chapter 3, now with data‑driven visual styles
and interactive click feedback:

- Each node category gets a distinct shape and color
- Edges get a clean arrow style with rounded bends
- Node labels are rendered in white text
- Clicking a node or edge shows an overlay panel with item details
- A toolbar provides zoom controls without any prop‑drilling (using provide/inject)

| Node type  | Shape           | Color           |
| ---------- | --------------- | ---------------- |
| `client`   | rectangle       | blue `#3d72c8`   |
| `gateway`  | pill            | amber `#e08c00`  |
| `service`  | round-rectangle | teal `#0f9c99`   |
| `database` | hexagon         | purple `#6a3fb5` |

---

## Prerequisites

Completed [Chapter 3](../03-graph-builder/README.md). This chapter builds
on the provide/inject architecture from chapters 1–3. New concepts are
yFiles style APIs, toolbar commands, and bridging yFiles events to Vue state.

---

## 1. Extending the data model

The first step is to add a `type` discriminator to `NodeData`:

```ts
// src/types.ts
export type NodeType = 'client' | 'gateway' | 'service' | 'database'

export interface NodeData {
  id: number
  name: string
  type: NodeType // ← new
}
```

And add the field to every node in the data file:

```txt
// src/graph-data.json
{ "id": 1, "name": "Client", "type": "client" },
{ "id": 2, "name": "API Gateway", "type": "gateway"  },
{ "id": 3, "name": "Auth Service","type": "service"  }
```

### TypeScript caveat: JSON imports are widened

TypeScript infers the `type` field of a JSON import as `string`, not
`NodeType`. To keep the type system sound, cast the import when using it
as typed data:

```ts
import rawData from './graph-data.json'
import type { GraphData } from './types'

const initialData = rawData as GraphData
```

---

## 2. Style factories — `styles.ts`

All style creation is extracted into a single module. This keeps styling
logic separate from component and composable code.

### Node styles — one factory per type

```ts
// src/styles.ts
import { ShapeNodeStyle } from '@yfiles/yfiles'
import type { NodeType } from './types'

const NODE_STYLES: Record<NodeType, () => ShapeNodeStyle> = {
  client: () =>
    new ShapeNodeStyle({ shape: 'rectangle', fill: '#3d72c8', stroke: '1.5px #2855a0' }),
  gateway: () => new ShapeNodeStyle({ shape: 'pill', fill: '#e08c00', stroke: '1.5px #b06c00' }),
  service: () =>
    new ShapeNodeStyle({ shape: 'round-rectangle', fill: '#0f9c99', stroke: '1.5px #0b7370' }),
  database: () =>
    new ShapeNodeStyle({ shape: 'hexagon', fill: '#6a3fb5', stroke: '1.5px #4d2d8a' }),
}

export function getNodeStyle(type: NodeType): ShapeNodeStyle {
  return NODE_STYLES[type]()
}
```

Each entry in `NODE_STYLES` is a **factory function** (a `() => …` arrow),
not a pre-built instance. `getNodeStyle()` calls the factory every time,
returning a _new_ `ShapeNodeStyle` object on each invocation.

**Why is this important?** yFiles treats style objects as potentially mutable.
If two nodes share the same style instance and you later modify one node's
appearance, both nodes change. Returning a fresh instance per node keeps
styles isolated.

### `ShapeNodeStyle` shapes

The `shape` property accepts a string literal. Common values include:

| Value               | Shape                          |
| ------------------- | ------------------------------ |
| `'rectangle'`       | Sharp-cornered rectangle       |
| `'round-rectangle'` | Rectangle with rounded corners |
| `'ellipse'`         | Oval / circle                  |
| `'hexagon'`         | Six-sided polygon              |
| `'diamond'`         | Rotated square                 |

### Edge style

```ts
export function createDefaultEdgeStyle(): PolylineEdgeStyle {
  return new PolylineEdgeStyle({
    stroke: '2px #888888',
    targetArrow: new Arrow({ type: 'triangle', fill: '#888888' }),
    smoothingLength: 20,
  })
}
```

`PolylineEdgeStyle` draws edges as straight or bent lines. The options:

- `stroke` — a CSS-like string: `'<width> <color>'`
- `targetArrow` — an `Arrow` instance placed at the edge's target end.
  `type: 'triangle'` renders a filled arrowhead; `fill` sets its color.
- `smoothingLength` — rounds the corners where edge segments bend.

### Label style

```ts
export function createDefaultLabelStyle(): LabelStyle {
  return new LabelStyle({ textFill: '#ffffff' })
}
```

`textFill` sets the text color — here white, to contrast with colored nodes.

---

## 3. Updating `GraphView`

The `GraphComponent` is created in `GraphView.vue`. We configure input mode,
clear the current item on empty canvas clicks, set default styles, and expose the
instance via provide/inject using a `ShallowRef`:

```ts
<!-- src/GraphView.vue -->
onMounted(() => {
  graphComponent = new GraphComponent(graphComponentContainer.value!)
  graphComponentRef.value = graphComponent

  // Set default styles for nodes, edges and labels.
  graphComponent.graph.nodeDefaults.size = new Size(140, 40)
  graphComponent.graph.edgeDefaults.style = createDefaultEdgeStyle()
  graphComponent.graph.nodeDefaults.labels.style = createDefaultLabelStyle()

  // Use a viewer input mode and clear the selection when the
  // user clicks the empty canvas background.
  const inputMode = new GraphViewerInputMode()
  clearCurrentItemListener = () => {
    graphComponent!.currentItem = null
  }
  inputMode.addEventListener('canvas-clicked', clearCurrentItemListener)
  graphComponent.inputMode = inputMode

  // Initialize the GraphBuilder and keep the graph in sync with the prop data.
  useGraphBuilder(graphComponent, graphDataRef)
})
```

`graph.edgeDefaults.style` is the style used for every new edge unless overridden.
`graph.nodeDefaults.labels.style` applies to labels on every new node. Node body
styles are **not** set as a default here because each node needs a different style
based on its `type` — that is handled by `styleProvider` in the next step.

---

## 4. Data‑driven node styles — `styleProvider`

In `useGraphBuilder.ts`, set a `styleProvider` on the node creator:

```ts
// src/useGraphBuilder.ts
nodesSource.nodeCreator.styleProvider = (item) => getNodeStyle(item.type)
```

`styleProvider` is a function called by `GraphBuilder`:

- **on creation** — when a new node is added to the graph
- **on update** — when `updateGraph()` is called and the item's data has changed

It receives the raw data item (`NodeData`) and returns a `ShapeNodeStyle`
instance. Because `getNodeStyle` returns a new instance each time, every
node gets its own style object — changes to one node's style never leak to
another.

---

## 5. Storing data on items — `tagProvider`

Before we can read data from a clicked item, the data must be on the item.
The `tagProvider` stores the full source data object on each node and edge’s
`tag` property:

```ts
// src/useGraphBuilder.ts
nodesSource.nodeCreator.tagProvider = (item) => item
edgesSource.edgeCreator.tagProvider = (item) => item
```

`tagProvider` runs once per item when the graph is built (and again on
`updateGraph()` if the item’s data changed). Setting it to `(item) => item`
stores the entire data object, making every field accessible from `node.tag`
and `edge.tag` later.

---

## 6. `Toolbar` — provide/inject in action

`Toolbar.vue` uses `inject` to access the shared `GraphComponent` — no prop
needed, no component hierarchy to thread through:

```vue
// src/Toolbar.vue
<template>
  <div class="toolbar">
    <button type="button" @click="zoomIn">Zoom In</button>
    <button type="button" @click="zoomOut">Zoom Out</button>
    <button type="button" @click="zoom100">100%</button>
    <button type="button" @click="fit">Fit</button>
  </div>
</template>

<script setup lang="ts">
  // Small toolbar that executes yFiles built-in commands on the shared GraphComponent.
  import type {ShallowRef} from 'vue'
  import {inject} from 'vue'
  import {Command, GraphComponent} from '@yfiles/yfiles'

  // Access the GraphComponent instance that GraphView created.
  const graphComponentRef = inject<ShallowRef<GraphComponent | null>>('GraphComponentRef')
  if (!graphComponentRef) {
    throw new Error('GraphComponentRef not provided. Did you call provide("GraphComponentRef", ...) in App.vue?')
  }

  function zoomIn() {
    graphComponentRef!.value?.executeCommand(Command.INCREASE_ZOOM)
  }

  function zoomOut() {
    graphComponentRef!.value?.executeCommand(Command.DECREASE_ZOOM)
  }

  function zoom100() {
    // Set zoom to 100%
    graphComponentRef!.value?.executeCommand(Command.ZOOM, 1)
  }

  async function fit() {
    // Animate the viewport so the whole graph becomes visible.
    if (!graphComponentRef!.value) return
    await graphComponentRef!.value.fitGraphBounds({animated: true})
  }
```

`Command.INCREASE_ZOOM` / `DECREASE_ZOOM` / `ZOOM` are built‑in yFiles commands
executed by `graphComponent.executeCommand()`. `fitGraphBounds()` pans and zooms
the viewport to make all graph content visible.

---

## 7. Click feedback — `useCurrentItem` and `InfoPanel`

### `useCurrentItem` — bridging a yFiles event to Vue state

`GraphComponent.currentItem` holds the last item the user clicked. yFiles fires
`'current-item-changed'` whenever it changes. The composable converts that event
into a Vue `ref` that updates reactively:

```ts
// src/useCurrentItem.ts
export function useCurrentItem(graphComponentRef: ShallowRef<GraphComponent | null>) {
  const currentItemRef = ref<IModelItem | null>(null)

  function listener() {
    const gc = graphComponentRef.value
    currentItemRef.value = gc?.currentItem ?? null
  }

  function subscribe(gc: GraphComponent | null) {
    if (!gc) {
      currentItemRef.value = null
      return
    }
    currentItemRef.value = gc.currentItem
    gc.addEventListener('current-item-changed', listener)
  }

  function unsubscribe(gc: GraphComponent | null) {
    if (gc) gc.removeEventListener('current-item-changed', listener)
  }

  watch(
    graphComponentRef,
    (newGc, oldGc) => {
      if (oldGc !== newGc) {
        unsubscribe(oldGc)
        subscribe(newGc)
      }
    },
    { immediate: true },
  )

  onUnmounted(() => unsubscribe(graphComponentRef.value))
  return readonly(currentItemRef)
}
```

The pattern — subscribe on mount (or when the ref changes), unsubscribe on
unmount — is the standard way to bridge any imperative event system into Vue’s
reactivity.

### `InfoPanel` — reading the tag

`InfoPanel.vue` receives the `IModelItem | null` and renders the overlay. It uses
`instanceof` checks (yFiles interfaces support `instanceof`) to distinguish
nodes from edges, then reads the tag:

```vue
<!-- src/InfoPanel.vue -->
<template>
  <div v-if="item" class="info-panel">
    <template v-if="isNode">
      You clicked on <strong>&ldquo;{{ nodeName }}&rdquo;</strong>
    </template>
    <template v-else-if="isEdge">
      Connection between
      <strong>&ldquo;{{ sourceName }}&rdquo;</strong>
      and
      <strong>&ldquo;{{ targetName }}&rdquo;</strong>
    </template>
  </div>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { IEdge, INode, type IModelItem } from '@yfiles/yfiles'
import type { NodeData } from './types'

const props = defineProps<{ item: IModelItem | null }>()

const isNode = computed(() => props.item instanceof INode)
const isEdge = computed(() => props.item instanceof IEdge)

const nodeName = computed(() =>
  props.item instanceof INode ? (props.item.tag as NodeData).name : '',
)
const sourceName = computed(() =>
  props.item instanceof IEdge ? (props.item.sourceNode!.tag as NodeData).name : '',
)
const targetName = computed(() =>
  props.item instanceof IEdge ? (props.item.targetNode!.tag as NodeData).name : '',
)
</script>
```

The panel uses `position: absolute` and `pointer-events: none` so it overlays
the canvas without blocking graph interactions. Render it inside the same
positioned container as the canvas:

### Updated `GraphView`

```vue
<!-- src/GraphView.vue (template excerpt) -->
<div class="graph-root">
  <div class="graph-component-container" ref="graphComponentElement"></div>
  <InfoPanel :item="currentItem"/>
</div>
```

`graph-root` has `position: relative`, making the overlay’s `position: absolute`
relative to the canvas area.

---

## 8. What changed vs chapter 3

| File                 | Change                                                                                                    |
| -------------------- | --------------------------------------------------------------------------------------------------------- |
| `types.ts`           | Added `NodeType`, added `type` to `NodeData`                                                              |
| `graph-data.json`    | Added `"type"` field to each node                                                                         |
| `styles.ts`          | New file — all style factory functions                                                                    |
| `GraphView.vue`      | Adds `canvas-clicked` listener; sets edge + label defaults from `styles.ts`; provides `InfoPanel` overlay |
| `useGraphBuilder.ts` | Adds `tagProvider` on node and edge creators; adds `styleProvider` on node creator; runs layout on update |
| `InfoPanel.vue`      | New file — click feedback overlay                                                                         |
| `useCurrentItem.ts`  | New file — bridges yFiles event to a Vue ref                                                              |
| `Toolbar.vue`        | New file — zoom controls using inject’d `GraphComponent`                                                  |
| `App.vue`            | Provides `GraphComponentRef`; casts JSON import; adds `type` when creating dynamic nodes                  |

---

## Key concepts

| Concept                                 | Summary                                                                                                         |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------- |
| `ShapeNodeStyle`                        | Renders a node as a filled shape with a stroke border.                                                          |
| `PolylineEdgeStyle`                     | Renders an edge as a polyline with optional arrowheads.                                                         |
| `LabelStyle`                            | Controls text rendering for node and edge labels.                                                               |
| `Arrow`                                 | An arrowhead placed at either end of an edge.                                                                   |
| `graph.edgeDefaults.style`              | Default style applied to all newly created edges.                                                               |
| `graph.nodeDefaults.labels.style`       | Default style applied to all newly created node labels.                                                         |
| `nodeCreator.styleProvider`             | Per‑item style factory called by `GraphBuilder` on create and update.                                           |
| `nodeCreator.tagProvider`               | Stores the source data object on a node’s `tag` for later retrieval.                                            |
| `Command`                               | Built‑in yFiles commands for zoom, fit, select‑all, etc.                                                        |
| `fitGraphBounds()`                      | Animates the viewport to show all graph content.                                                                |
| `graphComponent.currentItem`            | The item the user last clicked (`IModelItem                                                                     | null`). |
| `'current-item-changed'` event          | Fires when the user clicks a different graph element. Bridge to Vue with `addEventListener` and a reactive ref. |
| `'canvas-clicked'` event                | Fires on `GraphViewerInputMode` when the user clicks empty canvas. Use to clear `currentItem`.                  |
| `instanceof INode` / `instanceof IEdge` | yFiles interfaces support `instanceof` for runtime type narrowing.                                              |

---

## Next chapter

[Chapter 5: Layout in a Web Worker →](../05-layout-worker/README.md)

Hierarchical layout works well for small graphs, but running it on the main
thread blocks the UI during computation. The next chapter moves layout
execution into a web worker so the app stays responsive with large datasets.
