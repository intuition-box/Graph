import React, { useEffect, useRef } from "react";
import GraphLegend from "./GraphLegend";
import GraphVR from "./GraphVR";
import NodeDetailsSidebar from "./NodeDetailsSidebar";
import LoadingAnimation from "./LoadingAnimation";
import FilterBar from "./FilterBar";
import Graph2D from "./Graph2D";
import Graph3D from "./Graph3D";
import NavigationBar from "./NavigationBar";
import ViewModeSelector from "./ViewModeSelector";
import { useGraphState } from "./hooks/useGraphState";

const GraphVisualization = ({ endpoint }) => {
  const fgRef = useRef();
  const [viewMode, setViewMode] = React.useState("2D");

  const {
    graphData,
    isInitialLoad,
    selectedTriple,
    showCreators,
    isLoading,
    isSearching,
    subjectFilter,
    predicateFilter,
    objectFilter,
    shouldSearch,
    canGoBack,
    canGoForward,
    setShowCreators,
    setSelectedTriple,
    setIsInitialLoad,
    loadInitialData,
    resetGraph,
    handleNodeClick,
    handleFilterChange,
    applyFilters,
    goBack,
    goForward,
  } = useGraphState(endpoint);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  useEffect(() => {
    if (shouldSearch) {
      applyFilters();
    }
  }, [shouldSearch, applyFilters]);

  const handleEngineStop = () => {
    if (isInitialLoad && fgRef.current) {
      setIsInitialLoad(false);
    }
  };

  return (
    <div>
      {(isLoading || isSearching) && <LoadingAnimation />}

      <NavigationBar
        onReset={resetGraph}
        onBack={goBack}
        onForward={goForward}
        canGoBack={canGoBack}
        canGoForward={canGoForward}
      />

      <div
        className="agent-navbar"
        style={{
          position: "absolute",
          top: "10px",
          right: "10px",
          zIndex: 10,
        }}
      >
        <ViewModeSelector
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          showCreators={showCreators}
          onShowCreatorsChange={setShowCreators}
        />

        <FilterBar
          subjectFilter={subjectFilter}
          predicateFilter={predicateFilter}
          objectFilter={objectFilter}
          onFilterChange={handleFilterChange}
          onReset={resetGraph}
        />
      </div>

      {viewMode === "2D" && (
        <Graph2D
          graphData={graphData}
          onNodeClick={(node) => handleNodeClick(node, fgRef, viewMode)}
          onEngineStop={handleEngineStop}
          fgRef={fgRef}
        />
      )}

      {viewMode === "3D" && (
        <Graph3D
          graphData={graphData}
          onNodeClick={(node) => handleNodeClick(node, fgRef, viewMode)}
          onEngineStop={handleEngineStop}
          fgRef={fgRef}
        />
      )}

      {viewMode === "VR" && (
        <GraphVR
          graphData={graphData}
          onNodeClick={(node) => handleNodeClick(node, fgRef, viewMode)}
          onBack={goBack}
          onForward={goForward}
          selectedTriple={selectedTriple}
        />
      )}

      <GraphLegend showCreators={showCreators} />

      {selectedTriple && (
        <NodeDetailsSidebar
          triple={selectedTriple}
          endpoint={endpoint}
          onClose={() => setSelectedTriple(null)}
        />
      )}
    </div>
  );
};

export default GraphVisualization;
