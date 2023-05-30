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
    return { device };
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

const getCellPipeline = (device, canvasFormat) => {
    const vertexBufferLayout = {
        arrayStride: 8, // vertices is actually 4 vértices. Each vertex is 2 floats, so 32 bits x 2 = 64 bits = 8 bytes.
        attributes: [
            //  individual pieces of information encoded into each vertex
            {
                format: 'float32x2', // Again, each vertex is 2 floats.
                offset: 0, // This buffer only has position data (no extra data), so the offset is 0.
                shaderLocation: 0, // Arbitrary number between 0 and 15 and must be unique for every attribute that you define. Matches @location(0) in the @vertex shader.
            },
        ],
    };

    // Create the shader that will render the cells.
    const cellShaderVert = device.createShaderModule({
        label: 'Cell Vert shader',
        code: vertShaderCode, // VertexShader calculates position.
    });
    const cellShaderFrag = device.createShaderModule({
        label: 'Cell Frag shader',
        code: fragShaderCode, // FragmentShader calculates color.
    });

    // Create a pipeline that renders the cell.
    const cellPipeline = device.createRenderPipeline({
        label: 'Cell pipeline',
        layout: 'auto',
        vertex: {
            module: cellShaderVert,
            entryPoint: 'vertexMain',
            // @ts-ignore
            buffers: [vertexBufferLayout],
        },
        fragment: {
            module: cellShaderFrag,
            entryPoint: 'fragmentMain',
            targets: [
                {
                    format: canvasFormat,
                },
            ],
        },
    });

    return cellPipeline;
};

const main = async () => {
    const { device } = await getBasics();
    const { context, canvasFormat } = canvasRelated(device);

    const vertices = new Float32Array([
        -0.8, -0.8, 0.8, -0.8, 0.8, 0.8,

        -0.8, -0.8, 0.8, 0.8, -0.8, 0.8,
    ]);

    const vertexBuffer = device.createBuffer({
        label: 'Cell vertices',
        size: vertices.byteLength, // if 1 byte = 8 bits, and the array is a 32 bit array: 32 x 12 = 384 bits. 384 / 8 = 48 bytes.
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST, // this buffer will be used to supply vertex data and can be the destination for copy commands.
    });
    device.queue.writeBuffer(vertexBuffer, 0, vertices);

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

    // Draw the square.
    pass.setPipeline(getCellPipeline(device, canvasFormat));
    pass.setVertexBuffer(0, vertexBuffer);
    pass.draw(vertices.length / 2);

    pass.end();

    device.queue.submit([encoder.finish()]);
};

main();
