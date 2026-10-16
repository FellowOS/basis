/** React context / hook guard messages (developer-facing). */
export const dev = {
  useSidebar: 'useSidebar must be used within a SidebarProvider.',
  useChart: 'useChart must be used within a <ChartContainer />',
  useCarousel: 'useCarousel must be used within a <Carousel />',
  useBasisSession: 'useBasisSession must be used under BasisSessionProvider',
  useKbCapabilities: 'useKbCapabilities requires KbCapabilitiesProvider',
  useExplorerClient: 'useExplorerClient requires ExplorerProvider',
  useKbCatalog: 'useKbCatalog must be used under KbProvider',
} as const;
