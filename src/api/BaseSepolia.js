import { gql, GraphQLClient } from "graphql-request";

// Hardcoded Endpoints with display names
export const ENDPOINTS = {
  baseSepolia: {
    url: "https://dev.base-sepolia.intuition-api.com/v1/graphql",
    displayName: "Base Testnet",
  },
};

// Create GraphQL client based on endpoint
export const createClient = (endpoint) => {
  return new GraphQLClient(ENDPOINTS[endpoint].url);
};

// Fetch Atom Details
export const fetchAtomDetails = async (atomId, endpoint = "baseSepolia") => {
  const client = createClient(endpoint);
  let query;
  query = gql`
    query GetAtom($atomId: numeric!) {
      atom(id: $atomId) {
        id
        image
        label
        emoji
        type
        creator_id
        vault {
          total_shares
        }
      }
    }
  `;

  const variables = { atomId };

  try {
    const data = await client.request(query, variables);
    return data.atom;
  } catch (error) {
    console.error("Error fetching atom details:", error);
    throw error;
  }
};

// Fetch Triples Details
export const fetchTriples = async (endpoint = "baseSepolia") => {
  const client = createClient(endpoint);
  let query, data;
  query = gql`
    query {
      triples(limit: 1000) {
        id
        subject {
          label
          id
          creator_id
          type
          image
        }
        predicate {
          label
          id
          creator_id
          type
        }
        object {
          label
          id
          creator_id
          type
          image
        }
      }
    }
  `;
  data = await client.request(query);
  // Match the structure returned by Base.js
  return {
    items: data.triples,
  }.items;
};

// Fetch Embedded triples Details
export const fetchTriplesForNode = async (nodeId, endpoint = "baseSepolia") => {
  const client = createClient(endpoint);
  let query, data, variables;
  query = gql`
    query Triples($where: triples_bool_exp) {
      triples(where: $where) {
        id
        subject {
          label
          id
          creator_id
          type
          image
        }
        predicate {
          label
          id
          creator_id
          type
        }
        object {
          label
          id
          creator_id
          type
          image
        }
      }
    }
  `;
  variables = {
    where: {
      _or: [
        {
          predicate_id: {
            _eq: nodeId,
          },
        },
        {
          subject_id: {
            _eq: nodeId,
          },
        },
        {
          object_id: {
            _eq: nodeId,
          },
        },
      ],
    },
  };
  data = await client.request(query, variables);
  return data.triples;
};

// Search Triples
export const searchTriples = async (filters, endpoint = "baseSepolia") => {
  const client = createClient(endpoint);
  const query = gql`
    query SearchTriples($where: triples_bool_exp) {
      triples(where: $where) {
        id
        subject {
          label
          id
          creator_id
          type
          image
        }
        predicate {
          label
          id
          creator_id
          type
        }
        object {
          label
          id
          creator_id
          type
          image
        }
      }
    }
  `;

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

  try {
    const data = await client.request(query, variables);
    return data.triples;
  } catch (error) {
    console.error("Error executing search query:", error);
    throw error;
  }
};

// Fetch Claims by Account
export const fetchClaimsByAccount = async (
  accountId,
  endpoint = "baseSepolia"
) => {
  const client = createClient(endpoint);
  const query = gql`
    query ClaimsByAccount($accountId: String!) {
      claims(where: { account_id: { _eq: $accountId } }) {
        id
        account_id
        counter_shares
        counter_vault_id
        shares
        triple_id
        vault_id
        subject {
          id
          label
          type
          image
        }
        predicate {
          id
          label
          type
        }
        object {
          id
          label
          type
          image
        }
      }
    }
  `;
  const variables = { accountId };
  const data = await client.request(query, variables);
  return data.claims;
};

// Fetch Triples (Positions) by Creator
export const fetchTriplesByCreator = async (
  creatorId,
  endpoint = "baseSepolia"
) => {
  const client = createClient(endpoint);
  const query = gql`
    query TriplesByCreator($creatorId: String!) {
      triples(where: { creator_id: { _eq: $creatorId } }) {
        id
        subject {
          label
          id
        }
        predicate {
          label
          id
        }
        object {
          label
          id
        }
      }
    }
  `;
  const variables = { creatorId };
  const data = await client.request(query, variables);
  return data.triples;
};

// Fetch Triples filtered for Agent view
export const fetchTriplesForAgent = async (
  objectId,
  endpoint = "baseSepolia",
  batchSize = 1000
) => {
  const client = createClient(endpoint);

  // Pour GraphQL request, nous devons adapter la requête subscription en requête query
  // Cette requête est compatible avec les APIs qui ne supportent pas les souscriptions
  const adaptedQuery = gql`
    query Claims_for_Agent($objectId: numeric!, $batchSize: Int!) {
      claims(limit: $batchSize, where: { object_id: { _eq: $objectId } }) {
        subject {
          id
          label
          type
          image
          as_subject_claims {
            predicate {
              label
              id
              type
              image
            }
            object {
              label
              id
              type
              image
            }
          }
        }
      }
    }
  `;

  const variables = {
    batchSize,
    objectId,
  };

  try {
    const data = await client.request(adaptedQuery, variables);

    // Transformer les données reçues en format compatible avec les triples
    const transformedData = data.claims.flatMap((claim) => {
      // Si le sujet n'a pas de claims associés, créer au moins un triple pour ce sujet
      if (
        !claim.subject.as_subject_claims ||
        claim.subject.as_subject_claims.length === 0
      ) {
        return [
          {
            id: `${claim.subject.id}-connected-to-${objectId}`,
            subject: {
              id: claim.subject.id,
              label: claim.subject.label,
              type: "agent",
              image: claim.subject.image,
            },
            predicate: {
              id: null,
              label: "connected to",
              type: "relation",
              image: null,
            },
            object: {
              id: objectId,
              label: "Agent",
              type: "agent",
              image: claim.object.image,
            },
          },
        ];
      }

      // Pour chaque sujet et ses claims associés
      return claim.subject.as_subject_claims.map((subClaim) => {
        return {
          id: `${claim.subject.id}-${subClaim.predicate.label}-${subClaim.object.label}`,
          subject: {
            id: claim.subject.id,
            label: claim.subject.label,
            type: "agent",
            image: claim.subject.image,
          },
          predicate: {
            id: subClaim.predicate.id || null,
            label: subClaim.predicate.label,
            type: "relation",
            image: subClaim.predicate.image,
          },
          object: {
            id: subClaim.object.id || null,
            label: subClaim.object.label,
            type: "concept",
            image: subClaim.object.image,
          },
        };
      });
    });

    return transformedData;
  } catch (error) {
    console.error("Error fetching agent-specific triples:", error);
    // En cas d'erreur, essayons une approche alternative
    return fetchTriples(endpoint)
      .then((triples) => {
        // Filtrer les triples liés à l'agent
        return triples.filter(
          (triple) =>
            triple.subject.id === objectId ||
            triple.object.id === objectId ||
            triple.predicate.id === objectId
        );
      })
      .catch((fallbackError) => {
        console.error("Fallback fetch also failed:", fallbackError);
        throw error; // Lancer l'erreur originale
      });
  }
};

// Fetch Positions by Account
export const fetchPositionsByAccount = async (
  accountId,
  endpoint = "baseSepolia"
) => {
  const client = createClient(endpoint);
  const query = gql`
    query GetAccountActivity($accountId: String!) {
      positions(where: { account_id: { _eq: $accountId } }) {
        id
        shares
        vault_id
        account {
          id
          label
          image
          atom_id
          type
        }
        vault {
          id
          total_shares
          current_share_price
          atom {
            id
            label
            image
          }
          triple {
            id
            block_number
            block_timestamp
            transaction_hash
            creator_id
            subject {
              id
              label
              image
              emoji
              type
              value {
                person {
                  name
                  image
                  description
                  url
                }
                thing {
                  name
                  image
                  description
                  url
                }
                organization {
                  name
                  image
                  description
                  url
                }
              }
              creator {
                label
                image
                id
                atom_id
                type
              }
            }
            predicate {
              id
              label
              image
              emoji
              type
              value {
                person {
                  name
                  image
                  description
                  url
                }
                thing {
                  name
                  image
                  description
                  url
                }
                organization {
                  name
                  image
                  description
                  url
                }
              }
              creator {
                label
                image
                id
                atom_id
                type
              }
            }
            object {
              id
              label
              image
              emoji
              type
              value {
                person {
                  name
                  image
                  description
                  url
                }
                thing {
                  name
                  image
                  description
                  url
                }
                organization {
                  name
                  image
                  description
                  url
                }
              }
              creator {
                label
                image
                id
                atom_id
                type
              }
            }
          }
        }
      }
    }
  `;
  const variables = { accountId };
  const data = await client.request(query, variables);
  return data.positions;
};

// Fetch follows and followers
export const fetchFollowsAndFollowers = async (
  predicateId,
  accountId,
  endpoint = "baseSepolia"
) => {
  const client = createClient(endpoint);
  const query = gql`
    query GetFollowsAndFollowers($predicateId: numeric!, $accountId: numeric!) {
      follows: triples(
        where: {
          _and: [
            { predicate_id: { _eq: $predicateId } }
            { subject_id: { _eq: $accountId } }
          ]
        }
      ) {
        id
        object {
          id
          label
          image
        }
      }
      followers: triples(
        where: {
          _and: [
            { predicate_id: { _eq: $predicateId } }
            { object_id: { _eq: $accountId } }
          ]
        }
      ) {
        id
        subject {
          id
          label
          image
        }
      }
    }
  `;
  const variables = { predicateId, accountId };
  const data = await client.request(query, variables);
  return data;
};
