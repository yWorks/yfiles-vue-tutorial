<template>
  <div v-if="item" class="info-panel">
    <template v-if="isNode">
      You clicked on <strong>&ldquo;{{ nodeName }}&rdquo;</strong>
    </template>
    <template v-else-if="isEdge">
      Connection between
      <strong>&ldquo;{{ sourceName }}&rdquo;</strong>
      and
      <strong>&ldquo;{{ targetName }}&rdquo;</strong>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { IEdge, type IModelItem, INode } from '@yfiles/yfiles'
import type { NodeData } from './types'

// The selected item (node or edge) comes from the parent via a prop.
const props = defineProps<{ item: IModelItem | null }>()

// Check the runtime type of the selected item.
const isNode = computed(() => props.item instanceof INode)
const isEdge = computed(() => props.item instanceof IEdge)

// Helper to show the node's display name.
// We stored our domain data in the node.tag (typed as NodeData),
// so we simply read the name property from there.
const nodeName = computed(() =>
  props.item instanceof INode ? (props.item?.tag as NodeData).name : '',
)

// Access the source and target nodes of edges to read their names from the tag.
const sourceName = computed(() =>
  props.item instanceof IEdge ? (props.item.sourceNode!.tag as NodeData).name : '',
)

const targetName = computed(() =>
  props.item instanceof IEdge ? (props.item.targetNode!.tag as NodeData).name : '',
)
</script>

<style scoped>
.info-panel {
  position: absolute;
  top: 12px;
  left: 12px;
  background: rgba(255, 255, 255, 0.95);
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 8px 12px;
  font-size: 14px;
  pointer-events: none;
  user-select: none;
}
</style>
