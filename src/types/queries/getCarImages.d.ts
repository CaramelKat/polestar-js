export type Image = {
	"url": string;
	"angle": number;
	"altText": string | null;
}

export type getCarImages = {
	getCarImages: {
		transparent: Image[];
		opaque: Image[];
	}
}