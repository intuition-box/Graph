import axios from "axios";
import { fetchTriples } from "../api";

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
export const getSmartSuggestions = async (query, endpoint = "base", limit = 5) => {
  if (!query || query.length < 2) {
    return { subjects: [], predicates: [], objects: [], triples: [] };
  }

  try {
    // Récupérer les triples pour le contexte
    const triples = await getCachedTriples(endpoint);
    
    // Option 1: Approche locale (filtre simple sans IA)
    return getLocalSuggestions(query, triples, limit);
    
    // Option 2: Approche avec API IA (décommentez pour utiliser)
    // return await getAISuggestions(query, triples, limit);
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
    let triples = await getCachedTriples(endpoint);
    
    // Filtrer par requête générale (recherche dans tous les champs)
    if (query) {
      const lowerQuery = query.toLowerCase();
      triples = triples.filter(triple => 
        triple.subject.label.toLowerCase().includes(lowerQuery) ||
        triple.predicate.label.toLowerCase().includes(lowerQuery) ||
        triple.object.label.toLowerCase().includes(lowerQuery)
      );
    }
    
    // Appliquer les filtres spécifiques
    if (filters.subject) {
      triples = triples.filter(triple => 
        triple.subject.label.toLowerCase().includes(filters.subject.toLowerCase())
      );
    }
    
    if (filters.predicate) {
      triples = triples.filter(triple => 
        triple.predicate.label.toLowerCase().includes(filters.predicate.toLowerCase())
      );
    }
    
    if (filters.object) {
      triples = triples.filter(triple => 
        triple.object.label.toLowerCase().includes(filters.object.toLowerCase())
      );
    }
    
    return triples;
  } catch (error) {
    console.error("Erreur lors de la recherche avec filtres:", error);
    return [];
  }
};