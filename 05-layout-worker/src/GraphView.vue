<template>
  <div class="graph-root">
    <div class="graph-component-container" ref="graphComponentContainer"></div>
    <InfoPanel :item="currentItem" />
  </div>
</template>

<script setup lang="ts">
import type { ShallowRef } from 'vue'
import { inject, onMounted, onUnmounted, ref, toRef } from 'vue'
import { ClickEventArgs, Graph, GraphComponent, GraphItemTypes, GraphViewerInputMode, Size } from '@yfiles/yfiles'
import { useGraphBuilder } from './useGraphBuilder'
import InfoPanel from './InfoPanel.vue'
import { createDefaultEdgeStyle, createDefaultLabelStyle } from './styles'
import type { GraphData } from './types'
import { useCurrentItem } from './useCurrentItem'

// Accept graphData as a prop. We wrap it in a ref so our builder can watch changes.
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

// To store the function that clears the current item when the user clicks the canvas.
let clearCurrentItemListener: (evt: ClickEventArgs, sender: GraphViewerInputMode) => void = null!

// Expose a Vue ref that mirrors graphComponent.currentItem
// so the InfoPanel can render details about the selection.
const currentItem = useCurrentItem(graphComponentRef)

// Create and configure the yFiles GraphComponent once the DOM element exists.
onMounted(() => {
  graphComponent = new GraphComponent(graphComponentContainer.value!)
  graphComponentRef.value = graphComponent

  // Set default styles for nodes, edges and labels.
  graphComponent.graph.nodeDefaults.size = new Size(140, 40)
  graphComponent.graph.edgeDefaults.style = createDefaultEdgeStyle()
  graphComponent.graph.nodeDefaults.labels.style = createDefaultLabelStyle()

  // GraphViewerInputMode enables panning, zooming, and item selection,
  // but prevents users from creating or editing graph elements.
  const inputMode = new GraphViewerInputMode({
    focusableItems: GraphItemTypes.NODE | GraphItemTypes.EDGE,
  })
  // Clear the current item when the user clicks the canvas background.
  clearCurrentItemListener = () => {
    graphComponent!.currentItem = null
  }
  inputMode.addEventListener('canvas-clicked', clearCurrentItemListener)
  graphComponent.inputMode = inputMode

  // Initialize the GraphBuilder and keep the graph in sync with the prop data.
  useGraphBuilder(graphComponent, graphDataRef)
})

// Always clean up yFiles resources to avoid memory leaks.
onUnmounted(() => {
  if (graphComponent) {
    const inputMode = graphComponent.inputMode as GraphViewerInputMode
    inputMode.removeEventListener('canvas-clicked', clearCurrentItemListener)
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
.graph-root {
  position: relative;
  width: 100%;
  height: 100%;
}

.graph-component-container {
  width: 100%;
  height: 100%;
}
</style>
