import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

globalThis.window = {};
let hitElement = null;
globalThis.document = {
    elementFromPoint() {
        return hitElement;
    }
};

const zoomPath = new URL('../src/Jellyfin.Plugin.AdvancedBooks/Reader/advancedBooksZoom.js', import.meta.url);
vm.runInThisContext(fs.readFileSync(zoomPath, 'utf8'), {
    filename: zoomPath.pathname
});

const zoom = globalThis.window.AdvancedBooksZoom;
assert.ok(zoom, 'AdvancedBooksZoom was not installed');

{
    const stage = {
        getBoundingClientRect: () => ({ left: 10, top: 20, width: 100, height: 80 })
    };
    assert.deepEqual(zoom.normalizeAnchor(stage, null), {
        clientX: 60,
        clientY: 60,
        localX: 50,
        localY: 40,
        centerX: 50,
        centerY: 40
    });
    assert.deepEqual(zoom.normalizeAnchor(stage, { clientX: 35, clientY: 45 }), {
        clientX: 35,
        clientY: 45,
        localX: 25,
        localY: 25,
        centerX: 50,
        centerY: 40
    });
}

{
    const image = {
        offsetLeft: 200,
        offsetTop: 100,
        offsetWidth: 600,
        offsetHeight: 800
    };
    const pages = {
        clientWidth: 1000,
        clientHeight: 1000,
        querySelectorAll: () => [image]
    };
    const stage = { clientWidth: 1000, clientHeight: 800 };
    const reader = {
        zoom: 2,
        panX: 999,
        panY: -999,
        isContinuous: () => false
    };
    zoom.clampPagedPan(reader, stage, pages);
    assert.equal(reader.panX, 100, 'right paged pan bound');
    assert.equal(reader.panY, -400, 'top paged pan bound');

    reader.zoom = 1;
    reader.panX = 10;
    reader.panY = 20;
    zoom.clampPagedPan(reader, stage, pages);
    assert.equal(reader.panX, 0, 'pan resets at 100%');
    assert.equal(reader.panY, 0, 'pan resets at 100%');
}

{
    const image = {
        offsetLeft: 100,
        offsetTop: 250,
        offsetWidth: 400,
        offsetHeight: 500
    };
    const pages = {
        clientWidth: 1000,
        clientHeight: 1000,
        querySelectorAll: () => [image]
    };
    const stage = { clientWidth: 1000, clientHeight: 1000 };
    const reader = {
        zoom: 2,
        panX: 0,
        panY: 0,
        isContinuous: () => false
    };
    zoom.clampPagedPan(reader, stage, pages);
    assert.equal(reader.panX, 400, 'small asymmetric content is centered horizontally');
    assert.ok(Math.abs(reader.panY) < Number.EPSILON, 'small symmetric content is centered vertically');
}

{
    const pages = {
        clientWidth: 1000,
        clientHeight: 800,
        querySelectorAll: () => [
            { offsetLeft: 100, offsetTop: 100, offsetWidth: 350, offsetHeight: 600 },
            { offsetLeft: 550, offsetTop: 100, offsetWidth: 350, offsetHeight: 600 }
        ]
    };
    const reader = {
        zoom: 2,
        panX: -999,
        panY: 0,
        isContinuous: () => false
    };
    zoom.clampPagedPan(reader, { clientWidth: 1000, clientHeight: 800 }, pages);
    assert.equal(reader.panX, -300, 'double-page spread clamps as one rendered content bound');
}

{
    const slot = {
        isConnected: true,
        getBoundingClientRect: () => ({ left: 80, top: 160, width: 300, height: 600 })
    };
    const image = {
        tagName: 'IMG',
        isConnected: true,
        closest: () => slot,
        getBoundingClientRect: () => ({ left: 100, top: 200, width: 200, height: 400 })
    };
    hitElement = image;

    const reader = {
        currentPage: 0,
        continuousElements: [slot]
    };
    const source = { clientX: 150, clientY: 300 };
    const captured = zoom.captureContinuousAnchor(reader, source);
    assert.equal(captured.element, image, 'actual image is preferred over its slot');
    assert.equal(captured.xRatio, 0.25);
    assert.equal(captured.yRatio, 0.25);

    image.getBoundingClientRect = () => ({ left: 50, top: 100, width: 400, height: 800 });
    const stage = { scrollLeft: 20, scrollTop: 30 };
    zoom.restoreContinuousAnchor(stage, captured, { clientX: 200, clientY: 400 });
    assert.equal(stage.scrollLeft, -30, 'continuous X anchor follows target midpoint');
    assert.equal(stage.scrollTop, -70, 'continuous Y anchor follows target midpoint');
}

{
    const slot = {
        isConnected: true,
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 400, height: 800 })
    };
    const whitespace = {
        tagName: 'DIV',
        closest: () => slot
    };
    hitElement = whitespace;

    const captured = zoom.captureContinuousAnchor(
        { currentPage: 0, continuousElements: [slot] },
        { clientX: 100, clientY: 200 }
    );
    assert.equal(captured.element, slot, 'whitespace falls back to page slot');
    assert.equal(captured.xRatio, 0.25);
    assert.equal(captured.yRatio, 0.25);
}

console.log('Reader zoom geometry tests passed.');
