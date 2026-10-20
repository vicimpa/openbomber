const can = document.createElement('canvas')!;
const ctx = can.getContext('2d')!;

export const loadHero = async (src: string, size = 64) => {
	const img = new Image();
	await new Promise<void>((resolve, reject) => {
		img.src = src;
		img.onload = () => resolve();
		img.onerror = reject;
	});

	let xCount = img.width / size;
	let yCount = img.height / size;
	let rowCount = yCount / 3;

	can.width = xCount * size;
	can.height = rowCount * 4 * size;

	ctx.drawImage(img, 0, 0);

	for (let _x = 0; _x < xCount; _x++) {
		for (let _y = 0; _y < rowCount; _y++) {
			ctx.setTransform(-1, 0, 0, 1, _x * size, (_y + 3 * rowCount) * size);
			ctx.drawImage(img, _x * size, (_y + 4) * size, size, size, -size, 0, size, size);
		}
	}

	return can.toDataURL('image/png');
};