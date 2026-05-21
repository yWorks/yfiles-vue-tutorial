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
// Using shallowRef prevents Vue from making the instance reactive while still
// allowing consumers to watch for assignment/nulling of the reference.
const graphComponentRef = shallowRef<GraphComponent | null>()
provide('GraphComponentRef', graphComponentRef)
</script>
