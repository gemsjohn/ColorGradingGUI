import React, { useState } from 'react';
import * as THREE from 'three';
import styles from './threeScene.module.css';


// Convert RGB (0-255) to hex color string
const rgbToHex = (r, g, b) => {
    const toHex = (value) => {
        const clamped = Math.round(Math.min(value, 255)).toString(16);
        return clamped.length === 1 ? '0' + clamped : clamped;
    };
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

// Convert hex color string to RGB object (0-255)
const hexToRgb = (hex) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return { r, g, b };
};

/* glsl */
export const fragmentShader = `
    uniform sampler2D tDiffuse;
    uniform float time;
    uniform vec3 uRedMix;
    uniform vec3 uGreenMix;
    uniform vec3 uBlueMix;
    uniform vec3 uShadowTint;
    uniform vec3 uHighlightTint;
    uniform float hueAdjust[8];
    uniform float satAdjust[8];
    uniform float lumAdjust[8];
    uniform float uBrightness;
    uniform float uContrast;
    uniform float uSaturation;
    uniform float uVibrancy;
    uniform float uHueOffset;
    uniform float uGamma;
    uniform float uSplitToneBalance;
    uniform float uExposure;
    uniform float uKelvin;
    uniform float uChromaticAberration;

    varying vec2 vUv;

    // Function definitions (unchanged): rgbToHsv, hsvToRgb, noise, etc.
    vec2 hash(vec2 p) {
        p = vec2(
            dot(p, vec2(127.1, 311.7)),
            dot(p, vec2(269.5, 183.3))
        );
        return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
    }

    vec3 rgbToHsv(vec3 c) {
        vec4 K = vec4(0., -1./3., 2./3., -1.);
        vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
        vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
        float d = q.x - min(q.w, q.y);
        float e = 1e-10;
        return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
    }

    vec3 hsvToRgb(vec3 c) {
        vec3 rgb = clamp(abs(mod(c.x * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
        return c.z * mix(vec3(1.0), rgb, c.y);
    }

    float noise(in vec2 p) {
        const float K1 = 0.366025404;
        const float K2 = 0.211324865;
        vec2 i = floor(p + (p.x + p.y) * K1);
        vec2 a = p - i + (i.x + i.y) * K2;
        vec2 o = (a.x > a.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
        vec2 b = a - o + K2;
        vec2 c = a - 1.0 + 2.0 * K2;
        vec3 h = max(0.5 - vec3(dot(a,a), dot(b,b), dot(c,c)), 0.0);
        vec3 n = h * h * h * h * vec3(
            dot(a, hash(i + 0.0)),
            dot(b, hash(i + o)),
            dot(c, hash(i + 1.0))
        );
        return dot(n, vec3(70.0));
    }

    vec3 colorChannelMixer(vec3 inputColor, vec3 redMix, vec3 greenMix, vec3 blueMix, float brightness, float contrast) {
        mat3 mixMatrix = mat3(redMix, greenMix, blueMix);
        vec3 mixedColor = mixMatrix * inputColor;
        mixedColor = max(vec3(0.0), mixedColor * contrast + brightness);
        return mixedColor;
    }

    vec3 colorContrast(vec3 color, float contrast) {
        float midPoint = pow(0.5, 2.2);
        return (color - midPoint) * contrast + midPoint;
    }

    vec3 colorSaturation(vec3 color, float saturation) {
        float luminance = dot(color, vec3(0.299, 0.587, 0.114));
        vec3 grayscale = vec3(luminance);
        return mix(grayscale, color, 1.0 + saturation);
    }

    vec3 colorHueRadians(vec3 inputColor, float offset) {
        vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
        vec4 P = mix(vec4(inputColor.bg, K.wz), vec4(inputColor.gb, K.xy), step(inputColor.b, inputColor.g));
        vec4 Q = mix(vec4(P.xyw, inputColor.r), vec4(inputColor.r, P.yzx), step(P.x, inputColor.r));
        float D = Q.x - min(Q.w, Q.y);
        float E = 1e-10;
        vec3 hsv = vec3(abs(Q.z + (Q.w - Q.y) / (6.0 * D + E)), D / (Q.x + E), Q.x);
        float hue = hsv.x + offset;
        hsv.x = (hue < 0.0) ? hue + 1.0 : (hue > 1.0) ? hue - 1.0 : hue;
        vec4 K2 = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
        vec3 P2 = abs(fract(hsv.xxx + K2.xyz) * 6.0 - K2.www);
        return hsv.z * mix(K2.xxx, clamp(P2 - K2.xxx, 0.0, 1.0), hsv.y);
    }

    vec3 gammaCorrect(vec3 color, float gamma) {
        return pow(clamp(color, 0.0, 1.0), vec3(1.0 / gamma));
    }

    vec3 colorVibrancy(vec3 color, float vibrancy) {
        float maxVal = max(max(color.r, color.g), color.b);
        float minVal = min(min(color.r, color.g), color.b);
        float sat = maxVal - minVal;
        float vibFactor = smoothstep(0.0, 0.5, sat);
        vibFactor = 1.0 + vibrancy * (1.0 - vibFactor);
        float luminance = dot(color, vec3(0.299, 0.587, 0.114));
        vec3 gray = vec3(luminance);
        return mix(gray, color, vibFactor);
    }

    vec3 splitToning(vec3 color, vec3 shadows, vec3 highlights, float balance) {
        float luminance = dot(color, vec3(0.299, 0.587, 0.114));
        vec3 tone = mix(shadows, highlights, smoothstep(0.0, 1.0, luminance + balance));
        return color * tone;
    }

    float posterize(float value, float steps) {
        return floor(value / (1.0 / steps)) * (1.0 / steps);
    }

    vec3 applyExposure(vec3 color, float exposure) {
        return color * pow(2.0, exposure);
    }

    vec3 colorTemperature(vec3 color, float kelvin) {
        kelvin = clamp(kelvin, 1000.0, 40000.0) / 100.0;
        float red, green, blue;
        if (kelvin <= 66.0) {
            red = 1.0;
        } else {
            red = kelvin - 60.0;
            red = 329.698727446 * pow(red, -0.1332047592) / 255.0;
            red = clamp(red, 0.0, 1.0);
        }
        if (kelvin <= 66.0) {
            green = kelvin;
            green = 99.4708025861 * log(green) - 161.1195681661;
            green /= 255.0;
        } else {
            green = kelvin - 60.0;
            green = 288.1221695283 * pow(green, -0.0755148492);
            green /= 255.0;
        }
        green = clamp(green, 0.0, 1.0);
        if (kelvin >= 66.0) {
            blue = 1.0;
        } else if (kelvin <= 19.0) {
            blue = 0.0;
        } else {
            blue = kelvin - 10.0;
            blue = 138.5177312231 * log(blue) - 305.0447927307;
            blue /= 255.0;
            blue = clamp(blue, 0.0, 1.0);
        }
        vec3 tempColor = vec3(red, green, blue);
        return color * tempColor;
    }

    int getHueRange(float hue) {
        if (hue < 0.04 || hue > 0.96) return 0;
        else if (hue < 0.10) return 1;
        else if (hue < 0.17) return 2;
        else if (hue < 0.30) return 3;
        else if (hue < 0.45) return 4;
        else if (hue < 0.60) return 5;
        else if (hue < 0.75) return 6;
        else return 7;
    }

    const int NUM_RANGES = 8;
    const float TWO_PI = 6.28318530718;

    float circularDistance(float a, float b) {
        float diff = abs(a - b);
        return min(diff, 1.0 - diff);
    }

    vec3 applyHslPerRange(vec3 color) {
        vec3 hsv = rgbToHsv(color);
        float hue = hsv.x;
        float totalWeight = 0.0;
        float hShift = 0.0;
        float sShift = 0.0;
        float lShift = 0.0;
        for (int i = 0; i < NUM_RANGES; i++) {
            float centerHue = float(i) / float(NUM_RANGES);
            float dist = circularDistance(hue, centerHue);
            float sigma = 0.08;
            float weight = exp(-pow(dist, 2.0) / (2.0 * sigma * sigma));
            hShift += weight * hueAdjust[i];
            sShift += weight * satAdjust[i];
            lShift += weight * lumAdjust[i];
            totalWeight += weight;
        }
        hShift /= totalWeight;
        sShift /= totalWeight;
        lShift /= totalWeight;
        hsv.x = mod(hsv.x + hShift, 1.0);
        hsv.y = clamp(hsv.y + sShift, 0.0, 1.0);
        hsv.z = clamp(hsv.z + lShift, 0.0, 1.0);
        return hsvToRgb(hsv);
    }

    vec3 toneMapFilmic(vec3 x) {
        return (x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14);
    }

    vec3 chromaticAberration(vec2 uv, float amount) {
        vec2 center = vec2(0.5);
        float dist = distance(uv, center);
        float strength = pow(dist, 2.0) * amount;
        vec2 direction = normalize(uv - center);
        vec2 rOffset = direction * strength * 1.0;
        vec2 bOffset = direction * strength * -1.0;
        float r = texture2D(tDiffuse, uv + rOffset).r;
        float g = texture2D(tDiffuse, uv).g;
        float b = texture2D(tDiffuse, uv + bOffset).b;
        return vec3(r, g, b);
    }

    vec3 applyLiftGammaGain(vec3 color, vec3 lift, vec3 gamma, vec3 gain) {
        vec3 lifted = color + lift;
        vec3 gained = lifted * gain;
        vec3 corrected = pow(max(vec3(0.0), gained), 1.0 / max(vec3(0.01), gamma));
        return clamp(corrected, 0.0, 1.0);
    }

    // Main entry point
    void main() {
        vec3 color = texture2D(tDiffuse, vUv).rgb;
        color = chromaticAberration(vUv, uChromaticAberration);
        color = colorChannelMixer(color, uRedMix, uGreenMix, uBlueMix, uBrightness, 1.0);
        color = applyExposure(color, uExposure);
        color = colorContrast(color, uContrast);
        color = gammaCorrect(color, uGamma);
        color = colorTemperature(color, uKelvin);
        color = colorHueRadians(color, uHueOffset);
        color = colorSaturation(color, uSaturation);
        color = colorVibrancy(color, uVibrancy);
        color = splitToning(color, uShadowTint, uHighlightTint, uSplitToneBalance);
        color = applyHslPerRange(color);
        color = toneMapFilmic(color);
        gl_FragColor = vec4(color, 1.0);
    }
`;

export const colorGradingShader = {
    uniforms: {
        tDiffuse: { value: null },
        time: { value: 0 },
        uRedMix: { value: new THREE.Vector3(1.2, 0, 0) },
        uGreenMix: { value: new THREE.Vector3(0, 1, 0) },
        uBlueMix: { value: new THREE.Vector3(0, 0.1, 0.95) },
        uSaturation: { value: 0.6 },
        uVibrancy: { value: 1.1 },
        uBrightness: { value: 0 },
        uContrast: { value: 1 },
        uHueOffset: { value: 0 },
        uGamma: { value: 1.1 },
        uShadowTint: { value: new THREE.Vector3(0.6, 0.6, 0.6) },
        uHighlightTint: { value: new THREE.Vector3(0.9, 1.0, 1.0) },
        uSplitToneBalance: { value: 0.0 },
        uExposure: { value: 0.1 },
        uKelvin: { value: 4000 },
        uChromaticAberration: { value: 0 },
        hueAdjust: { value: new Float32Array(8) },
        satAdjust: { value: new Float32Array(8) },
        lumAdjust: { value: new Float32Array(8) },
    },
    vertexShader: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: fragmentShader,
};

function ColorGradingGUI({ colorGradingPass }) {
    const uniforms = colorGradingPass.material.uniforms;

    // Initialize local state for scalar uniforms
    const [scalarValues, setScalarValues] = useState({
        uSaturation: uniforms.uSaturation.value,
        uVibrancy: uniforms.uVibrancy.value,
        uBrightness: uniforms.uBrightness.value,
        uContrast: uniforms.uContrast.value,
        uHueOffset: uniforms.uHueOffset.value,
        uGamma: uniforms.uGamma.value,
        uSplitToneBalance: uniforms.uSplitToneBalance.value,
        uExposure: uniforms.uExposure.value,
        uKelvin: uniforms.uKelvin.value,
        uChromaticAberration: uniforms.uChromaticAberration.value,
    });

    // Initialize state for vector uniforms
    const [vectorValues, setVectorValues] = useState({
        uRedMix: uniforms.uRedMix.value.clone(),
        uGreenMix: uniforms.uGreenMix.value.clone(),
        uBlueMix: uniforms.uBlueMix.value.clone(),
        uShadowTint: uniforms.uShadowTint.value.clone(),
        uHighlightTint: uniforms.uHighlightTint.value.clone(),
    });

    // Initialize state for array uniforms
    const [hueAdjust, setHueAdjust] = useState([...uniforms.hueAdjust.value]);
    const [satAdjust, setSatAdjust] = useState([...uniforms.satAdjust.value]);
    const [lumAdjust, setLumAdjust] = useState([...uniforms.lumAdjust.value]);

    // Function to update uniforms and local state
    const updateUniform = (name, value) => {
        if (uniforms[name]) {
            uniforms[name].value = value;

            if (name in scalarValues) {
                setScalarValues((prev) => ({ ...prev, [name]: value }));
            } else if (name in vectorValues) {
                setVectorValues((prev) => ({ ...prev, [name]: value.clone() }));
            } else if (name === 'hueAdjust') {
                setHueAdjust([...value]);
            } else if (name === 'satAdjust') {
                setSatAdjust([...value]);
            } else if (name === 'lumAdjust') {
                setLumAdjust([...value]);
            }
        }
    };

    // Helper functions for color conversion
    const vector3ToHex = (vector) => {
        const color = new THREE.Color(vector.x, vector.y, vector.z);
        return `#${color.getHexString()}`;
    };

    const hexToVector3 = (hex) => {
        const color = new THREE.Color(hex);
        return new THREE.Vector3(color.r, color.g, color.b);
    };

    return (
        <div className={styles.colorGradingGui}>
            <h2 className={styles.rajdhani}>Color Grading</h2>
            {/* Vector Controls */}
            <div style={{ margin: '4px 0px 4px 10px', display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
                <label className={styles.rajdhani} style={{ width: '100px' }}>Red Mix</label>
                <div className={styles.colorPickerContainer}>
                    <input
                        type="color"
                        value={rgbToHex(vectorValues.uRedMix.x * 255, vectorValues.uRedMix.y * 255, vectorValues.uRedMix.z * 255)}
                        onChange={(e) => {
                            const { r, g, b } = hexToRgb(e.target.value);
                            const newVector = vectorValues.uRedMix.clone();
                            newVector.x = r / 255;
                            newVector.y = g / 255;
                            newVector.z = b / 255;
                            updateUniform('uRedMix', newVector);
                        }}
                        className={styles.colorPicker}
                    />
                </div>
            </div>

            <div style={{ margin: '4px 0px 4px 10px', display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
                <label className={styles.rajdhani} style={{ width: '100px' }}>Green Mix</label>
                <div className={styles.colorPickerContainer}>
                    <input
                        type="color"
                        value={rgbToHex(vectorValues.uGreenMix.x * 255, vectorValues.uGreenMix.y * 255, vectorValues.uGreenMix.z * 255)}
                        onChange={(e) => {
                            const { r, g, b } = hexToRgb(e.target.value);
                            const newVector = vectorValues.uGreenMix.clone();
                            newVector.x = r / 255;
                            newVector.y = g / 255;
                            newVector.z = b / 255;
                            updateUniform('uGreenMix', newVector);
                        }}
                        className={styles.colorPicker}
                    />
                </div>
            </div>

            <div style={{ margin: '4px 0px 4px 10px', display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
                <label className={styles.rajdhani} style={{ width: '100px' }}>Blue Mix</label>
                <div className={styles.colorPickerContainer}>
                    <input
                        type="color"
                        value={rgbToHex(vectorValues.uBlueMix.x * 255, vectorValues.uBlueMix.y * 255, vectorValues.uBlueMix.z * 255)}
                        onChange={(e) => {
                            const { r, g, b } = hexToRgb(e.target.value);
                            const newVector = vectorValues.uBlueMix.clone();
                            newVector.x = r / 255;
                            newVector.y = g / 255;
                            newVector.z = b / 255;
                            updateUniform('uBlueMix', newVector);
                        }}
                        className={styles.colorPicker}
                    />
                </div>
            </div>

            <div style={{ margin: '4px 0px 4px 10px', display: 'flex', flexDirection: 'row' }}>
                <label className={styles.rajdhani} style={{
                    fontSize: '12px',
                    width: '20ch',
                    textOverflow: 'ellipsis',
                    overflow: 'hidden',
                    whiteSpace: 'nowrap',
                }}>
                    brightness [ {scalarValues.uBrightness} ]
                </label>
                <div className={styles.sliderContainer}>
                    <input
                        type="range"
                        min="-1"
                        max="1"
                        step="0.01"
                        value={scalarValues.uBrightness}
                        onChange={(e) => updateUniform('uBrightness', parseFloat(e.target.value))}
                        className={styles.slider}
                    />
                </div>
            </div>

            <div style={{ margin: '4px 0px 4px 10px', display: 'flex', flexDirection: 'row' }}>
                <label className={styles.rajdhani} style={{
                    fontSize: '12px',
                    width: '20ch',
                    textOverflow: 'ellipsis',
                    overflow: 'hidden',
                    whiteSpace: 'nowrap',
                }}>
                    contrast [ {scalarValues.uContrast} ]
                </label>
                <div className={styles.sliderContainer}>
                    <input
                        type="range"
                        min="0"
                        max="2"
                        step="0.01"
                        value={scalarValues.uContrast}
                        onChange={(e) => updateUniform('uContrast', parseFloat(e.target.value))}
                        className={styles.slider}
                    />
                </div>
            </div>

            {/* Scalar Controls */}
            <div style={{ margin: '4px 0px 4px 10px', display: 'flex', flexDirection: 'row' }}>
                <label className={styles.rajdhani} style={{
                    fontSize: '12px',
                    width: '20ch',
                    textOverflow: 'ellipsis',
                    overflow: 'hidden',
                    whiteSpace: 'nowrap',
                }}>
                    saturation [ {scalarValues.uSaturation} ]
                </label>
                <div className={styles.sliderContainer}>
                    <input
                        type="range"
                        min="0"
                        max="2"
                        step="0.01"
                        value={scalarValues.uSaturation}
                        onChange={(e) => updateUniform('uSaturation', parseFloat(e.target.value))}
                        className={styles.slider}
                    />
                </div>
            </div>

            <div style={{ margin: '4px 0px 4px 10px', display: 'flex', flexDirection: 'row' }}>
                <label className={styles.rajdhani} style={{
                    fontSize: '12px',
                    width: '20ch',
                    textOverflow: 'ellipsis',
                    overflow: 'hidden',
                    whiteSpace: 'nowrap',
                }}>
                    vibrancy [ {scalarValues.uVibrancy} ]
                </label>
                <div className={styles.sliderContainer}>
                    <input
                        type="range"
                        min="0"
                        max="2"
                        step="0.01"
                        value={scalarValues.uVibrancy}
                        onChange={(e) => updateUniform('uVibrancy', parseFloat(e.target.value))}
                        className={styles.slider}
                    />
                </div>
            </div>

            <div style={{ margin: '4px 0px 4px 10px', display: 'flex', flexDirection: 'row' }}>
                <label className={styles.rajdhani} style={{
                    fontSize: '12px',
                    width: '20ch',
                    textOverflow: 'ellipsis',
                    overflow: 'hidden',
                    whiteSpace: 'nowrap',
                }}>
                    hueOffset [ {scalarValues.uHueOffset} ]
                </label>
                <div className={styles.sliderContainer}>
                    <input
                        type="range"
                        min="-1"
                        max="1"
                        step="0.01"
                        value={scalarValues.uHueOffset}
                        onChange={(e) => updateUniform('uHueOffset', parseFloat(e.target.value))}
                        className={styles.slider}
                    />
                </div>
            </div>

            <div style={{ margin: '4px 0px 4px 10px', display: 'flex', flexDirection: 'row' }}>
                <label className={styles.rajdhani} style={{
                    fontSize: '12px',
                    width: '20ch',
                    textOverflow: 'ellipsis',
                    overflow: 'hidden',
                    whiteSpace: 'nowrap',
                }}>
                    gamma [ {scalarValues.uGamma} ]
                </label>
                <div className={styles.sliderContainer}>
                    <input
                        type="range"
                        min="0.1"
                        max="2"
                        step="0.01"
                        value={scalarValues.uGamma}
                        onChange={(e) => updateUniform('uGamma', parseFloat(e.target.value))}
                        className={styles.slider}
                    />
                </div>
            </div>

            <div style={{ margin: '4px 0px 4px 10px', display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
                <label className={styles.rajdhani} style={{
                    fontSize: '12px',
                    width: '20ch',
                    textOverflow: 'ellipsis',
                    overflow: 'hidden',
                    whiteSpace: 'nowrap',
                }}>
                    shadow tint
                </label>
                <div className={styles.colorPickerContainer}>
                    <input
                        type="color"
                        value={vector3ToHex(vectorValues.uShadowTint)}
                        onChange={(e) => {
                            const newVector = hexToVector3(e.target.value);
                            updateUniform('uShadowTint', newVector);
                        }}
                        className={styles.colorPicker}
                    />
                </div>
            </div>

            <div style={{ margin: '4px 0px 4px 10px', display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
                <label className={styles.rajdhani} style={{
                    fontSize: '12px',
                    width: '20ch',
                    textOverflow: 'ellipsis',
                    overflow: 'hidden',
                    whiteSpace: 'nowrap',
                }}>
                    highlight tint
                </label>
                <div className={styles.colorPickerContainer}>
                    <input
                        type="color"
                        value={vector3ToHex(vectorValues.uHighlightTint)}
                        onChange={(e) => {
                            const newVector = hexToVector3(e.target.value);
                            updateUniform('uHighlightTint', newVector);
                        }}
                        className={styles.colorPicker}
                    />
                </div>
            </div>

            <div style={{ margin: '4px 0px 4px 10px', display: 'flex', flexDirection: 'row' }}>
                <label className={styles.rajdhani} style={{
                    fontSize: '12px',
                    width: '20ch',
                    textOverflow: 'ellipsis',
                    overflow: 'hidden',
                    whiteSpace: 'nowrap',
                }}>
                    splitToneBalance [ {scalarValues.uSplitToneBalance} ]
                </label>
                <div className={styles.sliderContainer}>
                    <input
                        type="range"
                        min="-1"
                        max="1"
                        step="0.01"
                        value={scalarValues.uSplitToneBalance}
                        onChange={(e) => updateUniform('uSplitToneBalance', parseFloat(e.target.value))}
                        className={styles.slider}
                    />
                </div>
            </div>

            <div style={{ margin: '4px 0px 4px 10px', display: 'flex', flexDirection: 'row' }}>
                <label className={styles.rajdhani} style={{
                    fontSize: '12px',
                    width: '20ch',
                    textOverflow: 'ellipsis',
                    overflow: 'hidden',
                    whiteSpace: 'nowrap',
                }}>
                    exposure [ {scalarValues.uExposure} ]
                </label>
                <div className={styles.sliderContainer}>
                    <input
                        type="range"
                        min="-5"
                        max="5"
                        step="0.01"
                        value={scalarValues.uExposure}
                        onChange={(e) => updateUniform('uExposure', parseFloat(e.target.value))}
                        className={styles.slider}
                    />
                </div>
            </div>

            <div style={{ margin: '4px 0px 4px 10px', display: 'flex', flexDirection: 'row' }}>
                <label className={styles.rajdhani} style={{
                    fontSize: '12px',
                    width: '20ch',
                    textOverflow: 'ellipsis',
                    overflow: 'hidden',
                    whiteSpace: 'nowrap',
                }}>
                    kelvin [ {scalarValues.uKelvin} ]
                </label>
                <div className={styles.sliderContainer}>
                    <input
                        type="range"
                        min="1000"
                        max="40000"
                        step="100"
                        value={scalarValues.uKelvin}
                        onChange={(e) => updateUniform('uKelvin', parseFloat(e.target.value))}
                        className={styles.slider}
                    />
                </div>
            </div>

            <div style={{ margin: '4px 0px 4px 10px', display: 'flex', flexDirection: 'row' }}>
                <label className={styles.rajdhani} style={{
                    fontSize: '12px',
                    width: '20ch',
                    textOverflow: 'ellipsis',
                    overflow: 'hidden',
                    whiteSpace: 'nowrap',
                }}>
                    chromaticAberration [ {scalarValues.uChromaticAberration} ]
                </label>
                <div className={styles.sliderContainer}>
                    <input
                        type="range"
                        min="0"
                        max="0.05"
                        step="0.001"
                        value={scalarValues.uChromaticAberration}
                        onChange={(e) => updateUniform('uChromaticAberration', parseFloat(e.target.value))}
                        className={styles.slider}
                    />
                </div>
            </div>

            <h2 className={styles.rajdhani}>Hue Adjustments</h2>
            {/* Array Controls */}
            <details>
                <summary>Hue Adjustments</summary>
                {hueAdjust.map((value, i) => (
                    <div
                        key={i}
                        className={styles.sliderHueContainer}
                        style={{ margin: '4px 0px 4px 10px', display: 'flex', flexDirection: 'row' }}
                    >
                        <label className={styles.rajdhani} style={{
                            fontSize: '12px',
                            width: '20ch',
                            textOverflow: 'ellipsis',
                            overflow: 'hidden',
                            whiteSpace: 'nowrap',
                        }}>
                            Hue {i}
                        </label>
                        <div className={styles.sliderHueContainer}>
                            <input
                                type="range"
                                min="-1"
                                max="1"
                                step="0.01"
                                value={value}
                                onChange={(e) => {
                                    const newValue = parseFloat(e.target.value);
                                    const newArray = [...hueAdjust];
                                    newArray[i] = newValue;
                                    updateUniform('hueAdjust', new Float32Array(newArray));
                                }}
                                className={styles.slider}
                            />
                        </div>
                    </div>
                ))}
            </details>

            <details>
                <summary>Saturation Adjustments</summary>
                {satAdjust.map((value, i) => (
                    <div
                        key={i}
                        className={styles.sliderHueContainer}
                        style={{ margin: '4px 0px 4px 10px', display: 'flex', flexDirection: 'row' }}
                    >
                        <label className={styles.rajdhani} style={{
                            fontSize: '12px',
                            width: '20ch',
                            textOverflow: 'ellipsis',
                            overflow: 'hidden',
                            whiteSpace: 'nowrap',
                        }}>
                            Sat {i}
                        </label>
                        <div className={styles.sliderHueContainer}>
                            <input
                                type="range"
                                min="-1"
                                max="1"
                                step="0.01"
                                value={value}
                                onChange={(e) => {
                                    const newValue = parseFloat(e.target.value);
                                    const newArray = [...satAdjust];
                                    newArray[i] = newValue;
                                    updateUniform('satAdjust', new Float32Array(newArray));
                                }}
                                className={styles.slider}
                            />
                        </div>
                    </div>
                ))}
            </details>

            <details>
                <summary>Luminance Adjustments</summary>
                {lumAdjust.map((value, i) => (
                    <div
                        key={i}
                        className={styles.sliderHueContainer}
                        style={{ margin: '4px 0px 4px 10px', display: 'flex', flexDirection: 'row' }}
                    >
                        <label className={styles.rajdhani} style={{
                            fontSize: '12px',
                            width: '20ch',
                            textOverflow: 'ellipsis',
                            overflow: 'hidden',
                            whiteSpace: 'nowrap',
                        }}>
                            Lum {i}
                        </label>
                        <div className={styles.sliderHueContainer}>
                            <input
                                type="range"
                                min="-1"
                                max="1"
                                step="0.01"
                                value={value}
                                onChange={(e) => {
                                    const newValue = parseFloat(e.target.value);
                                    const newArray = [...lumAdjust];
                                    newArray[i] = newValue;
                                    updateUniform('lumAdjust', new Float32Array(newArray));
                                }}
                                className={styles.slider}
                            />
                        </div>
                    </div>
                ))}
            </details>
        </div>
    );
}

export default ColorGradingGUI;