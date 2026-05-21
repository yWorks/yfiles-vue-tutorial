# Chapter 5: Layout in a Web Worker

## What you'll build

The same styled microservices graph as chapter 4, but with the layout
algorithm running in a **dedicated web worker** instead of the main thread.
The graph’s behavior is identical — what changes is where the computation
happens.

---

## Prerequisites

Completed [Chapter 4](../04-styles-and-interaction/README.md). This chapter is a
small, targeted modification centered around `useGraphBuilder.ts`. Everything
else — styles, `App.vue`, `GraphView.vue`, and the simple toolbar — stays
the same.

---

## 1. Why move layout to a worker?

Layout algorithms walk every node and edge, solve geometric constraints, and can
take tens or hundreds of milliseconds on large graphs. Running this work on the
main thread blocks rendering and makes the UI feel sluggish.

Web workers run in a separate thread. Moving layout there gives two concrete
benefits:

1. **Main thread stays free** — Vue can update the DOM, animations can play, and the
   user can pan/zoom while the layout runs.
2. **Parallelism** — on multi‑core hardware the layout genuinely executes
   concurrently with the UI thread.

yFiles provides a purpose‑built pair of classes for this pattern:
`LayoutExecutorAsync` (main thread) and `LayoutExecutorAsyncWorker` (worker
thread). They handle serializing the graph, transferring it across the thread
boundary, running the algorithm, and animating the result — with no manual
`postMessage` wiring required.

---

## 2. The worker file — `layout.worker.ts`

The worker is a regular TypeScript module. It must:

1. Register the yFiles license (workers have their own isolated context).
2. Call `LayoutExecutorAsyncWorker.initializeWebWorker()` with a callback that
   creates and applies the layout algorithm.

```ts
// src/layout.worker.ts
import { HierarchicalLayout, LayoutExecutorAsyncWorker, License } from '@yfiles/yfiles'
import licenseData from '../../license.json'

// Workers run in a separate JS context and do not share globals with the main thread.
// The yFiles license must be registered here, too.
License.value = licenseData

// Wire up the worker to receive layout requests from the main thread.
// The callback is given a LayoutGraph; we create and run the algorithm on it.
LayoutExecutorAsyncWorker.initializeWebWorker((graph) => {
  const layout = new HierarchicalLayout()
  layout.applyLayout(graph)
})
```

### `initializeWebWorker(callback)`

This static method sets up the worker's message listener. When the main thread
sends a layout request, the worker:

1. Deserializes the graph data into a `LayoutGraph`.
2. Passes that graph to your callback.
3. Your callback creates and runs the layout algorithm (`layout.applyLayout(graph)`).
4. The worker serializes the resulting positions and sends them back to the main
   thread.

The callback receives a `LayoutGraph` — a lightweight geometric graph used only
by layout algorithms. The optional second argument is a `LayoutDescriptor` that
can carry algorithm configuration from the main thread, but for a single fixed
algorithm it is simpler to hardcode the choice in the worker.

### The license in the worker

Workers run in a completely separate JavaScript realm — they share no globals,
no module cache, and no yFiles state with the main thread. This means
`License.value` must be set independently in the worker file. Importing the same
`license.json` is fine; Vite bundles it into the worker chunk.

---

## 3. Updating `useGraphBuilder.ts`

In chapter 5 we move the layout to a worker and switch to the async executor.
In Vue, we do this inside our composable.

Key changes:

1. Replace `LayoutExecutor` + `HierarchicalLayout` on the main thread with
   `LayoutExecutorAsync`.
2. Create a `Worker` once for the composable instance.
3. Create a single `LayoutExecutorAsync` bound to that worker and reuse it for
   every layout run.

```ts
// src/useGraphBuilder.ts
import { watch, type Ref } from 'vue'
import { GraphBuilder, GraphComponent, LayoutExecutorAsync, type IGraph } from '@yfiles/yfiles'

function createGraphBuilder(graph: IGraph) {
  const builder = new GraphBuilder(graph)
  // … set up nodesSource and edgesSource (unchanged from chapter 4)
  return { builder, nodesSource, edgesSource }
}

export function useGraphBuilder(graphComponent: GraphComponent, graphData: Ref<GraphData>): void {
  const { builder, nodesSource, edgesSource } = createGraphBuilder(graphComponent.graph)

  // Create the worker once per composable instance
  const worker = new Worker(new URL('./layout.worker.ts', import.meta.url), {
    type: 'module',
  })

  // Create one async executor and reuse it
  const executor = new LayoutExecutorAsync({
    messageHandler: LayoutExecutorAsync.createWebWorkerMessageHandler(worker),
    graphComponent,
    animationDuration: '0.5s',
    animateViewport: true,
  })

  // Update data and start the layout whenever graphData changes
  watch(
    graphData,
    (data) => {
      if (!data) return
      builder.setData(nodesSource, data.nodesSource)
      builder.setData(edgesSource, data.edgesSource)
      builder.updateGraph()
      void executor.start() // reuse the stable executor
    },
    { immediate: true },
  )
}
```

### `LayoutExecutorAsync.createWebWorkerMessageHandler(worker)`

This static method creates a message handler function that routes messages
between `LayoutExecutorAsync` and the `Worker` instance. It abstracts the raw
`postMessage` / `onmessage` wiring into a single call.

```
main thread                            worker thread
─────────────────────────────────────────────────────
LayoutExecutorAsync (reused)           LayoutExecutorAsyncWorker
  .start()                                .initializeWebWorker(callback)
     │                                          │
     │── serialized graph ──── postMessage ──►  │
     │                                          │ callback(graph)
     │                                          │ layout.applyLayout(graph)
     │◄── serialized result ── postMessage ──   │
     │                                          │
  animate transition
```

### Worker URL — `new URL('./layout.worker.ts', import.meta.url)`

The `new URL(…, import.meta.url)` pattern is Vite's (and the browser spec's) way to reference a file for use as a
worker. Vite detects this pattern and:

- Bundles `layout.worker.ts` as a **separate entry point**.
- Emits it as its own JavaScript file in the build output.
- Replaces the `new URL(…)` expression with the correct production URL.

The `{ type: 'module' }` option makes the worker a module worker, enabling ES
module syntax (`import`/`export`) inside the worker file.

### Why we reuse a single executor

`createWebWorkerMessageHandler(worker)` registers a message listener on the
Worker instance. Creating a new `LayoutExecutorAsync` for every layout call would
register multiple competing listeners on the same worker — responses could be
routed to the wrong executor and layouts might hang indefinitely. Create one
executor and reuse it for all runs.

### Worker cleanup

In this tutorial we do not call `worker.terminate()` from the composable. The
worker instance is meant to live as long as the Graph, and the browser will
clean it up when the page unloads. Keeping a stable worker–executor pair avoids
subtle lifecycle issues.

---

## 4. What changed vs chapter 4

| File                     | Change                                                                                                      |
| ------------------------ | ----------------------------------------------------------------------------------------------------------- |
| `src/layout.worker.ts`   | New file — license + `LayoutExecutorAsyncWorker.initializeWebWorker()`                                      |
| `src/useGraphBuilder.ts` | Replaced main‑thread `HierarchicalLayout` with `LayoutExecutorAsync`; added worker + single reused executor |
| Everything else          | Unchanged                                                                                                   |

`HierarchicalLayout` is no longer imported on the main thread — it lives
entirely in the worker. The main thread creates the executor once and calls
`executor.start()` on each data change.

---

## Key concepts

| Concept                                 | Summary                                                                                                                            |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `LayoutExecutorAsync`                   | Main‑thread class that serializes the graph, sends it to the worker, waits for results, and animates the transition.               |
| `LayoutExecutorAsyncWorker`             | Worker‑thread class that receives the serialized graph, calls your layout callback, and returns the result.                        |
| `initializeWebWorker(callback)`         | Sets up the worker's message listener. Your callback receives a `LayoutGraph` and applies the algorithm.                           |
| `createWebWorkerMessageHandler(worker)` | Connects the main‑thread executor to the worker instance. Call this once per worker — multiple calls register competing listeners. |
| `new URL(…, import.meta.url)`           | Vite‑compatible way to reference a worker file; enables correct bundling and URL resolution.                                       |
| `{ type: 'module' }`                    | Enables ES module syntax inside the worker.                                                                                        |
