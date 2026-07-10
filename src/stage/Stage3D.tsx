import { ContactShadows, Grid, OrbitControls, RoundedBox, Text } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import type { Group } from 'three';
import type { StageEl, StageModel, StagePointer } from './model';
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
 * One element: a rounded box that pops in on mount, pulses when its value
 * changes in place, and GLIDES to its slot when it moves — rising over the
 * row when heading right, sliding in front of it when heading left, so a
 * crossing swap never clips. Under the demand frameloop it requests frames
 * only while animating, then goes idle — light on GPU/battery (PLAN.md §8).
 */
function Element({
  el,
  slot,
  count,
  head,
}: {
  el: StageEl;
  slot: number;
  count: number;
  head: boolean;
}) {
  const ref = useRef<Group>(null);
  const targetX = slotX(slot, count);
  const pos = useRef({ x: targetX, y: 0.5, z: 0 });
  const entrance = useRef(0);
  const pulse = useRef(1);
  const prevLabel = useRef(el.label);
  const dir = useRef(0); // sign of the current journey, for over/under routing
  const invalidate = useThree((s) => s.invalidate);

  // Value changed in place (e.g. an overwrite) → restart the pulse.
  useEffect(() => {
    if (prevLabel.current !== el.label) {
      prevLabel.current = el.label;
      pulse.current = 0;
      invalidate();
    }
  }, [el.label, invalidate]);

  // Slot changed → kick off (or re-route) the glide.
  useEffect(() => {
    invalidate();
  }, [targetX, invalidate]);

  useFrame((_, dt) => {
    if (!ref.current) return;
    let busy = false;
    const p = pos.current;

    if (motionDisabled()) {
      p.x = targetX;
      p.y = 0.5;
      p.z = 0;
    } else {
      const dx = targetX - p.x;
      const dist = Math.abs(dx);
      if (dist > 0.004) {
        dir.current = Math.sign(dx);
        busy = true;
      } else {
        p.x = targetX;
        dir.current = 0;
      }
      // Arc height/depth tracks the remaining distance: rises as the journey
      // starts, melts away on arrival — no progress bookkeeping needed.
      const liftT = dir.current > 0 ? Math.min(1.05, dist * 0.55) : 0;
      const frontT = dir.current < 0 ? Math.min(0.85, dist * 0.45) : 0;
      p.x = damp(p.x, targetX, dt);
      p.y = damp(p.y, 0.5 + liftT, dt, 10);
      p.z = damp(p.z, frontT, dt, 10);
      if (Math.abs(p.y - 0.5) > 0.004 || Math.abs(p.z) > 0.004) busy = true;
    }

    if (entrance.current < 1) {
      entrance.current = Math.min(1, entrance.current + dt / 0.34);
      busy = true;
    }
    if (pulse.current < 1) {
      pulse.current = Math.min(1, pulse.current + dt / 0.45);
      busy = true;
    }
    const e = Math.max(0.001, easeOutBack(entrance.current));
    const pu = 1 + Math.sin(Math.min(pulse.current, 1) * Math.PI) * 0.16;
    ref.current.position.set(p.x, p.y, p.z);
    ref.current.scale.setScalar(e * pu);
    if (busy) invalidate();
  });

  const labelSize = el.label.length > 5 ? 0.24 : 0.34;

  return (
    <group ref={ref} position={[targetX, 0.5, 0]} scale={0.001}>
      <RoundedBox args={[1, 1, 1]} radius={0.13} smoothness={3}>
        <meshStandardMaterial
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
function Pointer3D({ ptr, count, lane }: { ptr: StagePointer; count: number; lane: number }) {
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
    ref.current.position.set(x.current, y, 0);
    ref.current.scale.setScalar(Math.max(0.001, easeOutBack(entrance.current)));
    if (busy) invalidate();
  });

  return (
    <group ref={ref} position={[targetX, y, 0]} scale={0.001}>
      <mesh rotation={[Math.PI, 0, 0]} position={[0, -0.08, 0]}>
        <coneGeometry args={[0.12, 0.26, 4]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.55} />
      </mesh>
      <Text
        font={monoFont}
        fontSize={0.21}
        color={color}
        outlineWidth={0.012}
        outlineColor="#07070c"
        anchorX="center"
        anchorY="middle"
        position={[0, 0.24, 0]}
        onSync={() => invalidate()}
      >
        {ptr.name}
      </Text>
    </group>
  );
}

function Structure3D({ model }: { model: StageModel }) {
  const n = model.els.length;
  const showIdx = model.kind === 'array' || model.kind === 'string';
  // Pointers on the same index stack into lanes so they never overlap.
  const lanes = new Map<string, number>();
  {
    const seen = new Map<number, number>();
    for (const p of model.pointers) {
      const lane = seen.get(p.index) ?? 0;
      lanes.set(p.name, lane);
      seen.set(p.index, lane + 1);
    }
  }
  // Key the group by structure name so switching variables remounts with a
  // fresh entrance; elements are keyed by IDENTITY so moves animate.
  return (
    <group key={model.name}>
      {model.els.map((el, i) => (
        <Element key={el.id} el={el} slot={i} count={n} head={i === n - 1} />
      ))}
      {showIdx &&
        model.els.map((_, i) => (
          <Text
            key={`idx${i}`}
            font={monoFont}
            fontSize={0.15}
            color="#8b8ca8"
            anchorX="center"
            anchorY="middle"
            position={[slotX(i, n), 0.08, 0.42]}
          >
            {String(i)}
          </Text>
        ))}
      {model.pointers.map((p) => (
        <Pointer3D key={p.name} ptr={p} count={n} lane={lanes.get(p.name) ?? 0} />
      ))}
    </group>
  );
}

interface Stage3DProps {
  model: StageModel | null;
}

export default function Stage3D({ model }: Stage3DProps) {
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
        {model && <Structure3D model={model} />}
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
