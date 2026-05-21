import { type Ref, watch } from 'vue'
import { GraphBuilder, GraphComponent, HierarchicalLayout, type IGraph } from '@yfiles/yfiles'
import type { EdgeData, GraphData, NodeData } from './types'

// ---------------------------------------------------------------------------
// Builder factory
// ---------------------------------------------------------------------------
function createGraphBuilder(graph: IGraph) {
  const builder = new GraphBuilder(graph)

  // createNodesSource tells the builder:
  //  - which array to read nodes from (starts empty here)
  //  - how to derive a stable ID from each data item (used to match
  //    items across updateGraph() calls without rebuilding from scratch)
  const nodesSource = builder.createNodesSource<NodeData>({
    data: [] as NodeData[],
    id: (item) => item.id,
  })

  // createLabelBinding maps a data property to the node's visible label.
  nodesSource.nodeCreator.createLabelBinding((item) => item.name)

  // createEdgesSource tells the builder which array holds edge data and
  // how to resolve source/target node IDs from each edge data item.
  const edgesSource = builder.createEdgesSource<EdgeData>({
    data: [] as EdgeData[],
    sourceId: (item) => item.fromNode,
    targetId: (item) => item.toNode,
  })

  return { builder, nodesSource, edgesSource }
}

// ---------------------------------------------------------------------------
// Layout helper
// ---------------------------------------------------------------------------
async function applyLayout(graphComponent: GraphComponent): Promise<void> {
  await graphComponent.applyLayoutAnimated(new HierarchicalLayout())
}

/**
 * Keeps the graph in sync with `graphData`.
 *
 * - Creates a GraphBuilder once per call (typically onMounted).
 * - Watches the provided graphData ref and updates the graph when it changes.
 * - Applies an animated layout after each update.
 */
export function useGraphBuilder(graphComponent: GraphComponent, graphData: Ref<GraphData>): void {
  // Create the builder tied to this graph instance once per composable call.
  const { builder, nodesSource, edgesSource } = createGraphBuilder(graphComponent.graph)

  // Watch the data source. Prefer replacing arrays/objects to trigger updates.
  watch(
    graphData,
    (data) => {
      if (!data) {
        return
      }
      // Replace the data on each source …
      builder.setData(nodesSource, data.nodesSource)
      builder.setData(edgesSource, data.edgesSource)

      // … then reconcile the graph with the new data.
      builder.updateGraph()
      void applyLayout(graphComponent)
    },
    { immediate: true },
  )
}
