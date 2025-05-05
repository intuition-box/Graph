import { FC } from 'react';

export interface GraphVisualizationProps {
  endpoint?: string;
  onNodeSelect?: (node: any) => void;
  onLoadingChange?: (loading: boolean) => void;
}

export interface NodeDetailsSidebarProps {
  selectedNode: any;
  endpoint?: string;
  onClose?: () => void;
}

export interface EndpointSelectorProps {
  endpoints: Record<string, any>;
  selectedEndpoint: string;
  onEndpointChange: (endpoint: string) => void;
}

export const GraphVisualization: FC<GraphVisualizationProps>;
export const GraphVR: FC<GraphVisualizationProps>;
export const NodeDetailsSidebar: FC<NodeDetailsSidebarProps>;
export const GraphLegend: FC;
export const EndpointSelector: FC<EndpointSelectorProps>;
export const LoadingAnimation: FC;

export const ENDPOINTS: Record<string, {
  url: string;
  displayName: string;
  module: any;
}>;

export function fetchTriples(endpoint?: string): Promise<any>;
export function fetchTriplesForNode(nodeId: string, endpoint?: string): Promise<any>;
export function fetchAtomDetails(atomId: string, endpoint?: string): Promise<any>;
export function searchTriples(filters: any, endpoint?: string): Promise<any>; 