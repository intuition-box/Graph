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
import Drawer from "./components/Drawer";
import SidebarDrawer from "./components/SidebarDrawer";
import { fetchClaimsByAccount, fetchTriplesByCreator } from "./api";
import ClaimCard from "./components/ClaimCard";
import PositionCard from "./components/PositionCard";

const ACCOUNT_ID = "0xddfff342ce2547338b0f689aa3ec86893340fbdf";

const GraphVisualization = ({ endpoint }) => {
  const fgRef = useRef();
  const [viewMode, setViewMode] = React.useState("2D");
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState(null);
  const [filtersOpen, setFiltersOpen] = React.useState(false);
  const [claims, setClaims] = React.useState([]);
  const [positions, setPositions] = React.useState([]);

  const {
    graphData,
    isInitialLoad,
    selectedTriple,
    isLoading,
    isSearching,
    subjectFilter,
    objectFilter,
    shouldSearch,
    canGoBack,
    canGoForward,
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

  // Charger les claims quand le drawer claims s'ouvre
  React.useEffect(() => {
    if (drawerOpen && activeTab === "claims") {
      fetchClaimsByAccount(ACCOUNT_ID, endpoint).then(setClaims);
    }
  }, [drawerOpen, activeTab, endpoint]);

  // Charger les positions quand le drawer positions s'ouvre
  React.useEffect(() => {
    if (drawerOpen && activeTab === "positions") {
      fetchTriplesByCreator(ACCOUNT_ID, endpoint).then(setPositions);
    }
  }, [drawerOpen, activeTab, endpoint]);

  return (
    <div>
      {(isLoading || isSearching) && <LoadingAnimation />}

      <NavigationBar
        onReset={resetGraph}
        onBack={goBack}
        onForward={goForward}
        canGoBack={canGoBack}
        canGoForward={canGoForward}
        onMyView={() => {
          setSidebarOpen(true);
        }}
      />

      <div
        className="agent-navbar"
        style={{
          position: "absolute",
          top: "10px",
          right: "10px",
          zIndex: 10,
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          gap: "16px",
        }}
      >
        {!filtersOpen && (
          <button
            style={{
              background: "#ffd32a",
              color: "#18181b",
              border: "none",
              borderRadius: 12,
              width: 120,
              height: 40,
              fontSize: 15,
              fontWeight: "bold",
              boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
              cursor: "pointer",
              textTransform: "uppercase",
              marginLeft: 12,
              transition: "background 0.2s, color 0.2s, transform 0.1s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#ffe066")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#ffd32a")}
            onClick={() => setFiltersOpen((open) => !open)}
          >
            Filters
          </button>
        )}
        {filtersOpen && (
          <div
            style={{
              marginLeft: 12,
              display: "flex",
              alignItems: "center",
              gap: 16,
              position: "relative",
            }}
          >
            <ViewModeSelector
              viewMode={viewMode}
              onViewModeChange={setViewMode}
            />
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-end",
                position: "relative",
              }}
            >
              <button
                onClick={() => setFiltersOpen(false)}
                style={{
                  position: "absolute",
                  top: -20,
                  right: -16,
                  background: "none",
                  border: "none",
                  color: "#ffd32a",
                  fontSize: 20,
                  cursor: "pointer",
                  zIndex: 2,
                  padding: 0,
                  lineHeight: 1,
                  width: 24,
                  height: 24,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                aria-label="Fermer les filtres"
              >
                ×
              </button>
              <FilterBar
                subjectFilter={subjectFilter}
                objectFilter={objectFilter}
                onFilterChange={handleFilterChange}
                onReset={resetGraph}
              />
            </div>
          </div>
        )}
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

      <GraphLegend />

      {selectedTriple && (
        <NodeDetailsSidebar
          triple={selectedTriple}
          endpoint={endpoint}
          onClose={() => setSelectedTriple(null)}
        />
      )}

      <SidebarDrawer open={sidebarOpen} onClose={() => setSidebarOpen(false)}>
        <h2>Mon Profil</h2>
        <p>Nom : Utilisateur de base</p>
        <p>Email : user@email.com</p>
        <p>Rôle : Joueur</p>
        <button
          style={{
            background: "#ffd32a",
            color: "#18181b",
            border: "none",
            borderRadius: 8,
            padding: "10px 18px",
            fontWeight: "bold",
            marginTop: 20,
            cursor: "pointer",
          }}
          onClick={() => setSidebarOpen(false)}
        >
          Fermer
        </button>
      </SidebarDrawer>

      {/* Barre de navigation en bas façon tabs */}
      <div
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 2000,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: 36,
          padding: "0 0 4px 0",
          height: 54,
        }}
      >
        {[
          { key: null, label: "Map" },
          { key: "connections", label: "Connections" },
          { key: "positions", label: "Positions" },
          { key: "claims", label: "Claims" },
          { key: "activity", label: "Activity" },
        ].map((tab) => (
          <div
            key={tab.key || "map"}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              cursor: "pointer",
              minWidth: 120,
            }}
            onClick={() => {
              setActiveTab(tab.key);
              setDrawerOpen(!!tab.key);
            }}
          >
            <span
              style={{
                color: activeTab === tab.key ? "#ffd32a" : "#fff",
                fontWeight: activeTab === tab.key ? "bold" : "normal",
                fontSize: 17,
                letterSpacing: 0.5,
                padding: "8px 0 2px 0",
                transition: "color 0.2s, font-weight 0.2s",
              }}
            >
              {tab.label}
            </span>
            <div
              style={{
                height: 3,
                width: "80%",
                background: activeTab === tab.key ? "#ffd32a" : "transparent",
                borderRadius: 2,
                transition: "background 0.2s",
              }}
            />
          </div>
        ))}
      </div>
      <Drawer
        open={!!drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setActiveTab(null);
        }}
      >
        {activeTab === "claims" && (
          <>
            <h2>Claims</h2>
            {claims.length === 0 ? (
              <p style={{ color: "#fff" }}>Aucun claim trouvé.</p>
            ) : (
              <div>
                {claims.map((claim) => (
                  <ClaimCard key={claim.id} claim={claim} />
                ))}
              </div>
            )}
          </>
        )}
        {activeTab === "positions" && (
          <>
            <h2>Positions</h2>
            {positions.length === 0 ? (
              <p style={{ color: "#fff" }}>Aucune position trouvée.</p>
            ) : (
              <div>
                {positions.map((position) => (
                  <PositionCard key={position.id} position={position} />
                ))}
              </div>
            )}
          </>
        )}
        {activeTab === "activity" && (
          <>
            <h2>Activity</h2>
            <p>Contenu activity ici...</p>
          </>
        )}
        {activeTab === "connections" && (
          <>
            <h2>Connections</h2>
            <p>Contenu connections ici...</p>
          </>
        )}
      </Drawer>
    </div>
  );
};

export default GraphVisualization;
