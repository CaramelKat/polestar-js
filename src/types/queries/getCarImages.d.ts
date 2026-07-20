export type ImageAngles = 0 | 1 | 2 | 3 | 4 | 5;

export type Image = {
	"url": string;
	"angle": ImageAngles;
	"altText": string | null;
}

export type getCarImages = {
	getCarImages: {
		transparent: Image[];
		opaque: Image[];
	}
}