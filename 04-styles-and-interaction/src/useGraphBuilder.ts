import { type Ref, watch } from 'vue'
import { GraphBuilder, GraphComponent, HierarchicalLayout, type IGraph } from '@yfiles/yfiles'
import type { EdgeData, GraphData, NodeData } from './types'
import { getNodeStyle } from './styles'

// ---------------------------------------------------------------------------
// Builder factory
// ---------------------------------------------------------------------------
function createGraphBuilder(graph: IGraph) {
  const builder = new GraphBuilder(graph)

  const nodesSource = builder.createNodesSource<NodeData>({
    data: [] as NodeData[],
    id: (item) => item.id,
  })

  nodesSource.nodeCreator.createLabelBinding((item: NodeData) => item.name)

  // styleProvider is called once per data item when a node is created,
  // and again on updateGraph() if the item's data has changed.
  // It receives the full data item and returns a complete style instance.
  // Returning a new instance each time ensures nodes never share style objects.
  nodesSource.nodeCreator.styleProvider = (item: NodeData) => getNodeStyle(item.type)

  const edgesSource = builder.createEdgesSource<EdgeData>({
    data: [] as EdgeData[],
    sourceId: (item) => item.fromNode,
    targetId: (item) => item.toNode,
  })

  // Store the entire data item, making every field accessible from node.tag and edge.tag later.
  nodesSource.nodeCreator.tagProvider = (item: NodeData) => item
  edgesSource.edgeCreator.tagProvider = (item: EdgeData) => item

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
  const { builder, nodesSource, edgesSource } = createGraphBuilder(graphComponent.graph)

  // React to changes of the provided graph data and mirror them into the graph.
  watch(
    graphData,
    (data: GraphData) => {
      if (!data) return
      // Bind incoming arrays to the existing sources and apply to the graph.
      builder.setData(nodesSource, data.nodesSource)
      builder.setData(edgesSource, data.edgesSource)
      builder.updateGraph()
      // Re-run a layout so the new structure is easy to read.
      void applyLayout(graphComponent)
    },
    { immediate: true },
  )
}
