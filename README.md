# ColorGradingGUI for ThreeJS EffectComposer
A powerful and customizable color grading effect for ThreeJS EffectComposer using 'three/examples/jsm/postprocessing/EffectComposer'. This effect includes fine control over channel mixing, HSL adjustment per hue range, tone mapping, exposure, temperature, and much more.

This postprocessing effect is a refactored fork of [Lunakepio's](https://github.com/Lunakepio) <a href="https://github.com/Lunakepio/ColorGradingEffect" style="color: #2fff65;">ColorGradingEffect</a> which was originally created for React Three Fiber using the @react-three/postprocessing ecosystem.

# Features

- RGB Channel Mixer
- Per-hue HSL adjustments (Red, Orange, Yellow, Green, Aqua, Blue, Purple, Magenta)
- Global controls for:
    - Brightness, Contrast, Saturation, Vibrancy, Gamma, Exposure
    - Hue rotation and Chromatic Aberration
    - Kelvin-based white balance (temperature)
    - Split toning with shadow/highlight tint
- Built-in filmic tone mapping
- GPU-accelerated fragment shader implementation

# Installation
```
npm install three react react-dom
```
Add the `ColorGradingGUI.jsx' file to your project.

# Use this Repository as a Demo or Checkout the 'Usage' Section Below
**File Structure**
```
project-root/
├── public/
│   └── assets/
│       └── checker.png
├── src/
│   ├── ColorGradingGUI.jsx
│   ├── ThreeScene.jsx
│   ├── main.jsx
│   └── threeScene.module.css
├── index.html
├── package.json
└── vite.config.js
```
**Description**

This sets up a basic ThreeJS scene with a camera, lighting, 3D model, ground mesh, and the color grading button. Select the button to open the menu and test the post processing tool. 

# Usage

Copy or download ColorGradingGUI.jsx and threeScene.module.css and import it into your scene. 

```jsx
import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass';
import ColorGradingGUI, { colorGradingShader } from './ColorGradingGUI.jsx';

function Scene() {
  const mountRef = useRef(null);
  const colorGradingPassRef = useRef(null);
  const [isColorGradingGUIOpen, setIsColorGradingGUIOpen] = useState(false);

  useEffect(() => {
    // Initialize scene, camera, and renderer

    // Basic object (e.g., a cube)

    // Basic lighting

    // Camera positioning

    // Set up post-processing
    const composer = new EffectComposer(renderer);
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);

    // Add color grading pass
    const colorGradingPass = new ShaderPass(colorGradingShader);
    composer.addPass(colorGradingPass);
    colorGradingPassRef.current = colorGradingPass;

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);
      composer.render();
    };
    animate();

    // Handle window resize
    const handleResize = () => {...};
    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      mountRef.current.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div ref={mountRef}>
      <button
        onClick={() => setIsColorGradingGUIOpen(!isColorGradingGUIOpen)}
        style={{ position: 'absolute', top: '10px', right: '10px', zIndex: 10 }}
      >
        Toggle Color Grading
      </button>
      {isColorGradingGUIOpen && colorGradingPassRef.current && (
        <div style={{ position: 'absolute', top: '40px', right: '10px', zIndex: 10 }}>
          <ColorGradingGUI colorGradingPass={colorGradingPassRef.current} />
        </div>
      )}
    </div>
  );
}

export default Scene;
```