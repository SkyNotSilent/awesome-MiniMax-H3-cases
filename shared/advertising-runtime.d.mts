export interface AdvertisingRuntime {
  mount(wrapper: HTMLElement): () => void
  privacy(button: HTMLElement): Promise<void>
  mountStatic(): void
}
export function createAdvertisingRuntime(view: Window): AdvertisingRuntime
