import { Grid, Html, OrbitControls, RoundedBox } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useRef } from 'react';
import type { Group } from 'three';
import type { Structure } from './structures';

function easeOutBack(x: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

interface El {
  label: string;
  sub?: string;
}

function toElements(st: Structure): El[] {
  if (st.kind === 'dict') return st.pairs.map(([k, v]) => ({ label: v, sub: k }));
  return st.items.map((v) => ({ label: v }));
}

/** One element: a rounded box that pops in on mount, plus a DOM label. Under the
 * on-demand frameloop it requests frames only while its entrance is animating,
 * then goes idle — keeping the stage light on GPU/battery (PLAN.md §8). */
function Element({ el, x, head }: { el: El; x: number; head: boolean }) {
  const ref = useRef<Group>(null);
  const t = useRef(0);
  const invalidate = useThree((s) => s.invalidate);

  useFrame((_, dt) => {
    if (!ref.current || t.current >= 1) return;
    t.current = Math.min(1, t.current + dt / 0.34);
    ref.current.scale.setScalar(Math.max(0.001, easeOutBack(t.current)));
    if (t.current < 1) invalidate();
  });

  return (
    <group position={[x, 0.5, 0]}>
      <group ref={ref} scale={0.001}>
        <RoundedBox args={[1, 1, 1]} radius={0.13} smoothness={3}>
          <meshStandardMaterial
            color={head ? '#22d3ee' : '#7c6cff'}
            emissive={head ? '#0e7490' : '#2c2470'}
            emissiveIntensity={0.45}
            metalness={0.25}
            roughness={0.4}
          />
        </RoundedBox>
      </group>
      <Html center position={[0, 0, 0.62]} distanceFactor={9} zIndexRange={[10, 0]}>
        <div className="tile3dLabel">
          {el.sub != null && <em>{el.sub}</em>}
          <span>{el.label}</span>
        </div>
      </Html>
    </group>
  );
}

function Structure3D({ st }: { st: Structure }) {
  const els = toElements(st);
  const gap = 1.32;
  const width = Math.max(0, els.length - 1) * gap;
  // Key the group by structure name so switching variables remounts; key elements
  // by index so appended items pop in while existing ones stay put.
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
        camera={{ position: [4.5, 4, 7.5], fov: 42 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true }}
        style={{ background: 'transparent' }}
      >
        <ambientLight intensity={0.7} />
        <directionalLight position={[5, 9, 5]} intensity={1.3} />
        <pointLight position={[-5, 3, -3]} intensity={8} distance={20} color="#7c6cff" />
        <Grid
          args={[24, 24]}
          cellSize={1}
          cellColor="#26264a"
          sectionSize={4}
          sectionColor="#3a3a66"
          fadeDistance={24}
          fadeStrength={1.5}
          infiniteGrid
          position={[0, -0.02, 0]}
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
