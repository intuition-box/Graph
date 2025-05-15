import axios from "axios";
import { fetchTriples, searchTriples } from "../api";

// Cache pour stocker les triples et éviter des appels API répétitifs
let triplesCache = {
  endpoint: null,
  data: null,
  timestamp: null,
};

// Durée de validité du cache en millisecondes (15 minutes)
const CACHE_VALIDITY = 15 * 60 * 1000;

// Récupère les triples avec mise en cache
const getCachedTriples = async (endpoint) => {
  const now = Date.now();

  // Si le cache est valide et pour le même endpoint, utiliser le cache
  if (
    triplesCache.data &&
    triplesCache.endpoint === endpoint &&
    now - triplesCache.timestamp < CACHE_VALIDITY
  ) {
    return triplesCache.data;
  }

  // Sinon, récupérer de nouvelles données
  const triples = await fetchTriples(endpoint);
  
  // Mettre à jour le cache
  triplesCache = {
    endpoint,
    data: triples,
    timestamp: now,
  };
  
  return triples;
};

// Fonction principale pour obtenir des suggestions intelligentes
export const getSmartSuggestions = async (query, endpoint = "base", limit = 10) => {
  if (!query || query.length < 1) {
    return { subjects: [], predicates: [], objects: [], triples: [] };
  }

  const lowerQuery = query.toLowerCase().trim();
  
  // Traitement spécial pour les mots très courts
  const shortWords = ["is", "of", "in", "at", "by", "to"];
  
  if (shortWords.includes(lowerQuery)) {
    try {
      const predFilters = { predicate: lowerQuery };
      const predResults = await searchTriples(predFilters, endpoint);
      
      if (predResults && predResults.length > 0) {
        return {
          subjects: [...new Set(predResults.map(t => t.subject.label))].slice(0, limit),
          predicates: [lowerQuery],
          objects: [...new Set(predResults.map(t => t.object.label))].slice(0, limit),
          triples: predResults.map(t => ({
            subject: t.subject.label,
            predicate: t.predicate.label,
            object: t.object.label
          })).slice(0, limit)
        };
      }
    } catch (error) {
      console.error("Erreur recherche pour mot court:", error);
    }
  }

  try {
    // Récupérer tous les triples via le cache
    const allTriples = await getCachedTriples(endpoint);
    
    // Filtrer les triples correspondant à la requête
    const matchingTriples = allTriples.filter(triple => {
      // Pour les requêtes courtes, être plus strict sur la correspondance
      if (lowerQuery.length <= 3) {
        return (triple.subject && triple.subject.label && 
                triple.subject.label.toLowerCase().indexOf(lowerQuery) !== -1) ||
               (triple.predicate && triple.predicate.label && 
                triple.predicate.label.toLowerCase().indexOf(lowerQuery) !== -1) ||
               (triple.object && triple.object.label && 
                triple.object.label.toLowerCase().indexOf(lowerQuery) !== -1);
      } else {
        return (triple.subject && triple.subject.label && 
                triple.subject.label.toLowerCase().includes(lowerQuery)) ||
               (triple.predicate && triple.predicate.label && 
                triple.predicate.label.toLowerCase().includes(lowerQuery)) ||
               (triple.object && triple.object.label && 
                triple.object.label.toLowerCase().includes(lowerQuery));
      }
    });
    
    if (matchingTriples.length > 0) {
      // Fonction de score pour la pertinence
      const getRelevanceScore = (label) => {
        if (!label) return 0;
        
        const labelLower = label.toLowerCase();
        let score = 100 - Math.min(label.length, 50);
        
        if (labelLower.startsWith(lowerQuery)) {
          score += 200;
        }
        
        if (labelLower === lowerQuery) {
          score += 300;
        }
        
        if (!/^0x[0-9a-f]{8,}$/i.test(labelLower) && 
            !/[0-9a-f]{30,}/i.test(labelLower)) {
          score += 150;
        }
        
        if (/^[A-Za-z0-9]+ - [A-Za-z0-9 ]+$/.test(label)) {
          score += 100;
        }
        
        return score;
      };
      
      // Extraire et trier les sujets par pertinence
      const subjects = [...new Set(
        matchingTriples
          .filter(triple => triple.subject && triple.subject.label && 
                 triple.subject.label.toLowerCase().indexOf(lowerQuery) !== -1)
          .map(triple => triple.subject.label)
      )]
        .sort((a, b) => getRelevanceScore(b) - getRelevanceScore(a));
      
      // Extraire et trier les prédicats par pertinence
      let predicates = [...new Set(
        matchingTriples
          .filter(triple => triple.predicate && triple.predicate.label && 
                 triple.predicate.label.toLowerCase().indexOf(lowerQuery) !== -1)
          .map(triple => triple.predicate.label)
      )]
        .sort((a, b) => {
          // Préférer les correspondances exactes pour les mots courts
          if (a.toLowerCase() === lowerQuery) return -1;
          if (b.toLowerCase() === lowerQuery) return 1;
          return getRelevanceScore(b) - getRelevanceScore(a);
        });
      
      // Extraire et trier les objets par pertinence
      const objects = [...new Set(
        matchingTriples
          .filter(triple => triple.object && triple.object.label && 
                 triple.object.label.toLowerCase().indexOf(lowerQuery) !== -1)
          .map(triple => triple.object.label)
      )]
        .sort((a, b) => getRelevanceScore(b) - getRelevanceScore(a));
      
      // Calculer le score pour les triples
      const getTripleScore = (triple) => {
        if (!triple) return 0;
        const subjectScore = triple.subject ? getRelevanceScore(triple.subject) : 0;
        const predicateScore = triple.predicate ? getRelevanceScore(triple.predicate) : 0;
        const objectScore = triple.object ? getRelevanceScore(triple.object) : 0;
        return Math.max(subjectScore, predicateScore, objectScore);
      };
      
      // Créer et trier les triples pour les suggestions
      const tripleSuggestions = matchingTriples
        .map(triple => ({
          subject: triple.subject.label,
          predicate: triple.predicate.label,
          object: triple.object.label
        }))
        .sort((a, b) => getTripleScore(b) - getTripleScore(a))
        .slice(0, limit);
      
      return {
        subjects: subjects.slice(0, limit),
        predicates: predicates.slice(0, limit),
        objects: objects.slice(0, limit),
        triples: tripleSuggestions
      };
    }
    
    // Si la recherche manuelle ne donne rien, essayer par l'API
    const filters = { subject: query };
    const searchResults = await searchTriples(filters, endpoint);
    const predFilters = { predicate: query };
    const predResults = await searchTriples(predFilters, endpoint);
    const objFilters = { object: query };
    const objResults = await searchTriples(objFilters, endpoint);
    
    // Combiner tous les résultats
    let combinedResults = [...(searchResults || [])];
    
    if (predResults && predResults.length > 0) {
      combinedResults = [...combinedResults, ...predResults.filter(pr => 
        !combinedResults.some(cr => cr.id === pr.id)
      )];
    }
    
    if (objResults && objResults.length > 0) {
      combinedResults = [...combinedResults, ...objResults.filter(or => 
        !combinedResults.some(cr => cr.id === or.id)
      )];
    }
    
    const apiSubjects = [...new Set(
      combinedResults
        .filter(triple => triple.subject && triple.subject.label)
        .map(triple => triple.subject.label)
        .filter(label => label.toLowerCase().includes(lowerQuery))
    )];
    
    const apiPredicates = [...new Set(
      combinedResults
        .filter(triple => triple.predicate && triple.predicate.label)
        .map(triple => triple.predicate.label)
        .filter(label => label.toLowerCase().includes(lowerQuery))
    )];
    
    const apiObjects = [...new Set(
      combinedResults
        .filter(triple => triple.object && triple.object.label)
        .map(triple => triple.object.label)
        .filter(label => label.toLowerCase().includes(lowerQuery))
    )];
    
    const apiTripleSuggestions = combinedResults
      .map(triple => ({
        subject: triple.subject.label,
        predicate: triple.predicate.label,
        object: triple.object.label
      }))
      .slice(0, limit);
    
    return {
      subjects: apiSubjects.slice(0, limit),
      predicates: apiPredicates.slice(0, limit),
      objects: apiObjects.slice(0, limit),
      triples: apiTripleSuggestions
    };
  } catch (error) {
    console.error("Erreur lors de la génération des suggestions:", error);
    return { subjects: [], predicates: [], objects: [], triples: [] };
  }
};

// Fonction pour effectuer une recherche avec filtres
export const searchWithFilters = async (query, filters, endpoint = "base") => {
  try {
    const searchFilters = {};
    
    if (filters.subject) {
      searchFilters.subject = filters.subject;
    }
    
    if (filters.predicate) {
      searchFilters.predicate = filters.predicate;
    }
    
    if (filters.object) {
      searchFilters.object = filters.object;
    }
    
    if (query && !filters.subject && !filters.predicate && !filters.object) {
      searchFilters.subject = query;
      
      const subjectResults = await searchTriples(searchFilters, endpoint);
      let allResults = subjectResults || [];
      
      try {
        const predicateFilters = { predicate: query };
        const predicateResults = await searchTriples(predicateFilters, endpoint);
        if (predicateResults && predicateResults.length > 0) {
          allResults = [...allResults, ...predicateResults.filter(pRes => 
            !allResults.some(sRes => sRes.id === pRes.id)
          )];
        }
      } catch (error) {
        console.error("Error searching for predicates:", error);
      }
      
      try {
        const objectFilters = { object: query };
        const objectResults = await searchTriples(objectFilters, endpoint);
        if (objectResults && objectResults.length > 0) {
          allResults = [...allResults, ...objectResults.filter(oRes => 
            !allResults.some(existingRes => existingRes.id === oRes.id)
          )];
        }
      } catch (error) {
        console.error("Error searching for objects:", error);
      }
      
      return allResults;
    }
    
    return await searchTriples(searchFilters, endpoint);
  } catch (error) {
    console.error("Erreur lors de la recherche avec filtres:", error);
    return [];
  }
};