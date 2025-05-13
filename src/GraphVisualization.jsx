import React, { useEffect, useRef, useState } from "react";
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
import { fetchClaimsByAccount, fetchTriplesByCreator, searchTriples } from "./api";
import ClaimCard from "./components/ClaimCard";
import PositionCard from "./components/PositionCard";
import SmartSearchInterface from "./components/SmartSearchInterface";
import { transformToGraphData } from "./graphData";
import ChatBox from "./components/ChatBox";

const ACCOUNT_ID = "0xddfff342ce2547338b0f689aa3ec86893340fbdf";
const AGENT_OBJECT_ID = 24537; // À remplacer par l'ID réel de l'agent

const GraphVisualization = ({ endpoint, walletAddress }) => {
  const fgRef = useRef();
  const containerRef = useRef();
  const [viewMode, setViewMode] = React.useState("2D");
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState(null);
  const [filtersOpen, setFiltersOpen] = React.useState(false);
  const [claims, setClaims] = React.useState([]);
  const [positions, setPositions] = React.useState([]);
  const [isSmartSearching, setIsSmartSearching] = useState(false);
  const [isLocalSearching, setIsSearching] = useState(false);
  const [useLocalData, setUseLocalData] = useState(false);
  const [localGraphData, setLocalGraphData] = useState(null);
  const [graphType, setGraphType] = React.useState("agent");

  const {
    graphData: hookGraphData,
    isInitialLoad,
    selectedTriple,
    isLoading,
    isSearching: hookIsSearching,
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
    setGraphData: hookSetGraphData,
    graphHistory,
    setGraphHistory,
    currentHistoryIndex,
    setCurrentHistoryIndex
  } = useGraphState(endpoint, graphType);

  const graphData = useLocalData && localGraphData ? localGraphData : hookGraphData;
  const isSearchingActive = isLocalSearching || hookIsSearching;

  useEffect(() => {
    console.log("GraphData updated:", graphData);
  }, [graphData]);
  
  useEffect(() => {
    loadInitialData();
  }, [loadInitialData, graphType]);

  useEffect(() => {
    if (shouldSearch) {
      setUseLocalData(false);
      applyFilters();
    }
  }, [shouldSearch, applyFilters]);

  const handleEngineStop = () => {
    if (isInitialLoad && fgRef.current) {
      setIsInitialLoad(false);
    }
  };

  React.useEffect(() => {
    if (drawerOpen && activeTab === "claims") {
      fetchClaimsByAccount(ACCOUNT_ID, endpoint).then(setClaims);
    }
  }, [drawerOpen, activeTab, endpoint]);

  React.useEffect(() => {
    if (drawerOpen && activeTab === "positions") {
      fetchTriplesByCreator(ACCOUNT_ID, endpoint).then(setPositions);
    }
  }, [drawerOpen, activeTab, endpoint]);

  const handleSearch = async (results) => {
    console.log("Search results received:", results);
    
    try {
      if (results && results.length > 0) {
        if (graphHistory && setGraphHistory && typeof setGraphHistory === 'function') {
          setGraphHistory((prevHistory) => {
            const updatedHistory = prevHistory.slice(0, currentHistoryIndex + 1);
            updatedHistory.push({ graphData, selectedTriple: null });
            return updatedHistory;
          });
          
          if (typeof setCurrentHistoryIndex === 'function') {
            setCurrentHistoryIndex((prevIndex) => prevIndex + 1);
          }
        }
        
        const newGraphData = transformToGraphData(results);
        console.log("New graph data created:", newGraphData);
        
        setLocalGraphData(newGraphData);
        setUseLocalData(true);
        console.log("Graph data updated");
      } else {
        console.log("No results found");
        setLocalGraphData({ nodes: [], links: [] });
        setUseLocalData(true);
      }
    } catch (error) {
      console.error("Error in handleSearch:", error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearchStart = () => {
    console.log("Search starting...");
    setIsSearching(true);
  };

  const handleFullReset = () => {
    setUseLocalData(false);
    resetGraph();
  };

  const handleSimpleFilterChange = (type, value) => {
    setUseLocalData(false);
    handleFilterChange(type, value);
  };

  const handleAfterSmartSearch = () => {
    if (useLocalData) {
      setUseLocalData(false);
    }
  };

  const tabs = [
    { key: null, label: "Map" },
    { key: "connections", label: "Connections" },
    { key: "positions", label: "Positions" },
    { key: "claims", label: "Claims" },
    { key: "activity", label: "Activity" },
  ];

  const handleTabChange = (tabKey) => {
    setActiveTab(tabKey);
    setDrawerOpen(!!tabKey);
  };

  const getDrawerContent = () => {
    switch (activeTab) {
      case "claims":
        return (
          <>
            <h2>Claims</h2>
            {claims.length === 0 ? (
              <p style={{ color: "#fff" }}>No claims found.</p>
            ) : (
              <div>
                {claims.map((claim) => (
                  <ClaimCard key={claim.id} claim={claim} />
                ))}
              </div>
            )}
          </>
        );
      case "positions":
        return (
          <>
            <h2>Positions</h2>
            {positions.length === 0 ? (
              <p style={{ color: "#fff" }}>No positions found.</p>
            ) : (
              <div>
                {positions.map((position) => (
                  <PositionCard key={position.id} position={position} />
                ))}
              </div>
            )}
          </>
        );
      case "activity":
        return (
          <>
            <h2>Activity</h2>
            <p>Activity content here...</p>
          </>
        );
      case "connections":
        return (
          <>
            <h2>Connections</h2>
            <p>Connections content here...</p>
          </>
        );
      default:
        return null;
    }
  };

  // Contenu du sidebar
  const sidebarContent = (
    <>
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
    </>
  );

  // Composant de sélection du type de graphique
  const GraphTypeSelector = () => (
    <div 
      style={{
        display: "none",
        alignItems: "center",
        backgroundColor: "#27272a",
        padding: "8px 12px",
        borderRadius: 8,
        marginLeft: 12,
        boxShadow: "0 2px 8px rgba(0,0,0,0.2)"
      }}
    >
      <span style={{ color: "white", marginRight: 10, fontSize: 14 }}>Graph Type:</span>
      <select 
        value={graphType}
        onChange={(e) => setGraphType(e.target.value)}
        style={{
          backgroundColor: "#3f3f46",
          color: "white",
          border: "none",
          padding: "4px 8px",
          borderRadius: 4,
          cursor: "pointer"
        }}
      >
        <option value="base">Base</option>
        <option value="agent">Agent</option>
      </select>
    </div>
  );

  return (
    <div
      ref={containerRef}
      className="graph-visualization-container"
      style={{
        position: "relative",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: "100%",
        height: "100vh",
        overflow: "hidden",
      }}
    >
      {(isLoading || isSearchingActive || isSmartSearching) && <LoadingAnimation />}

      <NavigationBar
        onReset={handleFullReset}
        onBack={() => { handleAfterSmartSearch(); goBack(); }}
        onForward={() => { handleAfterSmartSearch(); goForward(); }}
        canGoBack={canGoBack}
        canGoForward={canGoForward}
        onMyView={() => {
          setSidebarOpen(true);
        }}
      />

      <div style={{ 
        position: "absolute", 
        top: "70px", 
        left: "50%", 
        transform: "translateX(-50%)",
        zIndex: 1000,
        width: "550px",
        maxWidth: "90%" 
      }}>
        <SmartSearchInterface
          endpoint={endpoint}
          onSearch={handleSearch}
          isSearching={isSearchingActive}
          onSearchStart={handleSearchStart}
        />
      </div>

      <div style={{
        position: "fixed", 
        bottom: "10px", 
        left: "10px", 
        zIndex: 1000
      }}>
        <ChatBox walletAddress={walletAddress || "0x25d5C9DbC1E12163B973261A08739927E4F72BA7"} />
      </div>

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
        <GraphTypeSelector />
        
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
                aria-label="Close filters"
              >
                ×
              </button>
              <FilterBar
                subjectFilter={subjectFilter}
                objectFilter={objectFilter}
                onFilterChange={handleSimpleFilterChange}
                onReset={handleFullReset}
              />
            </div>
          </div>
        )}
      </div>

      {viewMode === "2D" && (
        <Graph2D
          graphData={graphData}
          onNodeClick={(node) => {
            handleAfterSmartSearch();
            handleNodeClick(node, fgRef, viewMode);
          }}
          onEngineStop={handleEngineStop}
          fgRef={fgRef}
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={handleTabChange}
          drawerOpen={drawerOpen}
          drawerContent={getDrawerContent()}
          onDrawerClose={() => {
            setDrawerOpen(false);
            setActiveTab(null);
          }}
          sidebarOpen={sidebarOpen}
          sidebarContent={
            <>
              <h2>My Profile</h2>
              <p>Name: Base User</p>
              <p>Email: user@email.com</p>
              <p>Role: Player</p>
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
                Close
              </button>
            </>
          }
          onSidebarClose={() => setSidebarOpen(false)}
          selectedTriple={selectedTriple}
          endpoint={endpoint}
        >
          <GraphLegend />
        </Graph2D>
      )}

      {viewMode === "3D" && (
        <Graph3D
          graphData={graphData}
          onNodeClick={(node) => {
            handleAfterSmartSearch();
            handleNodeClick(node, fgRef, viewMode);
          }}
          onEngineStop={handleEngineStop}
          fgRef={fgRef}
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={handleTabChange}
          drawerOpen={drawerOpen}
          drawerContent={getDrawerContent()}
          onDrawerClose={() => {
            setDrawerOpen(false);
            setActiveTab(null);
          }}
          sidebarOpen={sidebarOpen}
          sidebarContent={
            <>
              <h2>My Profile</h2>
              <p>Name: Base User</p>
              <p>Email: user@email.com</p>
              <p>Role: Player</p>
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
                Close
              </button>
            </>
          }
          onSidebarClose={() => setSidebarOpen(false)}
          selectedTriple={selectedTriple}
          endpoint={endpoint}
        >
          <GraphLegend />
        </Graph3D>
      )}

      {viewMode === "VR" && (
        <GraphVR
          graphData={graphData}
          onNodeClick={(node) => {
            handleAfterSmartSearch();
            handleNodeClick(node, fgRef, viewMode);
          }}
          onBack={() => { handleAfterSmartSearch(); goBack(); }}
          onForward={() => { handleAfterSmartSearch(); goForward(); }}
          selectedTriple={selectedTriple}
          endpoint={endpoint}
        />
      )}

      <SidebarDrawer open={sidebarOpen} onClose={() => setSidebarOpen(false)}>
        <h2>My Profile</h2>
        <p>Name: Base User</p>
        <p>Email: user@email.com</p>
        <p>Role: Player</p>
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
          Close
        </button>
      </SidebarDrawer>

      <Drawer
        open={!!drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setActiveTab(null);
        }}
      >
        {getDrawerContent()}
      </Drawer>
    </div>
  );
};

export default GraphVisualization;
