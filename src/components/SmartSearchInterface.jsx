import React, { useState, useEffect, useRef } from "react";
import {
  getSmartSuggestions,
  searchWithFilters,
} from "../services/aiSuggestionService";
import { NODE_COLORS } from "../nodeColors"; // Importation des couleurs
import { useGraphState } from "../hooks/useGraphState";

const SmartSearchInterface = ({
  endpoint,
  onSearch,
  isSearching,
  onSearchStart,
}) => {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState({
    subjects: [],
    predicates: [],
    objects: [],
    triples: [],
  });
  const [selectedFilters, setSelectedFilters] = useState({
    subject: "",
    predicate: "",
    object: "",
  });
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const searchTimeoutRef = useRef(null);
  const suggestionsRef = useRef(null);

  // Handle clicks outside the suggestions container
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Get suggestions
  useEffect(() => {
    if (query.length >= 2) {
      clearTimeout(searchTimeoutRef.current);
      
      setIsLoadingSuggestions(true);
      setShowSuggestions(true);
      
      searchTimeoutRef.current = setTimeout(async () => {
        try {
          const smartSuggestions = await getSmartSuggestions(query, endpoint);
          setSuggestions(smartSuggestions);
          setShowSuggestions(true);
          setIsLoadingSuggestions(false);
        } catch (error) {
          console.error("Error retrieving suggestions:", error);
          setIsLoadingSuggestions(false);
        }
      }, 300);
    } else {
      setSuggestions({
        subjects: [],
        predicates: [],
        objects: [],
        triples: [],
      });
      setShowSuggestions(false);
      setIsLoadingSuggestions(false);
    }

    return () => {
      clearTimeout(searchTimeoutRef.current);
    };
  }, [query, endpoint]);

  // Apply filter
  const applyFilter = (type, value) => {
    setSelectedFilters((prev) => {
      const newFilters = {
        ...prev,
        [type]: prev[type] === value ? "" : value
      };
      return newFilters;
    });
  };

  // Fonction de recherche simplifiée
  const handleSearch = async () => {
    // Signaler le début de la recherche
    if (typeof onSearchStart === "function") {
      onSearchStart();
    }

    try {
      const filters = {
        subject: selectedFilters.subject || "",
        predicate: selectedFilters.predicate || "",
        object: selectedFilters.object || ""
      };

      // Appeler directement onSearch avec les filtres
      if (typeof onSearch === "function") {
        await onSearch(query, filters);
      }
    } catch (error) {
      // Gérer l'erreur silencieusement
    }
  };

  const hasActiveFilters = selectedFilters.subject || selectedFilters.predicate || selectedFilters.object;
  const hasSuggestions = 
    suggestions.subjects.length > 0 || 
    suggestions.predicates.length > 0 || 
    suggestions.objects.length > 0 ||
    (suggestions.triples && suggestions.triples.length > 0);

  // Modern inline styles with better contrast
  const styles = {
    container: {
      width: "100%",
      maxWidth: "550px",
      margin: "0 auto",
      position: "relative",
      zIndex: 1000,
    },
    inputWrapper: {
      display: "flex",
      width: "100%",
      boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
      borderRadius: "12px",
      overflow: "hidden",
      backgroundColor: "rgba(30, 30, 40, 0.6)",
      backdropFilter: "blur(5px)",
      border: "1px solid rgba(255, 255, 255, 0.2)",
    },
    input: {
      flex: 1,
      padding: "10px 15px",
      fontSize: "15px",
      border: "none",
      backgroundColor: "transparent",
      color: "white",
      outline: "none",
      fontWeight: "400",
      height: "40px",
    },
    inputPlaceholder: {
      color: "rgba(255, 255, 255, 0.6)",
    },
    button: {
      padding: "0 22px",
      border: "none",
      cursor: "pointer",
      fontWeight: "bold",
      fontSize: "15px",
      textTransform: "uppercase",
    },
    activeFilters: {
      display: "flex",
      flexWrap: "wrap",
      alignItems: "center",
      marginTop: "12px",
      padding: "8px 12px",
      backgroundColor: "rgba(30, 30, 40, 0.7)",
      borderRadius: "6px",
      border: "1px solid rgba(255, 255, 255, 0.1)",
      backdropFilter: "blur(5px)",
    },
    filtersLabel: {
      fontWeight: "600",
      marginRight: "12px",
      color: "rgba(255, 255, 255, 0.9)",
      fontSize: "13px",
    },
    filtersChips: {
      display: "flex",
      flexWrap: "wrap",
      gap: "6px",
      flex: 1,
    },
    filterChip: {
      display: "flex",
      alignItems: "center",
      padding: "3px 8px",
      borderRadius: "16px",
      fontSize: "12px",
      color: "white",
      boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
    },
    subjectChip: {
      backgroundColor: `${NODE_COLORS.SUBJECT}cc`,
    },
    predicateChip: {
      backgroundColor: `${NODE_COLORS.PREDICATE}cc`,
    },
    objectChip: {
      backgroundColor: `${NODE_COLORS.OBJECT}cc`,
    },
    chipButton: {
      background: "none",
      border: "none",
      color: "white",
      marginLeft: "4px",
      cursor: "pointer",
      fontSize: "14px",
      lineHeight: 1,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      width: "16px",
      height: "16px",
      borderRadius: "50%",
      transition: "background-color 0.2s ease",
    },
    chipButtonHover: {
      backgroundColor: "rgba(255, 255, 255, 0.2)",
    },
    clearButton: {
      padding: "4px 10px",
      backgroundColor: "rgba(255, 70, 70, 0.8)",
      color: "white",
      border: "none",
      borderRadius: "16px",
      cursor: "pointer",
      fontSize: "12px",
      fontWeight: "500",
      boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
      transition: "background-color 0.2s ease",
      marginLeft: "auto",
    },
    clearButtonHover: {
      backgroundColor: "rgba(255, 70, 70, 1)",
    },
    suggestionsContainer: {
      position: "absolute",
      top: "calc(100% + 8px)",
      left: 0,
      right: 0,
      backgroundColor: "rgba(25, 25, 35, 0.9)",
      backdropFilter: "blur(10px)",
      border: "1px solid rgba(255, 255, 255, 0.1)",
      borderRadius: "8px",
      maxHeight: "400px",
      overflowY: "auto",
      zIndex: 1001,
      boxShadow: "0 8px 16px rgba(0, 0, 0, 0.3)",
      color: "white",
    },
    suggestionCategory: {
      padding: "14px",
      borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
    },
    categoryHeader: {
      fontWeight: "600",
      marginBottom: "10px",
      color: "rgba(255, 255, 255, 0.8)",
      fontSize: "14px",
      textTransform: "uppercase",
      letterSpacing: "0.5px",
    },
    suggestionList: {
      display: "flex",
      flexWrap: "wrap",
      gap: "8px",
    },
    suggestionItem: {
      padding: "3px 8px",
      borderRadius: "16px",
      backgroundColor: "rgba(255, 255, 255, 0.15)",
      fontSize: "12px",
      cursor: "pointer",
      transition: "all 0.2s ease",
      color: "rgba(255, 255, 255, 0.9)",
    },
    suggestionItemHover: {
      backgroundColor: "rgba(255, 255, 255, 0.25)",
    },
    selectedSuggestion: {
      backgroundColor: "#4A66E8",
      color: "white",
    },
    loadingContainer: {
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '25px',
    },
    loader: {
      width: '30px',
      height: '30px',
      border: '3px solid rgba(255,255,255,0.2)',
      borderRadius: '50%', 
      borderTop: '3px solid #ffd32a',
      animation: 'spin 1s linear infinite',
    },
    noResults: {
      padding: '25px',
      textAlign: 'center',
      fontSize: '14px',
      color: 'rgba(255,255,255,0.7)',
    },
    tripleSuggestion: {
      padding: "8px 12px",
      borderRadius: "12px",
      fontSize: "13px",
      cursor: "pointer",
      transition: "all 0.2s ease",
      backgroundColor: "rgba(30, 30, 40, 0.55)",
      backdropFilter: "blur(5px)",
      border: "1px solid rgba(255, 255, 255, 0.15)",
      display: "flex",
      flexDirection: "row",
      flexWrap: "wrap",
      gap: "6px",
      alignItems: "center",
      justifyContent: "center",
    },
    tripleSuggestionHover: {
      backgroundColor: "rgba(50, 50, 60, 0.65)",
    },
    tripleSubjectPart: {
      color: NODE_COLORS.SUBJECT,
      fontWeight: "500",
      padding: "2px 6px",
      borderRadius: "4px",
      backgroundColor: `${NODE_COLORS.SUBJECT}33`,
    },
    triplePredicatePart: {
      color: NODE_COLORS.PREDICATE,
      fontWeight: "500",
      padding: "2px 6px",
      borderRadius: "4px",
      backgroundColor: `${NODE_COLORS.PREDICATE}33`,
    },
    tripleObjectPart: {
      color: NODE_COLORS.OBJECT,
      fontWeight: '500',
      padding: '2px 6px',
      borderRadius: '4px',
      backgroundColor: `${NODE_COLORS.OBJECT}33`
    },
    subjectSuggestion: {
      backgroundColor: NODE_COLORS.SUBJECT,
      color: '#fff',
      fontWeight: '500',
      border: 'none'
    },
    predicateSuggestion: {
      backgroundColor: NODE_COLORS.PREDICATE,
      color: '#fff',
      fontWeight: '500',
      border: 'none'
    },
    objectSuggestion: {
      backgroundColor: NODE_COLORS.OBJECT,
      color: '#fff',
      fontWeight: '500',
      border: 'none'
    }
  };

  // States to manage hover
  const [buttonHover, setButtonHover] = useState(false);
  const [clearButtonHover, setClearButtonHover] = useState(false);
  const [hoverChipButton, setHoverChipButton] = useState(null);
  const [hoverSuggestion, setHoverSuggestion] = useState(null);

  return (
    <div style={styles.container}>
      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
      
      <div style={styles.inputWrapper}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search for triples..."
          style={styles.input}
          onFocus={() => {
            if (query.length >= 2) {
              setShowSuggestions(true);
            }
          }}
        />
        <button
          onClick={handleSearch}
          disabled={isSearching}
          style={{
            ...styles.button,
            backgroundColor: "#ffd32a",
            color: "#18181b",
            height: "40px",
            borderRadius: "0 12px 12px 0",
            boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
            transition: "background 0.2s, color 0.2s, transform 0.1s",
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.backgroundColor = "#ffe066")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.backgroundColor = "#ffd32a")
          }
        >
          {isSearching ? "Searching..." : "Search"}
        </button>
      </div>

      {hasActiveFilters && (
        <div style={styles.activeFilters}>
          <div style={styles.filtersLabel}>Active filters:</div>
          <div style={styles.filtersChips}>
            {selectedFilters.subject && (
              <div style={{ ...styles.filterChip, ...styles.subjectChip }}>
                <span>Subject: {selectedFilters.subject}</span>
                <button
                  onClick={() =>
                    applyFilter("subject", selectedFilters.subject)
                  }
                  style={{
                    ...styles.chipButton,
                    ...(hoverChipButton === "subject"
                      ? styles.chipButtonHover
                      : {}),
                  }}
                  onMouseEnter={() => setHoverChipButton("subject")}
                  onMouseLeave={() => setHoverChipButton(null)}
                >
                  ×
                </button>
              </div>
            )}
            {selectedFilters.predicate && (
              <div style={{ ...styles.filterChip, ...styles.predicateChip }}>
                <span>Predicate: {selectedFilters.predicate}</span>
                <button
                  onClick={() =>
                    applyFilter("predicate", selectedFilters.predicate)
                  }
                  style={{
                    ...styles.chipButton,
                    ...(hoverChipButton === "predicate"
                      ? styles.chipButtonHover
                      : {}),
                  }}
                  onMouseEnter={() => setHoverChipButton("predicate")}
                  onMouseLeave={() => setHoverChipButton(null)}
                >
                  ×
                </button>
              </div>
            )}
            {selectedFilters.object && (
              <div style={{ ...styles.filterChip, ...styles.objectChip }}>
                <span>Object: {selectedFilters.object}</span>
                <button
                  onClick={() => applyFilter("object", selectedFilters.object)}
                  style={{
                    ...styles.chipButton,
                    ...(hoverChipButton === "object"
                      ? styles.chipButtonHover
                      : {}),
                  }}
                  onMouseEnter={() => setHoverChipButton("object")}
                  onMouseLeave={() => setHoverChipButton(null)}
                >
                  ×
                </button>
              </div>
            )}
          </div>
          <button
            onClick={() =>
              setSelectedFilters({ subject: "", predicate: "", object: "" })
            }
            style={{
              ...styles.clearButton,
              ...(clearButtonHover ? styles.clearButtonHover : {}),
            }}
            onMouseEnter={() => setClearButtonHover(true)}
            onMouseLeave={() => setClearButtonHover(false)}
          >
            Clear all filters
          </button>
        </div>
      )}

      {showSuggestions && (
        <div style={styles.suggestionsContainer} ref={suggestionsRef}>
          {isLoadingSuggestions && (
            <div style={styles.loadingContainer}>
              <div style={styles.loader}></div>
            </div>
          )}
          
          {!isLoadingSuggestions && !hasSuggestions && query.length >= 2 && (
            <div style={styles.noResults}>
              Aucune suggestion trouvée pour "{query}"
            </div>
          )}
          
          {!isLoadingSuggestions && suggestions.subjects.length > 0 && (
            <div style={styles.suggestionCategory}>
              <div style={styles.categoryHeader}>Suggested Subjects</div>
              <div style={styles.suggestionList}>
                {suggestions.subjects.map((subject, index) => (
                  <div
                    key={`subject-${index}`}
                    style={{
                      ...styles.suggestionItem,
                      ...styles.subjectSuggestion,
                      ...(hoverSuggestion === `subject-${index}`
                        ? styles.suggestionItemHover
                        : {}),
                      ...(selectedFilters.subject === subject
                        ? styles.selectedSuggestion
                        : {}),
                    }}
                    onClick={() => applyFilter("subject", subject)}
                    onMouseEnter={() => setHoverSuggestion(`subject-${index}`)}
                    onMouseLeave={() => setHoverSuggestion(null)}
                  >
                    {subject}
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {!isLoadingSuggestions && suggestions.predicates.length > 0 && (
            <div style={styles.suggestionCategory}>
              <div style={styles.categoryHeader}>Suggested Predicates</div>
              <div style={styles.suggestionList}>
                {suggestions.predicates.map((predicate, index) => (
                  <div
                    key={`predicate-${index}`}
                    style={{
                      ...styles.suggestionItem,
                      ...styles.predicateSuggestion,
                      ...(hoverSuggestion === `predicate-${index}`
                        ? styles.suggestionItemHover
                        : {}),
                      ...(selectedFilters.predicate === predicate
                        ? styles.selectedSuggestion
                        : {}),
                    }}
                    onClick={() => applyFilter("predicate", predicate)}
                    onMouseEnter={() =>
                      setHoverSuggestion(`predicate-${index}`)
                    }
                    onMouseLeave={() => setHoverSuggestion(null)}
                  >
                    {predicate}
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {!isLoadingSuggestions && suggestions.objects.length > 0 && (
            <div style={styles.suggestionCategory}>
              <div style={styles.categoryHeader}>Suggested Objects</div>
              <div style={styles.suggestionList}>
                {suggestions.objects.map((object, index) => (
                  <div
                    key={`object-${index}`}
                    style={{
                      ...styles.suggestionItem,
                      ...styles.objectSuggestion,
                      ...(hoverSuggestion === `object-${index}`
                        ? styles.suggestionItemHover
                        : {}),
                      ...(selectedFilters.object === object
                        ? styles.selectedSuggestion
                        : {}),
                    }}
                    onClick={() => applyFilter("object", object)}
                    onMouseEnter={() => setHoverSuggestion(`object-${index}`)}
                    onMouseLeave={() => setHoverSuggestion(null)}
                  >
                    {object}
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {!isLoadingSuggestions && suggestions.triples && suggestions.triples.length > 0 && (
            <div style={styles.suggestionCategory}>
              <div style={styles.categoryHeader}>Suggested Triples</div>
              <div style={styles.suggestionList}>
                {suggestions.triples.map((triple, index) => (
                  <div
                    key={`triple-${index}`}
                    style={{
                      ...styles.tripleSuggestion,
                      ...(hoverSuggestion === `triple-${index}`
                        ? styles.tripleSuggestionHover
                        : {}),
                    }}
                    onClick={() => {
                      setSelectedFilters({
                        subject: triple.subject,
                        predicate: triple.predicate,
                        object: triple.object,
                      });
                    }}
                    onMouseEnter={() => setHoverSuggestion(`triple-${index}`)}
                    onMouseLeave={() => setHoverSuggestion(null)}
                  >
                    <span style={styles.tripleSubjectPart}>
                      {triple.subject}
                    </span>
                    <span style={styles.triplePredicatePart}>
                      {triple.predicate}
                    </span>
                    <span style={styles.tripleObjectPart}>{triple.object}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SmartSearchInterface;
