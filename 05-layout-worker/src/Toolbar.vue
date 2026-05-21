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
import type { ShallowRef } from 'vue'
import { inject } from 'vue'
import { Command, GraphComponent } from '@yfiles/yfiles'

// Access the GraphComponent instance that GraphView created.
const graphComponentRef = inject<ShallowRef<GraphComponent | null>>('GraphComponentRef')
if (!graphComponentRef) {
  throw new Error(
    'GraphComponentRef not provided. Did you call provide("GraphComponentRef", ...) in App.vue?',
  )
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
  await graphComponentRef!.value.fitGraphBounds({ animated: true })
}
</script>

<style scoped>
.toolbar {
  padding: 10px;
  display: flex;
  gap: 8px;
  background-color: #f5f5f5;
  border-bottom: 1px solid #ddd;
}
</style>
