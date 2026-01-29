import * as THREE from "three";
import type { GameState, Pos, Wall } from "./state";

const BOARD_SIZE = 9;
const CELL_SIZE = 1;
const WALL_HEIGHT = 0.6;
const WALL_THICKNESS = 0.08;
const PAWN_RADIUS = 0.3;
const GAP = 0.05;

const COLORS = {
  bg: 0x0a0e27,
  cell: 0x141b3d,
  cellLight: 0x1b2550,
  player0: 0xff4d6d,
  player1: 0x4cc9f0,
  wall: 0xfbbf24,
  wallGhost: 0xfbbf24,
  validMove: 0xff4d6d,
  goalRow0: 0xff4d6d,
  goalRow1: 0x4cc9f0,
};

export interface BoardRenderer {
  update(state: GameState, validMoves: Pos[], ghostWall: Wall | null, myTurn: boolean, playerIdx: 0 | 1): void;
  getPositionFromMouse(e: MouseEvent): Pos | null;
  getWallFromMouse(e: MouseEvent): { row: number; col: number; orientation: "h" | "v" } | null;
  rotate(): void;
  dispose(): void;
  getDomElement(): HTMLCanvasElement;
}

export function initBoard(container: HTMLElement): BoardRenderer {
  // Scene setup
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(COLORS.bg);
  scene.fog = new THREE.FogExp2(COLORS.bg, 0.04);

  const width = 500;
  const height = 500;

  const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
  camera.position.set(4, 12, 10);
  camera.lookAt(4, 0, 4);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  // Lighting
  const ambient = new THREE.AmbientLight(0x404060, 1.5);
  scene.add(ambient);

  const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
  dirLight.position.set(6, 10, 8);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.width = 1024;
  dirLight.shadow.mapSize.height = 1024;
  dirLight.shadow.camera.near = 1;
  dirLight.shadow.camera.far = 30;
  dirLight.shadow.camera.left = -6;
  dirLight.shadow.camera.right = 12;
  dirLight.shadow.camera.top = 12;
  dirLight.shadow.camera.bottom = -6;
  scene.add(dirLight);

  const backLight = new THREE.DirectionalLight(0x4466aa, 0.4);
  backLight.position.set(-4, 6, -4);
  scene.add(backLight);

  // Board base
  const baseGeo = new THREE.BoxGeometry(BOARD_SIZE + 0.4, 0.15, BOARD_SIZE + 0.4);
  const baseMat = new THREE.MeshStandardMaterial({ color: 0x080c20, roughness: 0.8 });
  const baseMesh = new THREE.Mesh(baseGeo, baseMat);
  baseMesh.position.set((BOARD_SIZE - 1) / 2, -0.1, (BOARD_SIZE - 1) / 2);
  baseMesh.receiveShadow = true;
  scene.add(baseMesh);

  // Cells
  const cellMeshes: THREE.Mesh[][] = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    cellMeshes[r] = [];
    for (let c = 0; c < BOARD_SIZE; c++) {
      const geo = new THREE.BoxGeometry(CELL_SIZE - GAP * 2, 0.08, CELL_SIZE - GAP * 2);
      const color = (r + c) % 2 === 0 ? COLORS.cell : COLORS.cellLight;
      const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.1 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(c, 0, r);
      mesh.receiveShadow = true;
      mesh.userData = { type: "cell", row: r, col: c };
      scene.add(mesh);
      cellMeshes[r][c] = mesh;
    }
  }

  // Goal row highlights
  for (let c = 0; c < BOARD_SIZE; c++) {
    // Player 0 goal = row 8
    const g0 = new THREE.Mesh(
      new THREE.BoxGeometry(CELL_SIZE - GAP * 2, 0.09, CELL_SIZE - GAP * 2),
      new THREE.MeshStandardMaterial({ color: COLORS.goalRow0, transparent: true, opacity: 0.15, roughness: 0.5 }),
    );
    g0.position.set(c, 0.01, 8);
    scene.add(g0);
    // Player 1 goal = row 0
    const g1 = new THREE.Mesh(
      new THREE.BoxGeometry(CELL_SIZE - GAP * 2, 0.09, CELL_SIZE - GAP * 2),
      new THREE.MeshStandardMaterial({ color: COLORS.goalRow1, transparent: true, opacity: 0.15, roughness: 0.5 }),
    );
    g1.position.set(c, 0.01, 0);
    scene.add(g1);
  }

  // Pawn meshes
  const pawnGeo = new THREE.SphereGeometry(PAWN_RADIUS, 32, 24);
  const pawnMats = [
    new THREE.MeshStandardMaterial({ color: COLORS.player0, emissive: COLORS.player0, emissiveIntensity: 0.3, roughness: 0.3, metalness: 0.2 }),
    new THREE.MeshStandardMaterial({ color: COLORS.player1, emissive: COLORS.player1, emissiveIntensity: 0.3, roughness: 0.3, metalness: 0.2 }),
  ];
  const pawns = [
    new THREE.Mesh(pawnGeo, pawnMats[0]),
    new THREE.Mesh(pawnGeo, pawnMats[1]),
  ];
  pawns.forEach((p) => {
    p.castShadow = true;
    p.position.y = PAWN_RADIUS + 0.04;
    scene.add(p);
  });

  // Point lights on pawns for glow
  const pawnLights = [
    new THREE.PointLight(COLORS.player0, 0, 3),
    new THREE.PointLight(COLORS.player1, 0, 3),
  ];
  pawnLights.forEach((l, i) => {
    pawns[i].add(l);
  });

  // Wall group
  const wallGroup = new THREE.Group();
  scene.add(wallGroup);

  // Ghost wall mesh
  const ghostWallMesh = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1), // placeholder, resized in update
    new THREE.MeshStandardMaterial({ color: COLORS.wallGhost, transparent: true, opacity: 0.6, emissive: COLORS.wallGhost, emissiveIntensity: 0.4, roughness: 0.4 }),
  );
  ghostWallMesh.visible = false;
  ghostWallMesh.castShadow = true;
  scene.add(ghostWallMesh);

  // Valid move indicators
  const validMoveGroup = new THREE.Group();
  scene.add(validMoveGroup);

  // Turn indicator bar
  const turnBarGeo = new THREE.BoxGeometry(BOARD_SIZE, 0.05, 0.1);
  const turnBarMat = new THREE.MeshStandardMaterial({ color: COLORS.player0, emissive: COLORS.player0, emissiveIntensity: 0.5 });
  const turnBar = new THREE.Mesh(turnBarGeo, turnBarMat);
  turnBar.position.set((BOARD_SIZE - 1) / 2, 0.02, -0.6);
  scene.add(turnBar);

  // Raycaster for mouse
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  // Invisible plane for wall detection
  const boardPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  const CENTER = new THREE.Vector3((BOARD_SIZE - 1) / 2, 0, (BOARD_SIZE - 1) / 2);
  const CAM_DISTANCE = 14;
  const CAM_HEIGHT = 12;
  // angle=PI → camera at z<0, looking toward z+, so row 0 (red start) is closest = player 0 view
  // angle=0  → camera at z>0, looking toward z-, so row 8 (blue start/red goal) is closest = player 1 view
  let rotationAngle = Math.PI;
  let targetRotation = Math.PI;
  let autoRotated = false;

  function setCameraFromAngle(angle: number) {
    camera.position.set(
      CENTER.x + Math.sin(angle) * CAM_DISTANCE * 0.5,
      CAM_HEIGHT,
      CENTER.z + Math.cos(angle) * CAM_DISTANCE * 0.5,
    );
    camera.lookAt(CENTER);
  }
  setCameraFromAngle(rotationAngle);

  let clock = new THREE.Clock();

  // Animation loop
  let animId = 0;
  let currentState: GameState | null = null;
  let currentMyTurn = false;

  function animate() {
    animId = requestAnimationFrame(animate);
    const elapsed = clock.getElapsedTime();
    const pulse = 0.5 + 0.5 * Math.sin(elapsed * Math.PI * 2);

    // Animate active pawn
    if (currentState) {
      for (let i = 0; i < 2; i++) {
        const isActive = currentState.currentTurn === i;
        const scale = isActive ? 1 + 0.1 * pulse : 1;
        pawns[i].scale.setScalar(scale);
        pawnLights[i].intensity = isActive ? 1.5 + pulse : 0;
        (pawnMats[i] as THREE.MeshStandardMaterial).emissiveIntensity = isActive ? 0.3 + 0.3 * pulse : 0.15;
      }

      // Animate valid move indicators
      validMoveGroup.children.forEach((child) => {
        if (child instanceof THREE.Mesh) {
          (child.material as THREE.MeshStandardMaterial).opacity = 0.2 + 0.2 * pulse;
        }
      });

      // Turn bar
      const barAlpha = currentMyTurn ? 0.6 + 0.4 * pulse : 0.2;
      turnBarMat.opacity = barAlpha;
      turnBarMat.transparent = true;
    }

    // Smooth camera rotation
    if (Math.abs(rotationAngle - targetRotation) > 0.01) {
      rotationAngle += (targetRotation - rotationAngle) * 0.05;
      setCameraFromAngle(rotationAngle);
    }

    renderer.render(scene, camera);
  }
  animate();

  function cellToWorld(row: number, col: number): THREE.Vector3 {
    return new THREE.Vector3(col, 0, row);
  }

  function wallCenter(w: Wall): [number, number] {
    // Cells centered at integers, edges at half-integers
    // Horizontal wall at (row, col): sits on edge z = row + 0.5, spans cols col..col+1, center x = col + 0.5
    // Vertical wall at (row, col): sits on edge x = col + 0.5, spans rows row..row+1, center z = row + 0.5
    return [w.col + 0.5, w.row + 0.5];
  }

  function createWallMesh(w: Wall, color: number, opacity: number = 1): THREE.Mesh {
    let sx: number, sz: number;
    const [px, pz] = wallCenter(w);
    if (w.orientation === "h") {
      sx = CELL_SIZE * 2 - 0.04;
      sz = WALL_THICKNESS;
    } else {
      sx = WALL_THICKNESS;
      sz = CELL_SIZE * 2 - 0.04;
    }
    const geo = new THREE.BoxGeometry(sx, WALL_HEIGHT, sz);
    const mat = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.2,
      roughness: 0.4,
      metalness: 0.3,
      transparent: opacity < 1,
      opacity,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(px, WALL_HEIGHT / 2, pz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  function updateBoard(state: GameState, validMoves: Pos[], ghostWall: Wall | null, myTurn: boolean, playerIdx: 0 | 1) {
    currentState = state;
    currentMyTurn = myTurn;

    // Auto-rotate for player 1 so their side is closest
    if (!autoRotated) {
      autoRotated = true;
      if (playerIdx === 1) {
        targetRotation = 0;
        rotationAngle = 0; // instant on first load
      }
      setCameraFromAngle(rotationAngle);
    }

    // Update pawns
    for (let i = 0; i < 2; i++) {
      const pos = state.players[i].pos;
      const target = cellToWorld(pos.row, pos.col);
      pawns[i].position.x = target.x;
      pawns[i].position.z = target.z;
      pawns[i].position.y = PAWN_RADIUS + 0.04;
    }

    // Update walls
    while (wallGroup.children.length > 0) {
      const c = wallGroup.children[0];
      wallGroup.remove(c);
      if (c instanceof THREE.Mesh) {
        c.geometry.dispose();
        (c.material as THREE.Material).dispose();
      }
    }
    for (const w of state.walls) {
      wallGroup.add(createWallMesh(w, COLORS.wall));
    }

    // Ghost wall
    if (ghostWall) {
      ghostWallMesh.visible = true;
      const [gpx, gpz] = wallCenter(ghostWall);
      const gsx = ghostWall.orientation === "h" ? CELL_SIZE * 2 - 0.04 : WALL_THICKNESS;
      const gsz = ghostWall.orientation === "h" ? WALL_THICKNESS : CELL_SIZE * 2 - 0.04;
      ghostWallMesh.geometry.dispose();
      ghostWallMesh.geometry = new THREE.BoxGeometry(gsx, WALL_HEIGHT, gsz);
      ghostWallMesh.position.set(gpx, WALL_HEIGHT / 2, gpz);
    } else {
      ghostWallMesh.visible = false;
    }

    // Valid moves
    while (validMoveGroup.children.length > 0) {
      const c = validMoveGroup.children[0];
      validMoveGroup.remove(c);
      if (c instanceof THREE.Mesh) {
        c.geometry.dispose();
        (c.material as THREE.Material).dispose();
      }
    }
    for (const m of validMoves) {
      const geo = new THREE.BoxGeometry(CELL_SIZE - GAP * 4, 0.04, CELL_SIZE - GAP * 4);
      const mat = new THREE.MeshStandardMaterial({
        color: COLORS.validMove,
        emissive: COLORS.validMove,
        emissiveIntensity: 0.4,
        transparent: true,
        opacity: 0.3,
        roughness: 0.5,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(m.col, 0.06, m.row);
      mesh.userData = { type: "cell", row: m.row, col: m.col };
      validMoveGroup.add(mesh);
    }

    // Turn bar color
    const turnColor = state.currentTurn === 0 ? COLORS.player0 : COLORS.player1;
    turnBarMat.color.setHex(turnColor);
    turnBarMat.emissive.setHex(turnColor);
  }

  function mouseToNDC(e: MouseEvent) {
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  }

  function getPositionFromMouse(e: MouseEvent): Pos | null {
    mouseToNDC(e);
    raycaster.setFromCamera(mouse, camera);

    const target = new THREE.Vector3();
    const ray = raycaster.ray;
    if (!ray.intersectPlane(boardPlane, target)) return null;

    const col = Math.round(target.x);
    const row = Math.round(target.z);
    if (row < 0 || row > 8 || col < 0 || col > 8) return null;
    return { row, col };
  }

  function getWallFromMouse(e: MouseEvent): { row: number; col: number; orientation: "h" | "v" } | null {
    mouseToNDC(e);
    raycaster.setFromCamera(mouse, camera);

    const target = new THREE.Vector3();
    const ray = raycaster.ray;
    if (!ray.intersectPlane(boardPlane, target)) return null;

    const x = target.x;
    const z = target.z;
    const t = 0.25;

    // Edges between cells are at half-integers: 0.5, 1.5, ..., 7.5
    // Nearest horizontal edge (z = hIdx + 0.5)
    const hIdx = Math.round(z - 0.5); // 0..8
    const hDist = Math.abs(z - (hIdx + 0.5));

    // Nearest vertical edge (x = vIdx + 0.5)
    const vIdx = Math.round(x - 0.5); // 0..8
    const vDist = Math.abs(x - (vIdx + 0.5));

    // Prefer closer edge
    if (hDist < t && hDist <= vDist) {
      const wRow = hIdx;
      const wCol = Math.floor(x);
      if (wRow >= 0 && wRow <= 7 && wCol >= 0 && wCol <= 7)
        return { row: wRow, col: wCol, orientation: "h" };
    }
    if (vDist < t) {
      const wCol = vIdx;
      const wRow = Math.floor(z);
      if (wRow >= 0 && wRow <= 7 && wCol >= 0 && wCol <= 7)
        return { row: wRow, col: wCol, orientation: "v" };
    }
    return null;
  }

  function rotate() {
    targetRotation += Math.PI / 2;
  }

  function dispose() {
    cancelAnimationFrame(animId);
    renderer.dispose();
    container.removeChild(renderer.domElement);
  }

  return {
    update: updateBoard,
    getPositionFromMouse,
    getWallFromMouse,
    rotate,
    dispose,
    getDomElement: () => renderer.domElement,
  };
}
