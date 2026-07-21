export function clientToNDC(canvas, clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const internalW = canvas.width;
    const internalH = canvas.height;
    const internalAspect = internalW / internalH;
    const displayAspect = rect.width / rect.height;

    let drawWidth = rect.width, drawHeight = rect.height, offsetX = 0, offsetY = 0;
    if (displayAspect > internalAspect) {
        drawHeight = rect.height;
        drawWidth = drawHeight * internalAspect;
        offsetX = (rect.width - drawWidth) / 2;
    } else {
        drawWidth = rect.width;
        drawHeight = drawWidth / internalAspect;
        offsetY = (rect.height - drawHeight) / 2;
    }

    const xInDraw = clientX - rect.left - offsetX;
    const yInDraw = clientY - rect.top - offsetY;

    const ndcX = (xInDraw / drawWidth) * 2 - 1;
    const ndcY = - (yInDraw / drawHeight) * 2 + 1;
    return { ndcX, ndcY };
}

