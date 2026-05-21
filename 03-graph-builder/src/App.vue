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

<style scoped>
.toolbar {
  padding: 10px;
  display: flex;
  gap: 10px;
  background-color: #f5f5f5;
  border-bottom: 1px solid #ddd;
}
</style>
