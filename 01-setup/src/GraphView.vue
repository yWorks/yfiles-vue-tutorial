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
  if (graphComponent) {
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
