import { GraphQLClient } from "graphql-request";
import * as Base from "./api/Base";
import * as BaseSepolia from "./api/BaseSepolia";

// Hardcoded Endpoints with display names
export const ENDPOINTS = {
  railsMockApi: {
    url: "https://api-i7n.thp-lab.org/api/v1/graph",
    displayName: "[OffChain] Playground API",
    module: Base, // Default to Base module for railsMockApi
  },
  baseSepolia: {
    url: "https://api.i7n.dev/v1/graphql",
    displayName: "Base Testnet",
    module: BaseSepolia,
  },
  base: {
    url: "https://prod.base.intuition-api.com/v1/graphql",
    displayName: "Base Mainnet",
    module: Base,
  },
};

// Create GraphQL client based on endpoint
export const createClient = (endpoint) => {
  if (!ENDPOINTS[endpoint]) {
    throw new Error(`Endpoint '${endpoint}' is not defined.`);
  }
  return new GraphQLClient(ENDPOINTS[endpoint].url);
};

// Wrapper to dynamically select the appropriate module
const getModuleForEndpoint = (endpoint) => {
  if (!ENDPOINTS[endpoint] || !ENDPOINTS[endpoint].module) {
    throw new Error(`No module defined for endpoint '${endpoint}'.`);
  }
  return ENDPOINTS[endpoint].module;
};

// Unified fetchTriples function
export const fetchTriples = async (endpoint = "base") => {
  const module = getModuleForEndpoint(endpoint);
  try {
    return module.fetchTriples(endpoint);
  } catch (error) {
    console.error(`Error fetching triples for endpoint ${endpoint}:`, error);
    throw error;
  }
};

// Unified fetchTriplesForNode function
export const fetchTriplesForNode = async (nodeId, endpoint = "base") => {
  const module = getModuleForEndpoint(endpoint);
  try {
    return module.fetchTriplesForNode(nodeId, endpoint);
  } catch (error) {
    console.error(
      `Error fetching triples for node ${nodeId} with endpoint ${endpoint}:`,
      error
    );
    throw error;
  }
};

// Unified fetchAtomDetails function
export const fetchAtomDetails = async (atomId, endpoint = "base") => {
  const module = getModuleForEndpoint(endpoint);
  try {
    return module.fetchAtomDetails(atomId, endpoint);
  } catch (error) {
    console.error(
      `Error fetching atom details for ${atomId} with endpoint ${endpoint}:`,
      error
    );
    throw error;
  }
};

// Unified searchTriples function
export const searchTriples = async (filters, endpoint = "base") => {
  const module = getModuleForEndpoint(endpoint);
  try {
    return module.searchTriples(filters, endpoint);
  } catch (error) {
    console.error(`Error searching triples with endpoint ${endpoint}:`, error);
    throw error;
  }
};

// Fetch Claims by Account
export const fetchClaimsByAccount = async (
  accountId,
  endpoint = "baseSepolia"
) => {
  return BaseSepolia.fetchClaimsByAccount(accountId, endpoint);
};

// Fetch Triples (Positions) by Creator
export const fetchTriplesByCreator = async (
  creatorId,
  endpoint = "baseSepolia"
) => {
  return BaseSepolia.fetchTriplesByCreator(creatorId, endpoint);
};

// Fetch Triples filtered for Agent view
export const fetchTriplesForAgent = async (
  objectId,
  endpoint = "baseSepolia",
  batchSize = 1000
) => {
  return BaseSepolia.fetchTriplesForAgent(objectId, endpoint, batchSize);
};
