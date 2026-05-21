# Chapter 2: Displaying a Graph

## What you'll build

A Vue app that creates a small component-dependency graph in code and arranges it automatically with yFiles'
`HierarchicalLayout`:

```
                 ┌─────┐
                 │ App │
                 └──┬──┘
         ┌──────────┼──────────┐
         ▼          ▼          ▼
     ┌────────┐  ┌───────┐  ┌────────┐
     │ Router │  │ Store │  │ Header │
     └───┬────┘  └───┬───┘  └────────┘
      ┌──┴──┐        │
      ▼     ▼        ▼
  ┌───────┐ ┌──────────┐  ┌────────────┐
  │ Dash… │ │ Settings │  │ API Client │◀─┘
  └───────┘ └──────────┘  └────────────┘
```

---

## Prerequisites

Completed [Chapter 1](../01-setup/README.md). This chapter introduces two new concepts on top of the empty canvas: the \* \*`IGraph` API** and **automatic layout\*\*.

---

## 1. The graph model: [`IGraph`](https://docs.yworks.com/yfileshtml/api/IGraph/)

In yFiles, the graph you see on screen is backed by a **graph model** — an in-memory data structure that holds nodes,
edges, labels, and ports. The model is accessed through the `IGraph` interface.

You get the `IGraph` from the `GraphComponent`:

```ts
const graph: IGraph = graphComponent.graph
```

`IGraph` is also a **factory** — it is the only way to create elements that belong to the graph:

```ts
const node = graph.createNode() // ✅ correct
// const node = new INode()       // ❌ does not exist
```

In the next chapter the [GraphBuilder](https://docs.yworks.com/yfileshtml/dguide/graph_builder/) is introduced, a more
advanced and very flexible method to create and update a graph from data.

---

## 2. Creating nodes

`graph.createNode()` returns an `INode` reference. You need to hold on to it to connect nodes with edges later.

The simplest overload creates a node with default size at the origin:

```ts
const node = graph.createNode()
```

You can set an initial position and size by passing a `Rect`:

```ts
import { Rect } from '@yfiles/yfiles'

const node = graph.createNode(new Rect(0, 0, 120, 40))
```

Or use the **options-object overload** to also add a label in one call:

```ts
const app = graph.createNode({ labels: ['App'] })
```

### Setting a default size

Instead of specifying the size on every node, set it once on the defaults object — then all subsequently created nodes
will use that size:

```ts
import { Size } from '@yfiles/yfiles'

graph.nodeDefaults.size = new Size(120, 40)

const app = graph.createNode({ labels: ['App'] }) // 120×40
const router = graph.createNode({ labels: ['Router'] }) // 120×40
```

---

## 3. Creating edges

`graph.createEdge(source, target)` takes two `INode` references and creates a directed edge between them:

```ts
graph.createEdge(app, router)
```

The edge's direction (source → target) is used by directional layout algorithms like `HierarchicalLayout` to determine
which node goes "higher" in the hierarchy.

---

## 4. Separating graph construction from the component

It is a good practice to keep graph building logic out of the Vue component. Create a separate `buildGraph.ts` module
that takes an `IGraph` and populates it:

```ts
// src/buildGraph.ts
import { type IGraph, Size } from '@yfiles/yfiles'

export function buildGraph(graph: IGraph): void {
  graph.nodeDefaults.size = new Size(120, 40)

  const app = graph.createNode({ labels: ['App'] })
  const router = graph.createNode({ labels: ['Router'] })
  const store = graph.createNode({ labels: ['Store'] })
  const header = graph.createNode({ labels: ['Header'] })
  const dashboard = graph.createNode({ labels: ['Dashboard'] })
  const settings = graph.createNode({ labels: ['Settings'] })
  const api = graph.createNode({ labels: ['API Client'] })

  graph.createEdge(app, router)
  graph.createEdge(app, store)
  graph.createEdge(app, header)
  graph.createEdge(router, dashboard)
  graph.createEdge(router, settings)
  graph.createEdge(store, api)
  graph.createEdge(dashboard, api)
}
```

---

## 5. Applying a layout

Nodes created with `createNode()` are initially stacked at position `(0, 0)`. A layout algorithm computes proper
positions for all nodes and routes all edges.

yFiles provides a wide range of layout styles and configurations suitable for different application fields. Here we use
the `HierarchicalLayout`.

```ts
// src/GraphView.vue
// Arrange the graph with a hierarchical layout
void graphComponent.applyLayoutAnimated(new HierarchicalLayout())
```

Layout algorithms can be computationally expensive. Running them synchronously would freeze the UI.
`GraphComponent.applyLayoutAnimated` returns a `Promise` that resolves when the layout (and any animation) is complete.
It is a good practice to `await` it, or at least `void` it if you do not need to wait.

### `HierarchicalLayout`

`HierarchicalLayout` arranges nodes in horizontal or vertical layers, following the direction of edges. It is
well-suited for dependency graphs, flowcharts, and trees. No configuration is needed for a basic use — the defaults work
well.

---

## 6. Updating `GraphView`

Chapter 1's `GraphView` only mounted the canvas. Now it also initializes the
graph.

```ts
// src/GraphView.vue
// Create the yFiles GraphComponent after the DOM element exists.
onMounted(() => {
  graphComponent = new GraphComponent(graphComponentContainer.value!)
  graphComponentRef.value = graphComponent

  // Build the graph structure
  buildGraph(graphComponent.graph)
  // Arrange the graph with a hierarchical layout
  void graphComponent.applyLayoutAnimated(new HierarchicalLayout())
})
```

The `void` prefix discards the `Promise` — this is fine here because this is fire-and-forget initialization.

---

## 7. `App.vue` — unchanged

`App.vue` is identical to chapter 1. The graph initialization is entirely
inside `GraphView`, so `App` does not need to change.

---

## Key concepts

| Concept                      | Summary                                             |
| ---------------------------- | --------------------------------------------------- |
| `graphComponent.graph`       | The `IGraph` instance — the graph model.            |
| `graph.createNode()`         | Creates a node. Returns `INode`.                    |
| `graph.createEdge(src, tgt)` | Creates a directed edge. Returns `IEdge`.           |
| `graph.nodeDefaults.size`    | Default size applied to all new nodes.              |
| `LayoutExecutor`             | Runs a layout algorithm and optionally animates it. |
| `HierarchicalLayout`         | Arranges nodes in layers along edge direction.      |

---

## Next chapter

[Chapter 3: Loading Data with GraphBuilder →](../03-graph-builder/README.md)

Hard-coding nodes and edges works for toy examples, but real applications load
data from an API or a JSON file. In the next chapter we'll use `GraphBuilder`
to bind a JSON dataset to the graph declaratively, and update the graph
automatically when the data changes.
