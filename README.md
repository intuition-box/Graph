# PlayerMap Graph

Une librairie React pour visualiser des graphes de joueurs avec des fonctionnalités 2D et VR.

## Fonctionnalités

- Visualisation de graphe 2D/3D avec force-directed layout
- Exploration de graphe (clic sur les nœuds pour voir ses relations)
- Filtrage des données
- Vue détaillée des nœuds sélectionnés
- Historique de navigation (retour arrière/avant)
- Types de graphiques sélectionnables :
  - **Base** : graphique par défaut montrant toutes les relations
  - **Agent** : graphique filtré centré sur les agents et leurs relations spécifiques

## Installation

```bash
npm install
npm start
```

## Configuration

Pour changer l'ID de l'objet Agent utilisé pour la visualisation du graphe Agent, modifiez la constante `AGENT_OBJECT_ID` dans les fichiers:
- `src/hooks/useGraphState.js`
- `src/GraphVisualization.jsx`

## Utilisation

```jsx
import {
  GraphVisualization,
  GraphVR,
  NodeDetailsSidebar,
} from "playermap_graph";

function App() {
  return (
    <div>
      {/* Visualisation 2D */}
      <GraphVisualization />

      {/* Visualisation VR */}
      <GraphVR />

      {/* Barre latérale de détails */}
      <NodeDetailsSidebar />
    </div>
  );
}
```

## Composants disponibles

- `GraphVisualization` : Visualisation 2D du graphe
- `GraphVR` : Visualisation VR du graphe
- `NodeDetailsSidebar` : Barre latérale affichant les détails des nœuds
- `GraphLegend` : Légende du graphe
- `EndpointSelector` : Sélecteur de point de terminaison
- `LoadingAnimation` : Animation de chargement

## Utilitaires

- `api` : Fonctions pour interagir avec l'API
- `graphData` : Fonctions de manipulation des données du graphe
- `nodeColors` : Configuration des couleurs des nœuds

## License

MIT
