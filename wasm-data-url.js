let wasm;
let wasmReady = false;

const heap = new Array(128).fill(undefined);
heap.push(undefined, null, true, false);
let heap_next = heap.length;

function addHeapObject(obj) {
    if (heap_next === heap.length) heap.push(heap.length + 1);
    const idx = heap_next;
    heap_next = heap[idx];
    heap[idx] = obj;
    return idx;
}

function getObject(idx) { 
    return heap[idx]; 
}

function dropObject(idx) {
    if (idx < 132) return;
    heap[idx] = heap_next;
    heap_next = idx;
}

function takeObject(idx) {
    const ret = getObject(idx);
    dropObject(idx);
    return ret;
}

function debugString(val) {
    const type = typeof val;
    if (type == 'number' || type == 'boolean' || val == null) {
        return  `${val}`;
    }
    if (type == 'string') {
        return `"${val}"`;
    }
    if (type == 'symbol') {
        const description = val.description;
        if (description == null) {
            return 'Symbol';
        } else {
            return `Symbol(${description})`;
        }
    }
    if (type == 'function') {
        const name = val.name;
        if (typeof name == 'string' && name.length > 0) {
            return `Function(${name})`;
        } else {
            return 'Function';
        }
    }
    if (Array.isArray(val)) {
        const length = val.length;
        let debug = '[';
        if (length > 0) {
            debug += debugString(val[0]);
        }
        for(let i = 1; i < length; i++) {
            debug += ', ' + debugString(val[i]);
        }
        debug += ']';
        return debug;
    }
    const builtInMatches = /\[object ([^\]]+)\]/.exec(toString.call(val));
    let className;
    if (builtInMatches && builtInMatches.length > 1) {
        className = builtInMatches[1];
    } else {
        return toString.call(val);
    }
    if (className == 'Object') {
        try {
            return 'Object(' + JSON.stringify(val) + ')';
        } catch (_) {
            return 'Object';
        }
    }
    if (val instanceof Error) {
        return `${val.name}: ${val.message}\n${val.stack}`;
    }
    return className;
}

let WASM_VECTOR_LEN = 0;
let cachedUint8ArrayMemory0 = null;

function getUint8ArrayMemory0() {
    if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
        cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8ArrayMemory0;
}

const lTextEncoder = typeof TextEncoder === 'undefined' ? (0, module.require)('util').TextEncoder : TextEncoder;
let cachedTextEncoder = new lTextEncoder('utf-8');

const encodeString = (typeof cachedTextEncoder.encodeInto === 'function'
    ? function (arg, view) {
    return cachedTextEncoder.encodeInto(arg, view);
}
    : function (arg, view) {
    const buf = cachedTextEncoder.encode(arg);
    view.set(buf);
    return {
        read: arg.length,
        written: buf.length
    };
});

function passStringToWasm0(arg, malloc, realloc) {
    if (realloc === undefined) {
        const buf = cachedTextEncoder.encode(arg);
        const ptr = malloc(buf.length, 1) >>> 0;
        getUint8ArrayMemory0().subarray(ptr, ptr + buf.length).set(buf);
        WASM_VECTOR_LEN = buf.length;
        return ptr;
    }

    let len = arg.length;
    let ptr = malloc(len, 1) >>> 0;
    const mem = getUint8ArrayMemory0();
    let offset = 0;

    for (; offset < len; offset++) {
        const code = arg.charCodeAt(offset);
        if (code > 0x7F) break;
        mem[ptr + offset] = code;
    }

    if (offset !== len) {
        if (offset !== 0) {
            arg = arg.slice(offset);
        }
        ptr = realloc(ptr, len, len = offset + arg.length * 3, 1) >>> 0;
        const view = getUint8ArrayMemory0().subarray(ptr + offset, ptr + len);
        const ret = encodeString(arg, view);

        offset += ret.written;
        ptr = realloc(ptr, len, offset, 1) >>> 0;
    }

    WASM_VECTOR_LEN = offset;
    return ptr;
}

let cachedDataViewMemory0 = null;

function getDataViewMemory0() {
    if (cachedDataViewMemory0 === null || cachedDataViewMemory0.buffer.detached === true || (cachedDataViewMemory0.buffer.detached === undefined && cachedDataViewMemory0.buffer !== wasm.memory.buffer)) {
        cachedDataViewMemory0 = new DataView(wasm.memory.buffer);
    }
    return cachedDataViewMemory0;
}

const lTextDecoder = typeof TextDecoder === 'undefined' ? (0, module.require)('util').TextDecoder : TextDecoder;
let cachedTextDecoder = new lTextDecoder('utf-8', { ignoreBOM: true, fatal: true });
cachedTextDecoder.decode();

function getStringFromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

async function initializeWasm() {
    try {
        const response = await fetch(chrome.runtime.getURL('wasm_base64.txt'));
        const base64String = await response.text();
        const dataUrl = `data:application/wasm;base64,${base64String}`;
        
        const imports = {
            "./sonai_bg.js": {
                __wbg_new_405e22f390576ce2: function() {
                    const ret = new Object();
                    return addHeapObject(ret);
                },
                __wbg_set_3f1d0b984ed272ed: function(arg0, arg1, arg2) {
                    getObject(arg0)[takeObject(arg1)] = takeObject(arg2);
                },
                __wbindgen_debug_string: function(arg0, arg1) {
                    const ret = debugString(getObject(arg1));
                    const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_export_0, wasm.__wbindgen_export_1);
                    const len1 = WASM_VECTOR_LEN;
                    getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
                    getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
                },
                __wbindgen_number_new: function(arg0) {
                    const ret = arg0;
                    return addHeapObject(ret);
                },
                __wbindgen_object_clone_ref: function(arg0) {
                    const ret = getObject(arg0);
                    return addHeapObject(ret);
                },
                __wbindgen_object_drop_ref: function(arg0) {
                    takeObject(arg0);
                },
                __wbindgen_string_new: function(arg0, arg1) {
                    const ret = getStringFromWasm0(arg0, arg1);
                    return addHeapObject(ret);
                },
                __wbindgen_throw: function(arg0, arg1) {
                    throw new Error(getStringFromWasm0(arg0, arg1));
                }
            }
        };
        
        const result = await WebAssembly.instantiateStreaming(fetch(dataUrl), imports);
        wasm = result.instance.exports;
        
        if (wasm.__wbindgen_start) {
            wasm.__wbindgen_start();
        }
        
        wasmReady = true;
        console.log('New inference WASM model loaded successfully!');
        return true;
    } catch (error) {
        console.error('Failed to load WASM module:', error);
        wasmReady = false;
        return false;
    }
}

function predict(devlog) {
    if (!wasmReady || !wasm) {
        throw new Error('WASM module not ready');
    }
    
    const ptr0 = passStringToWasm0(devlog, wasm.__wbindgen_export_0, wasm.__wbindgen_export_1);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.predict(ptr0, len0);
    return takeObject(ret);
}

window.wasmAI = {
    initialize: initializeWasm,
    predict: predict,
    isReady: () => wasmReady
};

initializeWasm();