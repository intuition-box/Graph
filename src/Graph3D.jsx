import React from "react";
import { ForceGraph3D } from "react-force-graph";
import { getNodeColor } from "./nodeColors";
import * as THREE from "three";

const Graph3D = ({ graphData, onNodeClick, onEngineStop, fgRef }) => {
  return (
    <ForceGraph3D
      ref={fgRef}
      graphData={graphData}
      controlType="fly"
      nodeLabel="label"
      onNodeClick={onNodeClick}
      linkColor={() => "rgba(255, 211, 42, 0.15)"}
      linkDirectionalParticles={2}
      linkDirectionalParticleSpeed={0.0025}
      linkDirectionalParticleColor={() => "rgba(255,255,255,0.5)"}
      nodeAutoColorBy="type"
      nodeThreeObject={(node) => {
        const size = 16;
        if (node.type === "object") {
          // --- Carré 2D (plan XY) ---
          const group = new THREE.Group();
          if (node.image) {
            // Canvas carré pour l'image
            const canvas = document.createElement("canvas");
            canvas.width = canvas.height = 128;
            const ctx = canvas.getContext("2d");
            ctx.clearRect(0, 0, 128, 128);
            // Charger l'image et la dessiner centrée/couverte
            const img = new window.Image();
            img.crossOrigin = "anonymous";
            img.src = node.image;
            img.onload = () => {
              const ratio = Math.max(128 / img.width, 128 / img.height);
              const w = img.width * ratio;
              const h = img.height * ratio;
              ctx.save();
              ctx.fillStyle = getNodeColor(node.type);
              ctx.fillRect(0, 0, 128, 128); // fond/contour
              ctx.drawImage(img, 64 - w / 2, 64 - h / 2, w, h);
              ctx.restore();
              texture.needsUpdate = true;
            };
            // Sprite image carré
            const texture = new THREE.Texture(canvas);
            const material = new THREE.MeshBasicMaterial({
              map: texture,
              transparent: true,
            });
            const plane = new THREE.Mesh(
              new THREE.PlaneGeometry(size, size),
              material
            );
            group.add(plane);
            return group;
          } else {
            // Lettre sur carré coloré
            const canvas = document.createElement("canvas");
            canvas.width = canvas.height = 128;
            const ctx = canvas.getContext("2d");
            ctx.clearRect(0, 0, 128, 128);
            ctx.fillStyle = getNodeColor(node.type);
            ctx.fillRect(0, 0, 128, 128);
            const letter = (node.label || "?").charAt(0).toUpperCase();
            ctx.font = "bold 72px Sans-Serif";
            ctx.fillStyle = "#fff";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(letter, 64, 72);
            const texture = new THREE.Texture(canvas);
            texture.needsUpdate = true;
            const material = new THREE.MeshBasicMaterial({
              map: texture,
              transparent: true,
            });
            const plane = new THREE.Mesh(
              new THREE.PlaneGeometry(size, size),
              material
            );
            group.add(plane);
            return group;
          }
        } else {
          // --- Cercle 2D (plan XY) ---
          const group = new THREE.Group();
          if (node.image) {
            // Canvas rond pour l'image
            const canvas = document.createElement("canvas");
            canvas.width = canvas.height = 128;
            const ctx = canvas.getContext("2d");
            ctx.clearRect(0, 0, 128, 128);
            const img = new window.Image();
            img.crossOrigin = "anonymous";
            img.src = node.image;
            img.onload = () => {
              const ratio = Math.max(128 / img.width, 128 / img.height);
              const w = img.width * ratio;
              const h = img.height * ratio;
              ctx.save();
              ctx.beginPath();
              ctx.arc(64, 64, 64, 0, 2 * Math.PI);
              ctx.closePath();
              ctx.clip();
              ctx.drawImage(img, 64 - w / 2, 64 - h / 2, w, h);
              ctx.restore();
              texture.needsUpdate = true;
            };
            const texture = new THREE.Texture(canvas);
            const material = new THREE.MeshBasicMaterial({
              map: texture,
              transparent: true,
            });
            const plane = new THREE.Mesh(
              new THREE.CircleGeometry(size / 2, 48),
              material
            );
            group.add(plane);
            return group;
          } else {
            // Lettre sur cercle coloré
            const canvas = document.createElement("canvas");
            canvas.width = canvas.height = 128;
            const ctx = canvas.getContext("2d");
            ctx.clearRect(0, 0, 128, 128);
            ctx.save();
            ctx.beginPath();
            ctx.arc(64, 64, 64, 0, 2 * Math.PI);
            ctx.closePath();
            ctx.clip();
            ctx.fillStyle = getNodeColor(node.type);
            ctx.fillRect(0, 0, 128, 128);
            ctx.restore();
            const letter = (node.label || "?").charAt(0).toUpperCase();
            ctx.font = "bold 72px Sans-Serif";
            ctx.fillStyle = "#fff";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(letter, 64, 72);
            const texture = new THREE.Texture(canvas);
            texture.needsUpdate = true;
            const material = new THREE.MeshBasicMaterial({
              map: texture,
              transparent: true,
            });
            const plane = new THREE.Mesh(
              new THREE.CircleGeometry(size / 2, 48),
              material
            );
            group.add(plane);
            return group;
          }
        }
      }}
      onEngineStop={onEngineStop}
    />
  );
};

export default Graph3D;
