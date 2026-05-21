# Chapter 3: Loading Data with GraphBuilder

## What you'll build

A graph that loads its structure from a JSON file and updates live when Vue state changes. Two actions demonstrate the
update cycle you could implement:

- **Add Service** — append a new node to your data; the graph updates with an animated layout transition
- **Reset** — restore the original dataset

```
       ┌────────┐
       │ Client │
       └───┬────┘
           ▼
     ┌─────────────┐
     │ API Gateway │
     └──┬───┬───┬──┘
        ▼   ▼   ▼
  ┌──────┐ ┌──────┐ ┌─────────┐
  │ Auth │ │ User │ │ Product │  ← click "Add Service" to add more
  └──┬───┘ └──┬───┘ └────┬────┘
     └────────┴──────────┘
                 ▼
           ┌──────────┐
           │ Database │
           └──────────┘
```

---

## Prerequisites

Completed [Chapter 2](../02-first-graph/README.html). This chapter replaces the manual `IGraph` calls from chapter
2 with `GraphBuilder` — a declarative binding layer between your application data and the graph.

---

## 1. Why GraphBuilder?

In chapter 2 we called `graph.createNode()` and `graph.createEdge()` directly. That is fine for a static, hard-coded
graph, but real applications load data from an API or a file, and that data changes over time.

[`GraphBuilder`](https://docs.yworks.com/yfileshtml/dguide/graph_builder/) solves two problems:

1. **Mapping**: it knows how to turn an array of plain objects into graph elements, using a field you specify as the
   stable identity key.
2. **Incremental updates**: when the data changes, `GraphBuilder.updateGraph()` reconciles the graph with the new data —
   reusing existing nodes and edges where possible instead of rebuilding from scratch. This preserves custom state (
   positions, tags, styles) on unchanged items.

---

## 2. The data shape

`GraphBuilder` expects separate arrays for nodes and edges. For this chapter the JSON file looks like this:

```json
{
  "nodesSource": [
    {
      "id": 1,
      "name": "Client"
    },
    {
      "id": 2,
      "name": "API Gateway"
    }
  ],
  "edgesSource": [
    {
      "fromNode": 1,
      "toNode": 2
    }
  ]
}
```

The `id` field is used as the stable identity key. The `fromNode`/`toNode` fields reference node IDs, not array
indices — the builder resolves them.

---

## 3. Setting up the GraphBuilder

Create a `GraphBuilder` that operates on the `IGraph` from the `GraphComponent`. Then register node and edge _sources_ —
these describe how to read your data:

```ts
// src/useGraphBuilder.ts
function createGraphBuilder(graph: IGraph) {
  const builder = new GraphBuilder(graph)

  // createNodesSource tells the builder:
  //  - which array to read nodes from (starts empty here)
  //  - how to derive a stable ID from each data item (used to match
  //    items across updateGraph() calls without rebuilding from scratch)
  const nodesSource = builder.createNodesSource<NodeData>({
    data: [] as NodeData[],
    id: (item) => item.id,
  })

  // createLabelBinding maps a data property to the node's visible label.
  nodesSource.nodeCreator.createLabelBinding((item) => item.name)

  // createEdgesSource tells the builder which array holds edge data and
  // how to resolve source/target node IDs from each edge data item.
  const edgesSource = builder.createEdgesSource<EdgeData>({
    data: [] as EdgeData[],
    sourceId: (item) => item.fromNode,
    targetId: (item) => item.toNode,
  })

  return { builder, nodesSource, edgesSource }
}
```

### Why start with empty arrays?

We pass `[]` here so we can always use the same `setData()` + `updateGraph()` path — whether it is the first render or a
later update. If you pass the real data to `createNodesSource`, you'd call `buildGraph()` on the first render and
`updateGraph()` on subsequent ones. Starting empty keeps the flow uniform.

---

## 4. The build / update cycle

Once the sources are registered, populating or updating the graph is a two-step call:

```ts
// src/useGraphBuilder.ts
// Replace the data on each source …
builder.setData(nodesSource, graphData.nodesSource)
builder.setData(edgesSource, graphData.edgesSource)

// … then reconcile the graph with the new data.
builder.updateGraph()
```

**First call** (empty graph): `updateGraph()` acts like `buildGraph()` — it creates all nodes and edges from the
provided data.

**Subsequent calls**: `updateGraph()` performs a diff against what is already in the graph. Nodes and edges whose IDs
are still present in the data are reused; new IDs cause new elements to be created; missing IDs cause removal.

---

## 5. Vue integration: one composable, one state

The key design is that `graphData` is plain Vue state (`ref`). Every time it changes, a `watch` syncs it to the
`GraphBuilder`. We encapsulate this logic in a small composable.

### The `useGraphBuilder` composable

```ts
// src/useGraphBuilder.ts
export function useGraphBuilder(graphComponent: GraphComponent, graphData: Ref<GraphData>) {
  const { builder, nodesSource, edgesSource } = createGraphBuilder(graphComponent.graph)

  watch(
    graphData,
    (data) => {
      if (!data) return
      builder.setData(nodesSource, data.nodesSource)
      builder.setData(edgesSource, data.edgesSource)
      builder.updateGraph()
      void applyLayout(graphComponent)
    },
    { immediate: true },
  )
}
```

The composable creates the builder once per component instance and keeps the graph in sync with your reactive data.

## 6. Updating `GraphView`

We call the `useGraphBuilder` composable once after the DOM element exists (i.e. in `onMounted`) and create the
`GraphBuilder` tied to `GraphComponent`.

```ts
// src/GraphView.vue
import initialGraphData from './graph-data.json'

const graphData = ref<GraphData>(initialGraphData as GraphData)

onMounted(() => {
  graphComponent = new GraphComponent(graphComponentElement.value!)
  graphComponent.inputMode = new GraphViewerInputMode()
  graphComponent.graph.nodeDefaults.size = new Size(140, 40)
  graphComponent.contentMargins = new Insets(30)
  graphComponentRef.value = graphComponent

  useGraphBuilder(graphComponent, graphData)
})
```

Subsequent updates are driven by the `watch` on `graphData`.

## 7. Vue integration: state in App.vue

Your UI code only needs to update `graphData`. The composable takes care of syncing and layout:

```vue
<!-- src/App.vue -->
<template>
  <div id="app">
    <div class="toolbar">
      <button type="button" @click="addService">Add Service</button>
      <button type="button" @click="reset">Reset</button>
    </div>
    <graph-view :graphData="graphData" />
  </div>
</template>
<script setup lang="ts">
import { provide, ref, shallowRef } from 'vue'
import GraphView from './GraphView.vue'
import { GraphComponent, License } from '@yfiles/yfiles'
import type { GraphData } from './types'
import initialGraphData from './graph-data.json'
import licenseData from './license.json'

License.value = licenseData
const graphComponentRef = shallowRef<GraphComponent | null>()
provide('GraphComponentRef', graphComponentRef)

// App owns the graph data state and passes it down as a Ref
const graphData = ref<GraphData>(initialGraphData as GraphData)

function addService() {
  const newId = Math.max(...graphData.value.nodesSource.map((node) => node.id)) + 1
  graphData.value = {
    nodesSource: [...graphData.value.nodesSource, { id: newId, name: `Service ${newId}` }],
    // Connect the new service to the API Gateway (id 2) and the Database (id 6)
    edgesSource: [
      ...graphData.value.edgesSource,
      { fromNode: 2, toNode: newId },
      { fromNode: newId, toNode: 6 },
    ],
  }
}

function reset() {
  graphData.value = initialGraphData as GraphData
}
</script>
```

The graph update, including the animated layout, follows automatically — you never touch the `IGraph` API directly in
your event handler.

---

## Note on layout frequency

This chapter re-runs `HierarchicalLayout` after every `updateGraph()`. For large graphs or rapid updates, you would
instead use yFiles' [incremental layout](https://docs.yworks.com/yfileshtml/#/dguide/layout-incremental_layout) mode,
which only repositions the elements that changed. For the tutorial's small graphs, a full re-layout is fine and visually
demonstrates the update cycle clearly.

---

## Key concepts

| Concept                                 | Summary                                                                  |
| --------------------------------------- | ------------------------------------------------------------------------ |
| `GraphBuilder`                          | Declarative bridge between data arrays and the graph model.              |
| `createNodesSource(data, idProvider)`   | Registers a nodes data array and its ID accessor.                        |
| `createEdgesSource(data, srcId, tgtId)` | Registers an edges data array and its endpoint accessors.                |
| `createLabelBinding(fn)`                | Maps a data field to a node label.                                       |
| `setData(source, newArray)`             | Replaces the data on a registered source before an update.               |
| `updateGraph()`                         | Reconciles the graph with the current data. Incremental on repeat calls. |
| `ref` + `watch`                         | Holds reactive data and triggers graph updates when it changes.          |
