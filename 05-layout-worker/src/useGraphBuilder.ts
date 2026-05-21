import { type Ref, watch } from 'vue'
import { GraphBuilder, GraphComponent, type IGraph, LayoutExecutorAsync } from '@yfiles/yfiles'
import type { EdgeData, GraphData, NodeData } from './types'
import { getNodeStyle } from './styles'

function createGraphBuilder(graph: IGraph) {
  const builder = new GraphBuilder(graph)

  const nodesSource = builder.createNodesSource<NodeData>([] as NodeData[], (item) => item.id)

  nodesSource.nodeCreator.createLabelBinding((item) => item.name)
  nodesSource.nodeCreator.tagProvider = (item) => item
  nodesSource.nodeCreator.styleProvider = (item) => getNodeStyle(item.type)

  const edgesSource = builder.createEdgesSource<EdgeData>(
    [] as EdgeData[],
    (item) => item.fromNode,
    (item) => item.toNode,
  )
  edgesSource.edgeCreator.tagProvider = (item) => item

  return { builder, nodesSource, edgesSource }
}

export function useGraphBuilder(graphComponent: GraphComponent, graphData: Ref<GraphData>): void {
  const { builder, nodesSource, edgesSource } = createGraphBuilder(graphComponent.graph)

  // Create the worker once per composable instance.
  const worker = new Worker(new URL('./layout.worker.ts', import.meta.url), {
    type: 'module',
  })

  // Create the async layout executor once and reuse it for every layout run.
  const executor = new LayoutExecutorAsync({
    messageHandler: LayoutExecutorAsync.createWebWorkerMessageHandler(worker),
    graphComponent,
    animationDuration: '0.5s',
    animateViewport: true,
  })

  watch(
    graphData,
    (data) => {
      if (!data) return
      builder.setData(nodesSource, data.nodesSource)
      builder.setData(edgesSource, data.edgesSource)
      builder.updateGraph()
      // Reuse the stable executor — no new instance per call.
      void executor.start()
    },
    { immediate: true },
  )
}
