import type { Canvas } from 'fabric'
import type { EditorContext, EditorLifecyclePhase, EditorRuntimeServices } from './editorTypes'

export interface CreateEditorContextOptions {
  services?: Partial<EditorRuntimeServices>
}

export interface EditorContextController extends EditorContext {
  setPhase: (nextPhase: EditorLifecyclePhase) => void
}

/**
 * 创建编辑器模块共享上下文，集中保存运行时阶段和 Fabric Canvas 引用。
 * 后续模块通过该上下文访问基础服务，避免继续从页面顶层变量隐式串联生命周期资源。
 */
export function createEditorContext(options: CreateEditorContextOptions = {}): EditorContextController {
  let canvas: Canvas | null = null
  let phase: EditorLifecyclePhase = 'created'
  const services: EditorRuntimeServices = {
    window,
    logger: console,
    ...options.services
  }

  return {
    services,
    getCanvas: () => canvas,
    setCanvas: (nextCanvas) => { canvas = nextCanvas },
    getPhase: () => phase,
    setPhase: (nextPhase) => { phase = nextPhase }
  }
}
