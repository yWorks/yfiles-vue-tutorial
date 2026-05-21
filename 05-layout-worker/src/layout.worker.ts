import { HierarchicalLayout, LayoutExecutorAsyncWorker, License } from '@yfiles/yfiles'
import licenseData from './license.json'

// Workers run in a separate JS context and do not share globals with the main thread.
// The yFiles license must be registered here, too.
License.value = licenseData

// Wire up the worker to receive layout requests from the main thread.
// The callback is given a LayoutGraph; we create and run the algorithm on it.
LayoutExecutorAsyncWorker.initializeWebWorker((graph) => {
  const layout = new HierarchicalLayout()
  layout.applyLayout(graph)
})
