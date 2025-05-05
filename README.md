# PlayerMap Graph

Une librairie React pour visualiser des graphes de joueurs avec des fonctionnalités 2D et VR.

## Installation

```bash
npm install playermap_graph
```

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
