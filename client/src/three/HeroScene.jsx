import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, Float, Lightformer, MeshTransmissionMaterial, PerformanceMonitor, Sparkles } from '@react-three/drei';
import { Suspense, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { makePageTexture } from './pageTexture';

const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
// ?quality=low forces the cheap path (handy on old laptops and for screenshots).
const forceLow = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('quality') === 'low';

const LAYOUT = Array.from({ length: 7 }, (_, i) => {
  const o = i - 3;
  return {
    position: [o * 1.55, Math.sin(i * 1.7) * 0.28, -Math.abs(o) * 0.55 - 0.4],
    rotation: [0, -o * 0.13, Math.sin(i * 2.3) * 0.06],
  };
});

function Page({ index, position, rotation }) {
  const map = useMemo(() => makePageTexture(index), [index]);
  return (
    <Float speed={reduced ? 0 : 1.1} rotationIntensity={0.25} floatIntensity={0.5}>
      <mesh position={position} rotation={rotation} castShadow>
        <planeGeometry args={[1.4, 1.98]} />
        <meshStandardMaterial map={map} roughness={0.9} metalness={0} side={THREE.DoubleSide} />
      </mesh>
    </Float>
  );
}

/** A magnifying lens: glass disc with real refraction, brass rim, handle, and a lamp that lights what it passes over. */
function Lens({ mode, low }) {
  const group = useRef();
  const { pointer, viewport } = useThree();

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    const g = group.current;
    let tx, ty;
    if (mode === 'scan') {
      tx = Math.sin(t * 0.9) * viewport.width * 0.3;
      ty = Math.sin(t * 1.9) * 0.8;
    } else if (reduced) {
      tx = 1.4; ty = 0.2;
    } else {
      // follows the pointer, with a slow idle drift
      tx = pointer.x * viewport.width * 0.38 + Math.sin(t * 0.4) * 0.3;
      ty = pointer.y * viewport.height * 0.3 + Math.cos(t * 0.5) * 0.15;
    }
    g.position.x = THREE.MathUtils.damp(g.position.x, tx, mode === 'scan' ? 4 : 2.5, dt);
    g.position.y = THREE.MathUtils.damp(g.position.y, ty, mode === 'scan' ? 4 : 2.5, dt);
    g.rotation.z = THREE.MathUtils.damp(g.rotation.z, -g.position.x * 0.06, 3, dt);
    g.rotation.y = THREE.MathUtils.damp(g.rotation.y, g.position.x * -0.08, 3, dt);
  });

  return (
    <group ref={group} position={[1.4, 0.2, 1.7]}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.85, 0.85, 0.14, 64]} />
        <MeshTransmissionMaterial
          backside={!low}
          samples={low ? 1 : 6}
          resolution={low ? 128 : 512}
          thickness={0.45}
          ior={1.4}
          chromaticAberration={0.06}
          anisotropy={0.2}
          distortion={0.08}
          distortionScale={0.3}
          temporalDistortion={0.04}
          roughness={0}
          color="#eef8ff"
        />
      </mesh>
      <mesh>
        <torusGeometry args={[0.88, 0.065, 24, 96]} />
        <meshStandardMaterial color="#c9a24a" metalness={1} roughness={0.22} />
      </mesh>
      <mesh position={[0.98, -0.98, 0]} rotation={[0, 0, Math.PI / 4]}>
        <cylinderGeometry args={[0.075, 0.09, 1.25, 24]} />
        <meshStandardMaterial color="#1f2d44" metalness={0.4} roughness={0.35} />
      </mesh>
      <pointLight position={[0, 0, -0.6]} intensity={9} distance={3.2} color="#ffd98a" />
    </group>
  );
}

/** Opening dolly-in, then gentle parallax. */
function CameraRig({ mode }) {
  const { camera, pointer, size } = useThree();
  // In portrait, aim lower so the pages sit in the top half, above the text.
  const portrait = size.width < size.height;
  useFrame((_, dt) => {
    const targetZ = (mode === 'scan' ? 8.6 : 7.4) + (portrait ? 4 : 0);
    camera.position.z = THREE.MathUtils.damp(camera.position.z, targetZ, 1.2, dt);
    camera.position.x = THREE.MathUtils.damp(camera.position.x, reduced ? 0 : pointer.x * 0.5, 2, dt);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, reduced ? 0 : pointer.y * 0.3, 2, dt);
    camera.lookAt(0, portrait ? -2.2 : 0, 0);
  });
  return null;
}

export default function HeroScene({ mode = 'hero' }) {
  // Start high; drop the glass to a cheaper mode if the frame rate falls.
  const [low, setLow] = useState(forceLow);
  const [dpr, setDpr] = useState(forceLow ? 1 : 1.75);
  return (
    <Canvas
      className="scene"
      dpr={dpr}
      camera={{ position: [0, 0, reduced ? 7.4 : 15], fov: 35 }}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
    >
      <PerformanceMonitor onDecline={() => { setLow(true); setDpr(1); }} flipflops={2} />
      <fog attach="fog" args={['#0e1726', 7, 15]} />
      <ambientLight intensity={0.35} />
      <directionalLight position={[-4, 5, 6]} intensity={0.6} color="#bcd4ff" />
      <Suspense fallback={null}>
        {LAYOUT.map((p, i) => (
          <Page key={i} index={i} {...p} />
        ))}
        <Lens mode={mode} low={low} />
        <Sparkles count={low ? 30 : 70} scale={[12, 6, 4]} size={2} speed={reduced ? 0 : 0.25} opacity={0.5} color="#ffd98a" />
        <Environment resolution={256}>
          <Lightformer form="rect" intensity={3} position={[0, 4, -6]} scale={[10, 2, 1]} />
          <Lightformer form="ring" color="#7fd4ff" intensity={5} position={[-6, 1, 2]} scale={3} />
          <Lightformer form="circle" color="#ffd98a" intensity={4} position={[5, -1, 3]} scale={2} />
        </Environment>
      </Suspense>
      <CameraRig mode={mode} />
    </Canvas>
  );
}
