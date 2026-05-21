<template>
  <div class="graph-component-container" ref="graphComponentContainer"></div>
</template>

<script setup lang="ts">
import type { ShallowRef } from 'vue'
import { inject, onMounted, onUnmounted, ref, toRef } from 'vue'
import { Graph, GraphComponent, GraphViewerInputMode, Size } from '@yfiles/yfiles'
import { useGraphBuilder } from './useGraphBuilder'
import type { GraphData } from './types'

// Accept graphData as a plain prop; create a ref for watching updates
const props = defineProps<{ graphData: GraphData }>()
const graphDataRef = toRef(props, 'graphData')

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

  // GraphViewerInputMode enables panning, zooming, and item selection,
  // but prevents users from creating or editing graph elements.
  graphComponent.inputMode = new GraphViewerInputMode()
  graphComponent.graph.nodeDefaults.size = new Size(140, 40)

  // Initialize the GraphBuilder once and keep the graph in sync with graphData.
  useGraphBuilder(graphComponent, graphDataRef)
})

// Always clean up yFiles resources to avoid memory leaks.
onUnmounted(() => {
  if (graphComponent) {
    // Discard the graph and its listeners by replacing it.
    graphComponent.graph = new Graph()
    // Detach the graphComponent from the DOM.
    graphComponent.cleanUp()
    graphComponent = null
    graphComponentRef.value = null
  }
})
</script>

<style scoped>
.graph-component-container {
  width: 100%;
  height: 100%;
}
</style>
