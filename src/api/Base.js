import { GraphQLClient } from "graphql-request";
import {
  GetAtomDocument,
  GetTriplesDocument,
} from "../vendor/intuition-graphql/dist/index.mjs";

export const ENDPOINTS = {
  base: {
    url: "https://testnet.intuition.sh/v1/graphql",
    displayName: "Intuition Testnet",
  },
};
// Create GraphQL client based on endpoint
export const createClient = (endpoint) => {
  return new GraphQLClient(ENDPOINTS[endpoint].url);
};

// Fetch Atom Details
export const fetchAtomDetails = async (atomId, endpoint = "base") => {
  const client = createClient(endpoint);
  const variables = { id: atomId };

  try {
    const data = await client.request(GetAtomDocument, variables);
    const atom = data.atom;
    if (!atom) return null;
    const totalShares = atom.term?.vaults?.[0]?.total_shares ?? 0;
    return {
      id: atom.term_id,
      image: atom.image,
      label: atom.label,
      emoji: atom.emoji,
      type: atom.type,
      creator: atom.creator || null,
      vault: { total_shares: totalShares },
    };
  } catch (error) {
    console.error("Error fetching atom details:", error);
    throw error;
  }
};

// Fetch Triples Details
export const fetchTriples = async (endpoint = "base") => {
  const client = createClient(endpoint);
  const variables = { limit: 1000 };
  const data = await client.request(GetTriplesDocument, variables);
  const mapped = (data.triples || []).map((t) => ({
    id: t.term_id,
    subject: t.subject
      ? {
          id: t.subject.term_id,
          label: t.subject.label,
          type: t.subject.type,
          creator_id: t.subject.creator?.id,
        }
      : null,
    predicate: t.predicate
      ? {
          id: t.predicate.term_id,
          label: t.predicate.label,
          type: t.predicate.type,
          creator_id: t.predicate.creator?.id,
        }
      : null,
    object: t.object
      ? {
          id: t.object.term_id,
          label: t.object.label,
          type: t.object.type,
          creator_id: t.object.creator?.id,
        }
      : null,
  }));
  return mapped;
};

// Fetch Embedded triples Details
export const fetchTriplesForNode = async (nodeId, endpoint = "base") => {
  const client = createClient(endpoint);
  const variables = {
    where: {
      _or: [
        {
          predicate_id: { _eq: nodeId },
        },
        {
          subject_id: { _eq: nodeId },
        },
        {
          object_id: { _eq: nodeId },
        },
      ],
    },
  };
  const data = await client.request(GetTriplesDocument, variables);
  const mapped = (data.triples || []).map((t) => ({
    id: t.term_id,
    subject: t.subject
      ? {
          id: t.subject.term_id,
          label: t.subject.label,
          type: t.subject.type,
          creator_id: t.subject.creator?.id,
        }
      : null,
    predicate: t.predicate
      ? {
          id: t.predicate.term_id,
          label: t.predicate.label,
          type: t.predicate.type,
          creator_id: t.predicate.creator?.id,
        }
      : null,
    object: t.object
      ? {
          id: t.object.term_id,
          label: t.object.label,
          type: t.object.type,
          creator_id: t.object.creator?.id,
        }
      : null,
  }));
  return mapped;
};

// Search Triples
export const searchTriples = async (filters, endpoint = "base") => {
  const client = createClient(endpoint);

  const where = {
    _and: [],
  };

  if (filters.subject) {
    where._and.push({
      subject: {
        label: {
          _ilike: `%${filters.subject}%`,
        },
      },
    });
  }

  if (filters.predicate) {
    where._and.push({
      predicate: {
        label: {
          _ilike: `%${filters.predicate}%`,
        },
      },
    });
  }

  if (filters.object) {
    where._and.push({
      object: {
        label: {
          _ilike: `%${filters.object}%`,
        },
      },
    });
  }

  const variables = {
    where: where._and.length > 0 ? where : {},
  };

  console.log("Executing search query with variables:", variables);

  try {
    const data = await client.request(GetTriplesDocument, variables);
    const mapped = (data.triples || []).map((t) => ({
      id: t.term_id,
      subject: t.subject
        ? {
            id: t.subject.term_id,
            label: t.subject.label,
            type: t.subject.type,
            creator_id: t.subject.creator?.id,
          }
        : null,
      predicate: t.predicate
        ? {
            id: t.predicate.term_id,
            label: t.predicate.label,
            type: t.predicate.type,
            creator_id: t.predicate.creator?.id,
          }
        : null,
      object: t.object
        ? {
            id: t.object.term_id,
            label: t.object.label,
            type: t.object.type,
            creator_id: t.object.creator?.id,
          }
        : null,
    }));
    console.log("Search query response:", mapped);
    return mapped;
  } catch (error) {
    console.error("Error executing search query:", error);
    throw error;
  }
};
