# Chapter 1: Setting Up a Vue Project with yFiles

## What you'll build

A minimal Vue application that renders an empty yFiles graph canvas:

```
┌────────────────────────────────────────────────────────────┐
│                                                            │
│                   (empty graph canvas)                     │
│                                                            │
│                    scroll • zoom • pan                     │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

It uses Vue's **deoendency injection system (`provide` / `inject`)** that all subsequent chapters build on.

No data yet — but the canvas will be fully interactive. You'll be able to pan the canvas by dragging and zoom using the
mouse wheel. That comes "for free" with yFiles.

---

## Prerequisites

- Node.js 18+ and npm
- A yFiles for HTML license (a `.tgz` package file and a `license.json` file). If you are evaluating yFiles, download
  the evaluation package from the [yWorks Customer Center](https://my.yworks.com/).

---

## 1. Scaffold the project

Create a new Vite project with the Vue TypeScript template:

```
npm create vite@latest my-yfiles-app -- --template vue-ts
cd my-yfiles-app
```

The generated project gives you a standard Vue + TypeScript setup. You can delete the boilerplate content from
`src/App.vue` and `src/components/` — we will replace them entirely.

---

## 2. Install yFiles

yFiles for HTML is distributed as a local npm package, a `.tgz` file. See the [Working with the yFiles npm Module](https://docs.yworks.com/yfileshtml/dguide/yfiles_npm_module/) Developer's Guide section for in-depth information.

If the yFiles dependency has not been set up yet using the toplevel npm workspace, install it:

```shell
# Enter the correct path to your yFiles tgz found in your extracted yFiles for HTML package
npm install ./path/to/yfiles-<yFilesVersion>+dev.tgz
```

Here, we use the development version of the library. Again, the Developer's Guide provides more in-depth information in the [Development Mode](https://docs.yworks.com/yfileshtml/dguide/yfiles_development_mode/) chapter.

After installation, the yFiles TypeScript types are available in `node_modules`
and autocompletion works in your IDE just like any other npm package.

---

## 3. The yFiles license

yFiles requires a valid license at runtime. Without one, the library will throw an error before rendering anything.

The tutorial apps expect the `license.json` in the `src` folder.

The license is loaded by assigning it to `License.value` **before** any other yFiles API is called:

```ts
// src/App.vue
import { License } from '@yfiles/yfiles'
import licenseData from './license.json'

License.value = licenseData
```

See also the Developer's Guide section on [Licensing](https://docs.yworks.com/yfileshtml/dguide/licensing/)

---

## 4. The [`GraphComponent`](https://docs.yworks.com/yfileshtml/api/GraphComponent/)

`GraphComponent` is the central UI element in yFiles. It is **not** a Vue
component. yFiles uses its own rendering engine rather than
Vue's virtual DOM.

This means you need to bridge the two worlds: let Vue manage a container
`<div>`, and let yFiles own a child element inside it.

Rather than creating the `GraphComponent` inside a single component, we use
the **dependency injection system** so any component in the tree can access it.
This architecture scales naturally as the app grows and is the pattern all
subsequent chapters build on.

---

## 4. Setting Up the Application Shell

Before we create the GraphView component itself, let's set up its home in `App.vue`.

A key challenge in a component-based application is sharing state or object instances. For example, a toolbar component
might need to access the main GraphView component to trigger actions like "zoom to fit".

To solve this without passing props down through many layers ("prop-drilling"), we'll use Vue's dependency injection
system: `provide` and `inject`.

We will `provide` a shared reference from our top-level `App.vue` component. Any descendant component can then `inject`
this reference to get access to the `GraphComponent` instance once it's created.

```vue
<!-- src/App.vue -->
<template>
  <div id="app">
    <graph-view />
  </div>
</template>

<script setup lang="ts">
import { provide, shallowRef } from 'vue'
import GraphView from './GraphView.vue'
import { GraphComponent, License } from '@yfiles/yfiles'
import licenseData from './license.json'

// Load the yFiles license before using any yFiles API.
License.value = licenseData

// Provide a shallowRef that will hold the yFiles GraphComponent instance.
// We create the actual instance inside GraphView.vue once the container DOM exists.
const graphComponentRef = shallowRef<GraphComponent | null>()
provide('GraphComponentRef', graphComponentRef)
</script>
```

In this step, we've prepared `App.vue` to host our `<graph-view>` and to provide a shared `graphComponentRef` to
it and any other future components.

### Why a `shallowRef`?

We'll use a `shallowRef` to hold the `GraphComponent` instance. Here’s why:

- Reactivity: It allows components to react when the `GraphComponent` is created (the ref goes from `null` to an
  instance) or destroyed (it goes back to `null`).
- Performance: `GraphComponent` is a large, complex class with its own internal state. A regular `ref` would try to make
  this entire object deeply reactive, which is unnecessary and inefficient. A `shallowRef` only tracks changes to its
  `.value` property, which is perfect for our needs.

---

## 5. Creating the Bridge: The `GraphView`

In the current code, we provide a `shallowRef` from `App.vue` that will hold the `GraphComponent` instance. The bridge
component (`GraphView.vue`) injects that ref, creates the `GraphComponent` in `onMounted` when the container DOM
element exists, assigns it to the shared ref, and cleans it up on unmount. This keeps the instance lifecycle coupled to
the component that owns the DOM container while still making it accessible to other components (e.g., a toolbar).

```vue
<!-- src/GraphView.vue -->
<template>
  <div class="graph-component-container" ref="graphComponentContainer"></div>
</template>

<script setup lang="ts">
import type { ShallowRef } from 'vue'
import { inject, onMounted, onUnmounted, ref } from 'vue'
import { GraphComponent } from '@yfiles/yfiles'

// Get the provided shallowRef from App.vue so other components can react
// when the GraphComponent becomes available or is disposed again.
const graphComponentRef = inject<ShallowRef<GraphComponent | null>>('GraphComponentRef')
if (!graphComponentRef) {
  throw new Error(
    'GraphComponentRef not provided. Did you call provide("GraphComponentRef", ...) in App.vue?',
  )
}

// Template ref: will point to the graph-component-container div once the component is mounted.
const graphComponentContainer = ref<HTMLDivElement>()
let graphComponent: GraphComponent | null = null

// Create the yFiles GraphComponent after the DOM element exists.
onMounted(() => {
  graphComponent = new GraphComponent(graphComponentContainer.value!)
  graphComponentRef.value = graphComponent
})

// Always clean up yFiles resources to avoid memory leaks.
onUnmounted(() => {
  graphComponent?.cleanUp()
  graphComponent.graph.clear()
  graphComponent = null
  graphComponentRef.value = null
})
</script>

<style scoped>
.graph-component-container {
  width: 100%;
  height: 100%;
}
</style>
```

### Breakdown of `GraphView.vue`

- Provided ref: `App.vue` provides a `shallowRef<GraphComponent | null>` that will hold the instance.
  `GraphView.vue` is responsible for creating the `GraphComponent` when mounted.
- `inject('GraphComponentRef')`: Retrieves the shared ref created in `App.vue`. After creating the instance, we assign
  it to `graphComponentRef.value`.
- Template ref (`ref="graphComponentContainer"`): References the container `<div>` in which yFiles will render.
- `onMounted`: Creates `new GraphComponent(graphComponentContainer.value!)` once the DOM exists and stores it in the
  shared ref.
- `onUnmounted`: Calls `cleanUp()`, clears the graph, removes references, and sets the shared ref back
  to `null` to release resources and listeners.

---

## 6. Run it

```
npm run dev
```

Open `http://localhost:5173`. You should see a blank white canvas. Try panning (click and drag) and zooming (scroll
wheel) — yFiles enables both by default.

---

## Key Concepts

| Concept              | Summary                                                                                                      |
| -------------------- | ------------------------------------------------------------------------------------------------------------ |
| `License.value`      | Must be set before any yFiles API call.                                                                      |
| `GraphComponent`     | The main yFiles UI control. It's an imperative class, not a Vue component.                                   |
| `ref="elementName"`  | Vue's template ref. Creates a direct reference to a DOM element in the template.                             |
| `onMounted`          | A Vue lifecycle hook. We use it to create the `GraphComponent` because it guarantees the DOM element exists. |
| `cleanUp()`          | Releases yFiles resources. Call it in `onUnmounted` to prevent memory leaks.                                 |
| `provide` / `inject` | Vue's dependency injection system to make an instance available to descendant components.                    |

---

## Next chapter

[Chapter 2: Displaying a Graph →](../02-first-graph/README.md)

In the next chapter we'll use the `IGraph` API to create nodes and edges
programmatically inside a `GraphComponent`, and apply a layout algorithm to
arrange them automatically.
