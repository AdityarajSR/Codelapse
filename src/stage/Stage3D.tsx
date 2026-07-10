import { ContactShadows, Grid, OrbitControls, RoundedBox, Text } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import type { Group, MeshStandardMaterial } from 'three';
import type { StageEl, StageFrame, StageModel, StagePointer } from './model';
import { pointerColor } from './model';
import { motionDisabled } from './motion';
// Bundled woff (troika reads ttf/otf/woff, not woff2) — labels render IN the
// canvas, so they show up in GIF exports and cost zero DOM writes per frame.
import monoFont from '@fontsource/jetbrains-mono/files/jetbrains-mono-latin-600-normal.woff?url';

function easeOutBack(x: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

const GAP = 1.32;
const slotX = (i: number, n: number) => i * GAP - (Math.max(0, n - 1) * GAP) / 2;

/** Exponential approach — retarget-friendly (a new target mid-flight just
 * bends the path) so fast playback reads as continuous choreography. */
const damp = (cur: number, target: number, dt: number, k = 9) =>
  cur + (target - cur) * Math.min(1, dt * k);

/**
 * One element: a rounded box that pops in on mount (cascading left→right on a
 * fresh structure), pulses when its value changes in place, and springs to its
 * slot when it moves — a true rise-then-fall ARC over the row when heading
 * right, a forward arc in front of it when heading left, glowing while in
 * flight. Under the demand frameloop it requests frames only while animating,
 * then goes idle — light on GPU/battery (PLAN.md §8).
 */
function Element({
  el,
  slot,
  count,
  head,
  rowZ,
}: {
  el: StageEl;
  slot: number;
  count: number;
  head: boolean;
  rowZ: number;
}) {
  const ref = useRef<Group>(null);
  const mat = useRef<MeshStandardMaterial>(null);
  const targetX = slotX(slot, count);
  const s = useRef({
    x: targetX,
    v: 0, // spring velocity
    journey: 0, // length of the current hop, for arc shaping
    dir: 0, // sign of the hop → over the top vs in front
    entrance: -slot * 0.06, // negative = cascade delay, left to right
    pulse: 1,
  });
  const prevLabel = useRef(el.label);
  const invalidate = useThree((st) => st.invalidate);

  // Value changed in place (e.g. an overwrite) → restart the pulse.
  useEffect(() => {
    if (prevLabel.current !== el.label) {
      prevLabel.current = el.label;
      s.current.pulse = 0;
      invalidate();
    }
  }, [el.label, invalidate]);

  // Slot changed → start (or re-route) a hop; the arc restarts from here.
  useEffect(() => {
    const st = s.current;
    const d = Math.abs(targetX - st.x);
    if (d > 0.01) {
      st.journey = d;
      st.dir = Math.sign(targetX - st.x);
    }
    invalidate();
  }, [targetX, invalidate]);

  useFrame((_, rawDt) => {
    if (!ref.current) return;
    const dt = Math.min(rawDt, 0.05); // clamp so background tabs can't explode the spring
    let busy = false;
    const st = s.current;
    let y = 0.5;
    let z = 0;

    if (motionDisabled()) {
      st.x = targetX;
      st.v = 0;
      st.journey = 0;
    } else {
      // Slightly underdamped spring: overshoots a hair, settles crisply —
      // livelier than exponential easing and retarget-friendly at 16×.
      const K = 130; // stiffness
      const C = 17; // damping (critical would be ~22.8)
      st.v += ((targetX - st.x) * K - st.v * C) * dt;
      st.x += st.v * dt;
      const dist = Math.abs(targetX - st.x);
      if (dist < 0.003 && Math.abs(st.v) < 0.02) {
        st.x = targetX;
        st.v = 0;
        st.journey = 0;
        st.dir = 0;
      } else {
        busy = true;
      }
      // True arc: track progress through the hop and rise THEN fall. Height
      // scales with hop length — long selection-sort flights soar higher.
      if (st.journey > 0.01) {
        const p = Math.min(1, Math.max(0, 1 - dist / st.journey));
        const arc = Math.sin(p * Math.PI);
        if (st.dir > 0) y = 0.5 + arc * Math.min(1.25, 0.4 + st.journey * 0.2);
        else z = arc * Math.min(1.0, 0.35 + st.journey * 0.14);
      }
      // Glow while flying, cool down on landing.
      if (mat.current) {
        const flying = st.journey > 0.01;
        mat.current.emissiveIntensity +=
          ((flying ? 1.15 : 0.5) - mat.current.emissiveIntensity) * Math.min(1, dt * 9);
      }
    }

    if (st.entrance < 1) {
      st.entrance = Math.min(1, st.entrance + dt / 0.34);
      busy = true;
    }
    if (st.pulse < 1) {
      st.pulse = Math.min(1, st.pulse + dt / 0.45);
      busy = true;
    }
    const e = Math.max(0.001, easeOutBack(Math.max(0, st.entrance)));
    const pu = 1 + Math.sin(Math.min(st.pulse, 1) * Math.PI) * 0.16;
    ref.current.position.set(st.x, y, rowZ + z);
    ref.current.scale.setScalar(e * pu);
    if (busy) invalidate();
  });

  const labelSize = el.label.length > 5 ? 0.24 : 0.34;

  return (
    <group ref={ref} position={[targetX, 0.5, rowZ]} scale={0.001}>
      <RoundedBox args={[1, 1, 1]} radius={0.13} smoothness={3}>
        <meshStandardMaterial
          ref={mat}
          color={head ? '#33d6f5' : '#8a7cff'}
          emissive={head ? '#0a5f78' : '#3a3184'}
          emissiveIntensity={0.5}
          metalness={0.3}
          roughness={0.35}
        />
      </RoundedBox>
      <Text
        font={monoFont}
        fontSize={labelSize}
        color="#f4fdff"
        outlineWidth={0.016}
        outlineColor="#07070c"
        anchorX="center"
        anchorY="middle"
        position={[0, 0, 0.54]}
        maxWidth={1.15}
        onSync={() => invalidate()}
      >
        {el.label}
      </Text>
      {el.keyLabel != null && (
        <Text
          font={monoFont}
          fontSize={0.19}
          color="#c9beff"
          anchorX="center"
          anchorY="middle"
          position={[0, 0.72, 0.1]}
          onSync={() => invalidate()}
        >
          {el.keyLabel}
        </Text>
      )}
    </group>
  );
}

/** A colored cone + name hovering ABOVE its cell, apex pointing down — the
 * classic `i`/`j` loop-pointer. Glides along the row as the loop advances;
 * two pointers on the same cell stack upward in lanes. */
function Pointer3D({
  ptr,
  count,
  lane,
  rowZ,
}: {
  ptr: StagePointer;
  count: number;
  lane: number;
  rowZ: number;
}) {
  const ref = useRef<Group>(null);
  const targetX = slotX(ptr.index, count);
  const x = useRef(targetX);
  const entrance = useRef(0);
  const invalidate = useThree((s) => s.invalidate);
  const color = pointerColor(ptr.name);
  const y = 1.5 + lane * 0.56;

  useEffect(() => {
    invalidate();
  }, [targetX, invalidate]);

  useFrame((_, dt) => {
    if (!ref.current) return;
    let busy = false;
    if (motionDisabled()) {
      x.current = targetX;
    } else if (Math.abs(targetX - x.current) > 0.004) {
      x.current = damp(x.current, targetX, dt, 11);
      busy = true;
    } else {
      x.current = targetX;
    }
    if (entrance.current < 1) {
      entrance.current = Math.min(1, entrance.current + dt / 0.3);
      busy = true;
    }
    ref.current.position.set(x.current, y, rowZ);
    ref.current.scale.setScalar(Math.max(0.001, easeOutBack(entrance.current)));
    if (busy) invalidate();
  });

  // The beam reaches from under the cone down to just above the box top
  // (world y ≈ 1.05), so the marker visibly POINTS at its cell.
  const beamLen = Math.max(0.12, y - 0.21 - 1.08);

  return (
    <group ref={ref} position={[targetX, y, rowZ]} scale={0.001}>
      <mesh rotation={[Math.PI, 0, 0]} position={[0, -0.08, 0]}>
        <coneGeometry args={[0.12, 0.26, 4]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.55} />
      </mesh>
      <mesh position={[0, -0.21 - beamLen / 2, 0]}>
        <cylinderGeometry args={[0.014, 0.014, beamLen, 6]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.5}
          transparent
          opacity={0.55}
        />
      </mesh>
      {/* name = value, so the marker reads as "variable i is 2 right now,
          which is this cell" */}
      <Text
        font={monoFont}
        fontSize={0.21}
        color={color}
        outlineWidth={0.012}
        outlineColor="#07070c"
        anchorX="center"
        anchorY="middle"
        position={[0, 0.26, 0]}
        onSync={() => invalidate()}
      >
        {`${ptr.name} = ${ptr.index}`}
      </Text>
    </group>
  );
}

function Row3D({ row, rowZ, showTag }: { row: StageModel; rowZ: number; showTag: boolean }) {
  const n = row.els.length;
  const showIdx = row.kind === 'array' || row.kind === 'string';
  // Pointers on the same index stack into lanes so they never overlap.
  const lanes = new Map<string, number>();
  {
    const seen = new Map<number, number>();
    for (const p of row.pointers) {
      const lane = seen.get(p.index) ?? 0;
      lanes.set(p.name, lane);
      seen.set(p.index, lane + 1);
    }
  }
  return (
    <group>
      {row.els.map((el, i) => (
        <Element key={el.id} el={el} slot={i} count={n} head={i === n - 1} rowZ={rowZ} />
      ))}
      {showIdx &&
        row.els.map((_, i) => (
          <Text
            key={`idx${i}`}
            font={monoFont}
            fontSize={0.15}
            color="#8b8ca8"
            anchorX="center"
            anchorY="middle"
            position={[slotX(i, n), 0.08, rowZ + 0.42]}
          >
            {String(i)}
          </Text>
        ))}
      {/* the variable's name at the row's left end, so two rows never blur
          together ("which boxes are `seen`?") */}
      {showTag && (
        <Text
          font={monoFont}
          fontSize={0.26}
          color="#a3a4c0"
          outlineWidth={0.012}
          outlineColor="#07070c"
          anchorX="right"
          anchorY="middle"
          position={[slotX(0, n) - 0.95, 0.5, rowZ]}
        >
          {row.name}
        </Text>
      )}
      {row.pointers.map((p) => (
        <Pointer3D key={p.name} ptr={p} count={n} lane={lanes.get(p.name) ?? 0} rowZ={rowZ} />
      ))}
    </group>
  );
}

interface Stage3DProps {
  frame: StageFrame | null;
}

export default function Stage3D({ frame }: Stage3DProps) {
  return (
    <div className="stage3d">
      <Canvas
        frameloop="demand"
        camera={{ position: [4.2, 3.4, 7.4], fov: 40 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true }}
        style={{ background: 'transparent' }}
      >
        <fog attach="fog" args={['#07070c', 15, 30]} />
        <ambientLight intensity={0.55} />
        <directionalLight position={[6, 10, 4]} intensity={1.15} />
        <pointLight position={[-6, 4, -6]} intensity={10} distance={26} color="#33d6f5" />
        <pointLight position={[5, 3, 6]} intensity={6} distance={20} color="#8a7cff" />
        <Grid
          args={[24, 24]}
          cellSize={1}
          cellColor="#1c1c38"
          sectionSize={4}
          sectionColor="#2d2d58"
          fadeDistance={26}
          fadeStrength={1.6}
          infiniteGrid
          position={[0, -0.02, 0]}
        />
        <ContactShadows
          position={[0, 0, 0]}
          opacity={0.45}
          scale={16}
          blur={2.2}
          far={3.4}
          resolution={256}
        />
        {frame?.rows.map((row, r) => (
          // Two rows sit at different depths: primary in front, companion
          // behind. Keyed by variable name so switching variables remounts
          // with a fresh entrance; elements inside are keyed by IDENTITY.
          <Row3D
            key={row.name}
            row={row}
            rowZ={frame.rows.length > 1 ? (r === 0 ? 0.85 : -1.55) : 0}
            showTag={frame.rows.length > 1}
          />
        ))}
        <OrbitControls
          enablePan={false}
          enableZoom={false}
          enableDamping={false}
          minPolarAngle={0.55}
          maxPolarAngle={1.4}
        />
      </Canvas>
    </div>
  );
}
