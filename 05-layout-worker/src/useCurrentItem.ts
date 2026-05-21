import { onUnmounted, type Ref, ref, type ShallowRef, watch } from 'vue'
import { GraphComponent, type IModelItem } from '@yfiles/yfiles'

/**
 * Vue composable: exposes a reactive ref that mirrors yFiles GraphComponent.currentItem.
 */
export function useCurrentItem(graphComponentRef: ShallowRef<GraphComponent | null>):Ref<IModelItem | null> {
  const currentItemRef:Ref<IModelItem | null> = ref(null)

  function listener() {
    const graphComponent = graphComponentRef.value
    currentItemRef.value = graphComponent?.currentItem ?? null
  }

  function subscribe(graphComponent: GraphComponent | null) {
    if (!graphComponent) {
      currentItemRef.value = null
      return
    }
    currentItemRef.value = graphComponent.currentItem
    graphComponent.addEventListener('current-item-changed', listener)
  }

  function unsubscribe(graphComponent: GraphComponent | null) {
    if (graphComponent) graphComponent.removeEventListener('current-item-changed', listener)
  }

  watch(graphComponentRef, (newGraphComponent, oldGraphComponent) => {
    if (oldGraphComponent !== newGraphComponent) {
      unsubscribe(oldGraphComponent)
      subscribe(newGraphComponent)
    }
  })

  onUnmounted(() => unsubscribe(graphComponentRef.value))
  return currentItemRef
}
