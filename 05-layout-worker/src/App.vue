<template>
  <div id="app">
    <div class="topbar">
      <Toolbar />
      <span class="divider" />
      <button type="button" @click="addService">Add Service</button>
      <button type="button" @click="reset">Reset</button>
    </div>
    <graph-view :graphData="graphData" />
  </div>
</template>

<script setup lang="ts">
import { provide, ref, shallowRef } from 'vue'
import Toolbar from './Toolbar.vue'
import GraphView from './GraphView.vue'
import { GraphComponent, License } from '@yfiles/yfiles'
import type { GraphData, NodeData } from './types'
import initialGraphData from './graph-data.json'
import licenseData from './license.json'

// Load the yFiles license before using any yFiles API.
License.value = licenseData

// Provide a shallowRef that will hold the yFiles GraphComponent instance.
// Using shallowRef prevents Vue from making the instance reactive while still
// allowing consumers to watch for assignment/nulling of the reference.
const graphComponentRef = shallowRef<GraphComponent | null>()
provide('GraphComponentRef', graphComponentRef)

// App owns the graph data state and passes it down as a Ref
const graphData = ref<GraphData>(initialGraphData as GraphData)

function addService() {
  const current = graphData.value
  const ids = current.nodesSource.map((n) => n.id)
  const maxId = ids.length ? Math.max(...ids) : 0
  const newId = maxId + 1
  const newNode: NodeData = { id: newId, name: `Service ${newId}`, type: 'service' }

  graphData.value = {
    nodesSource: [...current.nodesSource, newNode],
    // Connect the new service to the API Gateway (id 2) and the Database (id 6)
    edgesSource: [
      ...current.edgesSource,
      { fromNode: 2, toNode: newId },
      { fromNode: newId, toNode: 6 },
    ],
  }
}

function reset() {
  graphData.value = initialGraphData as GraphData
}
</script>

<style scoped>
#app {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

.topbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  background: #f5f5f5;
  border-bottom: 1px solid #ddd;
}

.divider {
  width: 1px;
  height: 24px;
  background: #ccc;
}
</style>
