import { useState, useCallback, useRef } from "react";
import { fetchTriples, fetchTriplesForNode, searchTriples } from "../api";
import { transformToGraphData } from "../graphData";

export const useGraphState = (endpoint) => {
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [initialGraphData, setInitialGraphData] = useState(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [selectedTriple, setSelectedTriple] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [graphHistory, setGraphHistory] = useState([]);
  const [currentHistoryIndex, setCurrentHistoryIndex] = useState(0);
  const searchTimeoutRef = useRef(null);

  // Filtres
  const [subjectFilter, setSubjectFilter] = useState("");
  const [objectFilter, setObjectFilter] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [shouldSearch, setShouldSearch] = useState(false);

  const loadInitialData = useCallback(async () => {
    setIsLoading(true);
    try {
      const triples = await fetchTriples(endpoint);
      const baseGraphData = transformToGraphData(triples);
      setGraphData(baseGraphData);
      setInitialGraphData(baseGraphData);
    } catch (error) {
      console.error("Error loading graph data:", error);
    } finally {
      setIsLoading(false);
    }
  }, [endpoint]);

  const resetGraph = useCallback(() => {
    setGraphData(initialGraphData);
    setSelectedTriple(null);
    setSubjectFilter("");
    setObjectFilter("");
    setShouldSearch(false);
  }, [initialGraphData]);

  const handleNodeClick = useCallback(
    async (node, fgRef, viewMode) => {
      if (node === null) {
        setSelectedTriple(null);
        return;
      }

      setSelectedTriple(node);

      if (fgRef && fgRef.current) {
        try {
          const nodePosition = {
            x: node.x,
            y: node.y,
            z: node.z || 0,
          };

          const filteredTriples = await fetchTriplesForNode(node.id, endpoint);
          const newGraphData = transformToGraphData(filteredTriples);

          const targetNode = newGraphData.nodes.find((n) => n.id === node.id);
          if (targetNode) {
            targetNode.x = nodePosition.x;
            targetNode.y = nodePosition.y;
            if (viewMode === "3D") targetNode.z = nodePosition.z;

            targetNode.fx = nodePosition.x;
            targetNode.fy = nodePosition.y;
            if (viewMode === "3D") targetNode.fz = nodePosition.z;
          }

          setGraphHistory((prevHistory) => {
            const updatedHistory = prevHistory.slice(
              0,
              currentHistoryIndex + 1
            );
            updatedHistory.push({ graphData, selectedTriple: node });
            return updatedHistory;
          });
          setCurrentHistoryIndex((prevIndex) => prevIndex + 1);

          setGraphData(newGraphData);
        } catch (error) {
          console.error("Error fetching triples:", error);
        }
      }
    },
    [endpoint, graphData, currentHistoryIndex]
  );

  const handleFilterChange = useCallback((type, value) => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    switch (type) {
      case "subject":
        setSubjectFilter(value);
        break;
      case "object":
        setObjectFilter(value);
        break;
      default:
        break;
    }

    searchTimeoutRef.current = setTimeout(() => {
      setShouldSearch(true);
    }, 500);
  }, []);

  const applyFilters = useCallback(async () => {
    if (!shouldSearch) return;

    if (!subjectFilter && !objectFilter) {
      resetGraph();
      return;
    }

    setIsSearching(true);
    try {
      const filters = {
        subject: subjectFilter,
        object: objectFilter,
      };

      const searchResults = await searchTriples(filters, endpoint);

      if (!searchResults || searchResults.length === 0) {
        setGraphData({ nodes: [], links: [] });
        return;
      }

      const newGraphData = transformToGraphData(searchResults);
      setGraphData(newGraphData);

      setGraphHistory((prevHistory) => {
        const updatedHistory = prevHistory.slice(0, currentHistoryIndex + 1);
        updatedHistory.push({ graphData: newGraphData, selectedTriple: null });
        return updatedHistory;
      });
      setCurrentHistoryIndex((prevIndex) => prevIndex + 1);
    } catch (error) {
      console.error("Error searching triples:", error);
    } finally {
      setIsSearching(false);
      setShouldSearch(false);
    }
  }, [
    subjectFilter,
    objectFilter,
    endpoint,
    resetGraph,
    currentHistoryIndex,
    shouldSearch,
  ]);

  const goBack = useCallback(() => {
    if (currentHistoryIndex > 0) {
      const { graphData, selectedTriple } =
        graphHistory[currentHistoryIndex - 1];
      setGraphData(graphData);
      setSelectedTriple(selectedTriple);
      setCurrentHistoryIndex((prevIndex) => prevIndex - 1);
    }
  }, [currentHistoryIndex, graphHistory]);

  const goForward = useCallback(() => {
    if (currentHistoryIndex < graphHistory.length - 1) {
      const { graphData, selectedTriple } =
        graphHistory[currentHistoryIndex + 1];
      setGraphData(graphData);
      setSelectedTriple(selectedTriple);
      setCurrentHistoryIndex((prevIndex) => prevIndex + 1);
    }
  }, [currentHistoryIndex, graphHistory]);

  return {
    graphData,
    initialGraphData,
    isInitialLoad,
    selectedTriple,
    isLoading,
    isSearching,
    subjectFilter,
    objectFilter,
    shouldSearch,
    canGoBack: currentHistoryIndex > 0,
    canGoForward: currentHistoryIndex < graphHistory.length - 1,
    setSelectedTriple,
    setIsInitialLoad,
    loadInitialData,
    resetGraph,
    handleNodeClick,
    handleFilterChange,
    applyFilters,
    goBack,
    goForward,
  };
};
