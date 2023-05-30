import vertShaderCode from './shaders/cell.vert.wgsl';
import fragShaderCode from './shaders/cell.frag.wgsl';

const GRID_SIZE = 32;

const getBasics = async () => {
    const gpu = navigator.gpu;

    if (!gpu) {
        throw new Error('WebGPU is not supported on this browser.');
    }

    const adapter = await gpu.requestAdapter();
    const device = await adapter.requestDevice();
    const queue = device.queue;
    return { adapter, device, queue };
};

const canvasRelated = (device: GPUDevice) => {
    const canvas = document.getElementById('gfx') as HTMLCanvasElement;
    canvas.width = canvas.height = 1000;
    const context = canvas.getContext('webgpu');
    const canvasFormat = navigator.gpu.getPreferredCanvasFormat();
    context.configure({
        device: device,
        format: canvasFormat,
    });
    return { context, canvasFormat };
};

const main = async () => {
    const { adapter, device, queue } = await getBasics();
    const { context, canvasFormat } = canvasRelated(device);

    const vertices = new Float32Array([
        -0.8, -0.8, 0.8, -0.8, 0.8, 0.8,

        -0.8, -0.8, 0.8, 0.8, -0.8, 0.8,
    ]);

    const vertexBuffer = device.createBuffer({
        label: 'Cell vertices',
        size: vertices.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });

    const vertexBufferLayout = {
        arrayStride: 8,
        attributes: [
            {
                format: 'float32x2',
                offset: 0,
                shaderLocation: 0, // Position. Matches @location(0) in the @vertex shader.
            },
        ],
    };

    // Create the shader that will render the cells.
    const cellShaderModule = device.createShaderModule({
        label: 'Cell shader',
        code: `${vertShaderCode}${fragShaderCode}`,
    });

    // Create a pipeline that renders the cell.
    const cellPipeline = device.createRenderPipeline({
        label: 'Cell pipeline',
        layout: 'auto',
        vertex: {
            module: cellShaderModule,
            entryPoint: 'vertexMain',
            // @ts-ignore
            buffers: [vertexBufferLayout],
        },
        fragment: {
            module: cellShaderModule,
            entryPoint: 'fragmentMain',
            targets: [
                {
                    format: canvasFormat,
                },
            ],
        },
    });

    // Clear the canvas with a render pass
    const encoder = device.createCommandEncoder();

    const pass = encoder.beginRenderPass({
        colorAttachments: [
            {
                view: context.getCurrentTexture().createView(),
                loadOp: 'clear',
                clearValue: { r: 0, g: 0, b: 0.4, a: 1.0 },
                storeOp: 'store',
            },
        ],
    });

    queue.writeBuffer(vertexBuffer, 0, vertices);

    // Draw the square.
    pass.setPipeline(cellPipeline);
    pass.setVertexBuffer(0, vertexBuffer);
    pass.draw(vertices.length / 2);

    pass.end();

    queue.submit([encoder.finish()]);
};

main();
