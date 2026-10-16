/** React 上下文 / Hook 守卫消息（面向开发者）。 */
export const dev = {
  useSidebar: 'useSidebar 须在 SidebarProvider 内使用。',
  useChart: 'useChart 须在 <ChartContainer /> 内使用。',
  useCarousel: 'useCarousel 须在 <Carousel /> 内使用。',
  useBasisSession: 'useBasisSession 须在 BasisSessionProvider 下使用。',
  useKbCapabilities: 'useKbCapabilities 需要 KbCapabilitiesProvider。',
  useExplorerClient: 'useExplorerClient 需要 ExplorerProvider。',
  useKbCatalog: 'useKbCatalog 须在 KbProvider 下使用。',
} as const;
