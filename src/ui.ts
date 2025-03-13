import { Pane } from 'tweakpane';
import Stats from 'stats.js';
import { ShapeType } from './mesh';

export interface UIParams {
    resolution: number;
    rotationSpeed: number;
    useQuantizedMesh: boolean;
    shape: ShapeType;
    doubleSided: boolean;
    isPaused: boolean;
}

function getUrlParams(): Partial<UIParams> {
    const params = new URLSearchParams(window.location.search);
    const result: Partial<UIParams> = {};

    // Parse resolution
    const resolution = params.get('resolution');
    if (resolution) {
        const resValue = parseInt(resolution, 10);
        if (!isNaN(resValue) && resValue >= 512 && resValue <= 8192) {
            result.resolution = resValue;
        }
    }

    // Parse shape
    const shape = params.get('shape') as ShapeType;
    if (shape && ['sphere', 'wavySphere', 'roundedBox'].includes(shape)) {
        result.shape = shape;
    }

    // Parse boolean parameters
    const useQuantized = params.get('useQuantizedMesh');
    if (useQuantized !== null) {
        result.useQuantizedMesh = useQuantized === 'true';
    }

    const doubleSided = params.get('doubleSided');
    if (doubleSided !== null) {
        result.doubleSided = doubleSided === 'true';
    }

    // Parse rotation speed
    const rotationSpeed = params.get('rotationSpeed');
    if (rotationSpeed) {
        const speedValue = parseFloat(rotationSpeed);
        if (!isNaN(speedValue) && speedValue >= 0 && speedValue <= 5) {
            result.rotationSpeed = speedValue;
        }
    }

    return result;
}

function updateUrlParams(params: UIParams) {
    const urlParams = new URLSearchParams();
    urlParams.set('resolution', params.resolution.toString());
    urlParams.set('shape', params.shape);
    urlParams.set('useQuantizedMesh', params.useQuantizedMesh.toString());
    urlParams.set('doubleSided', params.doubleSided.toString());
    urlParams.set('rotationSpeed', params.rotationSpeed.toString());

    const newUrl = `${window.location.pathname}?${urlParams.toString()}`;
    window.history.replaceState({}, '', newUrl);
}

export function setupUI() {
    const urlParams = getUrlParams();

    const params: UIParams = {
        resolution: urlParams.resolution ?? 512,
        rotationSpeed: urlParams.rotationSpeed ?? 0.5,
        useQuantizedMesh: urlParams.useQuantizedMesh ?? false,
        shape: urlParams.shape ?? 'sphere',
        doubleSided: urlParams.doubleSided ?? false,
        isPaused: false
    };

    const pane = new Pane();
    pane.addBinding(params, 'resolution', { min: 512, max: 8192, step: 512 });
    pane.addBinding(params, 'rotationSpeed', { min: 0, max: 3 });
    pane.addBinding(params, 'useQuantizedMesh');
    pane.addBinding(params, 'doubleSided');
    pane.addBinding(params, 'isPaused');
    pane.addBinding(params, 'shape', {
        options: {
            'Sphere': 'sphere',
            'Wavy Sphere': 'wavySphere',
            'Rounded Box': 'roundedBox'
        }
    });

    // Update URL when parameters change
    pane.on('change', () => {
        updateUrlParams(params);
    });

    const stats = new Stats();
    stats.showPanel(0);
    document.body.appendChild(stats.dom);

    return { params, stats, pane };
}