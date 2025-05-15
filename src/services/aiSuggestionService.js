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

// Fonction principale pour obtenir des suggestions intelligentes basées sur la saisie utilisateur
export const getSmartSuggestions = async (query, endpoint = "base", limit = 10) => {
  if (!query || query.length < 2) {
    return { subjects: [], predicates: [], objects: [], triples: [] };
  }

  try {
    // Récupérer tous les triples d'abord
    const allTriples = await getCachedTriples(endpoint);
    console.log("Nombre total de triples dans le cache:", allTriples.length);
    
    const lowerQuery = query.toLowerCase();
    
    // Filtrer MANUELLEMENT tous les triples qui correspondent à la requête
    // C'est plus fiable que de passer par l'API qui peut avoir des limitations
    const matchingTriples = allTriples.filter(triple => 
      (triple.subject && triple.subject.label && triple.subject.label.toLowerCase().includes(lowerQuery)) ||
      (triple.predicate && triple.predicate.label && triple.predicate.label.toLowerCase().includes(lowerQuery)) ||
      (triple.object && triple.object.label && triple.object.label.toLowerCase().includes(lowerQuery))
    );
    
    console.log("Triples correspondant à la requête:", matchingTriples.length);
    
    // Si on a trouvé des correspondances manuellement, utiliser ces résultats
    if (matchingTriples.length > 0) {
      // Extraire les sujets uniques
      const subjects = [...new Set(
        matchingTriples
          .filter(triple => triple.subject && triple.subject.label && 
                 triple.subject.label.toLowerCase().includes(lowerQuery))
          .map(triple => triple.subject.label)
      )];
      
      // Extraire les prédicats uniques
      const predicates = [...new Set(
        matchingTriples
          .filter(triple => triple.predicate && triple.predicate.label && 
                 triple.predicate.label.toLowerCase().includes(lowerQuery))
          .map(triple => triple.predicate.label)
      )];
      
      // Extraire les objets uniques
      const objects = [...new Set(
        matchingTriples
          .filter(triple => triple.object && triple.object.label && 
                 triple.object.label.toLowerCase().includes(lowerQuery))
          .map(triple => triple.object.label)
      )];
      
      // Créer les triples pour les suggestions
      const tripleSuggestions = matchingTriples
        .map(triple => ({
          subject: triple.subject.label,
          predicate: triple.predicate.label,
          object: triple.object.label
        }))
        .slice(0, limit);
      
      console.log("Sujets trouvés:", subjects.length);
      console.log("Prédicats trouvés:", predicates.length);
      console.log("Objets trouvés:", objects.length);
      
      return {
        subjects: subjects.slice(0, limit),
        predicates: predicates.slice(0, limit),
        objects: objects.slice(0, limit),
        triples: tripleSuggestions
      };
    }
    
    // Si la recherche manuelle ne donne rien, essayer par l'API
    // (mais c'est peu probable que celle-ci donne de meilleurs résultats)
    const filters = { subject: query };
    const searchResults = await searchTriples(filters, endpoint);
    
    // Complément avec recherche par prédicat et objet
    const predFilters = { predicate: query };
    const predResults = await searchTriples(predFilters, endpoint);
    
    const objFilters = { object: query };
    const objResults = await searchTriples(objFilters, endpoint);
    
    // Combiner tous les résultats
    let combinedResults = [...(searchResults || [])];
    
    // Ajouter les résultats de prédicat s'ils existent
    if (predResults && predResults.length > 0) {
      combinedResults = [...combinedResults, ...predResults.filter(pr => 
        !combinedResults.some(cr => cr.id === pr.id)
      )];
    }
    
    // Ajouter les résultats d'objet s'ils existent
    if (objResults && objResults.length > 0) {
      combinedResults = [...combinedResults, ...objResults.filter(or => 
        !combinedResults.some(cr => cr.id === or.id)
      )];
    }
    
    // Extraire les suggestions de cette combinaison
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

// Méthode locale simple pour générer des suggestions sans appel à une API externe
const getLocalSuggestions = (query, triples, limit) => {
  const lowerQuery = query.toLowerCase();
  
  // Filtrer et extraire les sujets uniques correspondant à la requête
  const subjects = [...new Set(
    triples
      .filter(triple => triple.subject.label.toLowerCase().includes(lowerQuery))
      .map(triple => triple.subject.label)
      .slice(0, limit)
  )];
  
  // Filtrer et extraire les prédicats uniques correspondant à la requête
  const predicates = [...new Set(
    triples
      .filter(triple => triple.predicate.label.toLowerCase().includes(lowerQuery))
      .map(triple => triple.predicate.label)
      .slice(0, limit)
  )];
  
  // Filtrer et extraire les objets uniques correspondant à la requête
  const objects = [...new Set(
    triples
      .filter(triple => triple.object.label.toLowerCase().includes(lowerQuery))
      .map(triple => triple.object.label)
      .slice(0, limit)
  )];
  
  // Filtrer et extraire les triplets complets correspondant à la requête
  const triplesResults = triples
    .filter(triple => 
      triple.subject.label.toLowerCase().includes(lowerQuery) ||
      triple.predicate.label.toLowerCase().includes(lowerQuery) ||
      triple.object.label.toLowerCase().includes(lowerQuery)
    )
    .map(triple => ({
      subject: triple.subject.label,
      predicate: triple.predicate.label,
      object: triple.object.label
    }))
    .slice(0, limit);
  
  return { 
    subjects, 
    predicates, 
    objects,
    triples: triplesResults
  };
};

// Méthode utilisant une API d'IA pour générer des suggestions plus intelligentes
const getAISuggestions = async (query, triples, limit) => {
  // Préparation du contexte pour l'IA (échantillon des triples)
  const sampleTriples = triples.slice(0, 50);
  const tripleContextText = sampleTriples
    .map(t => `${t.subject.label} ${t.predicate.label} ${t.object.label}`)
    .join('\n');

  try {
    // Appel à l'API d'IA (exemple avec OpenAI, à adapter selon votre service d'IA)
    const response = await axios.post(
      "https://api.openai.com/v1/completions",
      {
        model: "gpt-3.5-turbo-instruct", // Ou autre modèle adapté
        prompt: `Étant donné la requête utilisateur "${query}" et le contexte des triples suivants:\n\n${tripleContextText}\n\nGénérer ${limit} suggestions pertinentes pour chacune des catégories suivantes au format JSON: sujets, prédicats, objets.`,
        max_tokens: 300,
        temperature: 0.7,
      },
      {
        headers: {
          "Authorization": `Bearer ${process.env.REACT_APP_OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );
    
    // Traiter la réponse pour extraire les suggestions
    try {
      const suggestions = JSON.parse(response.data.choices[0].text);
      return {
        subjects: suggestions.sujets || [],
        predicates: suggestions.prédicats || [],
        objects: suggestions.objets || [],
        triples: suggestions.triplets || []
      };
    } catch (parseError) {
      console.error("Erreur lors de l'analyse de la réponse de l'IA:", parseError);
      // Fallback à la méthode locale en cas d'erreur
      return getLocalSuggestions(query, triples, limit);
    }
  } catch (apiError) {
    console.error("Erreur lors de l'appel à l'API d'IA:", apiError);
    // Fallback à la méthode locale en cas d'erreur
    return getLocalSuggestions(query, triples, limit);
  }
};

// Fonction pour effectuer une recherche complète basée sur des filtres
export const searchWithFilters = async (query, filters, endpoint = "base") => {
  try {
    // Construire les filtres exactement comme dans la barre de droite
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
    
    // Si aucun filtre spécifique n'est défini mais qu'une requête générale est fournie,
    // chercher dans tous les champs en faisant des appels séparés et en combinant les résultats
    if (query && !filters.subject && !filters.predicate && !filters.object) {
      searchFilters.subject = query;
      
      const subjectResults = await searchTriples(searchFilters, endpoint);
      let allResults = subjectResults || [];
      
      try {
        const predicateFilters = { predicate: query };
        const predicateResults = await searchTriples(predicateFilters, endpoint);
        if (predicateResults && predicateResults.length > 0) {
          // Fusionner les résultats en évitant les doublons
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
          // Fusionner les résultats en évitant les doublons
          allResults = [...allResults, ...objectResults.filter(oRes => 
            !allResults.some(existingRes => existingRes.id === oRes.id)
          )];
        }
      } catch (error) {
        console.error("Error searching for objects:", error);
      }
      
      return allResults;
    }
    
    // Utiliser l'API searchTriples directement
    return await searchTriples(searchFilters, endpoint);
  } catch (error) {
    console.error("Erreur lors de la recherche avec filtres:", error);
    return [];
  }
};