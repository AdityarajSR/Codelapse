import { ContactShadows, Grid, OrbitControls, RoundedBox, Text } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import type { Group } from 'three';
import type { Structure } from './structures';
// Bundled woff (troika reads ttf/otf/woff, not woff2) — labels render IN the
// canvas, so they show up in GIF exports and cost zero DOM writes per frame.
import monoFont from '@fontsource/jetbrains-mono/files/jetbrains-mono-latin-600-normal.woff?url';

function easeOutBack(x: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

interface El {
  label: string;
  sub?: string;
  subKind?: 'index' | 'key';
}

function toElements(st: Structure): El[] {
  if (st.kind === 'dict') return st.pairs.map(([k, v]) => ({ label: v, sub: k, subKind: 'key' }));
  if (st.kind === 'array' || st.kind === 'string')
    return st.items.map((v, i) => ({ label: v, sub: String(i), subKind: 'index' }));
  return st.items.map((v) => ({ label: v }));
}

/**
 * One element: a rounded box that pops in on mount and pulses when its value
 * changes. Under the demand frameloop it requests frames only while animating,
 * then goes idle — light on GPU/battery (PLAN.md §8).
 */
function Element({ el, x, head }: { el: El; x: number; head: boolean }) {
  const ref = useRef<Group>(null);
  const entrance = useRef(0);
  const pulse = useRef(1);
  const prevLabel = useRef(el.label);
  const invalidate = useThree((s) => s.invalidate);

  // Value changed in place (e.g. a sort swap) → restart the pulse.
  useEffect(() => {
    if (prevLabel.current !== el.label) {
      prevLabel.current = el.label;
      pulse.current = 0;
      invalidate();
    }
  }, [el.label, invalidate]);

  useFrame((_, dt) => {
    if (!ref.current) return;
    let busy = false;
    if (entrance.current < 1) {
      entrance.current = Math.min(1, entrance.current + dt / 0.34);
      busy = true;
    }
    if (pulse.current < 1) {
      pulse.current = Math.min(1, pulse.current + dt / 0.45);
      busy = true;
    }
    const e = Math.max(0.001, easeOutBack(entrance.current));
    const p = 1 + Math.sin(Math.min(pulse.current, 1) * Math.PI) * 0.16;
    ref.current.scale.setScalar(e * p);
    if (busy) invalidate();
  });

  const labelSize = el.label.length > 5 ? 0.24 : 0.34;

  return (
    <group position={[x, 0.5, 0]}>
      <group ref={ref} scale={0.001}>
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
      </group>
      {el.sub != null && (
        <Text
          font={monoFont}
          fontSize={el.subKind === 'key' ? 0.19 : 0.15}
          color={el.subKind === 'key' ? '#c9beff' : '#8b8ca8'}
          anchorX="center"
          anchorY="middle"
          position={el.subKind === 'key' ? [0, 1.02, 0.1] : [0, -0.42, 0.42]}
          onSync={() => invalidate()}
        >
          {el.sub}
        </Text>
      )}
    </group>
  );
}

function Structure3D({ st }: { st: Structure }) {
  const els = toElements(st);
  const gap = 1.32;
  const width = Math.max(0, els.length - 1) * gap;
  // Key the group by structure name so switching variables remounts; key
  // elements by index so appended items pop in while existing ones stay put.
  return (
    <group key={st.name} position={[-width / 2, 0, 0]}>
      {els.map((el, i) => (
        <Element key={i} el={el} x={i * gap} head={i === els.length - 1} />
      ))}
    </group>
  );
}

interface Stage3DProps {
  st: Structure | null;
}

export default function Stage3D({ st }: Stage3DProps) {
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
        {st && <Structure3D st={st} />}
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
